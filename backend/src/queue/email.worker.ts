import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { EMAIL_QUEUE_NAME, EmailJobPayload, getEmailQueue } from './email.queue';
import { prisma } from '../config/db';
import { sendEmailViaEthereal } from '../services/ethereal.service';
import { sendEmailViaBrevo } from '../services/brevo.service';
import { indexEmailInElasticsearch } from '../services/search.service';
import { sendSlackRateLimitNotification } from '../services/slack.service';
import { config } from '../config/env';

let emailWorker: Worker<EmailJobPayload> | null = null;

export function initEmailWorker(): Worker<EmailJobPayload> {
  if (emailWorker) {
    return emailWorker;
  }

  const connection = getRedisConnection();

  emailWorker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobPayload>) => {
      const data = job.data;
      console.log(`🚀 Processing Email Job [ID: ${data.emailId}] -> Recipient: ${data.recipient}`);

      // 1. Idempotency Check: Fetch latest state from Database
      const emailRecord = await prisma.emailJob.findUnique({
        where: { id: data.emailId },
        include: { senderAccount: true },
      });

      if (!emailRecord) {
        console.warn(`⚠️ Job ${data.emailId} not found in database. Skipping.`);
        return;
      }

      if (emailRecord.status === 'SENT') {
        console.log(`ℹ️ Job ${data.emailId} already marked as SENT. Skipping duplicate execution.`);
        return;
      }

      // Mark status as PROCESSING in DB
      await prisma.emailJob.update({
        where: { id: data.emailId },
        data: { status: 'PROCESSING' },
      });

      // 2. Enforce Minimum Provider Delay (Throttling)
      const interSendDelay = Math.max(
        config.scheduler.minSendDelayMs,
        (data.delaySeconds || 2) * 1000
      );
      await new Promise((resolve) => setTimeout(resolve, interSendDelay));

      // 3. Redis-Backed Sliding Window Rate Limiting (Emails per hour per sender)
      const redis = getRedisConnection();
      const senderKey = data.senderEmail.toLowerCase();
      const currentHourWindow = new Date().toISOString().substring(0, 13); // "YYYY-MM-DDTHH"
      const rateLimitKey = `ratelimit:${senderKey}:${currentHourWindow}`;

      const currentCount = await redis.incr(rateLimitKey);
      if (currentCount === 1) {
        await redis.expire(rateLimitKey, 7200); // 2 hours TTL
      }

      const senderLimit = data.hourlyLimit || config.scheduler.defaultMaxEmailsPerHour;

      if (currentCount > senderLimit) {
        // Rollback Redis count since sending is postponed
        await redis.decr(rateLimitKey);

        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        const rescheduleDelayMs = Math.max(1000, nextHour.getTime() - now.getTime());

        console.warn(
          `⚠️ Hourly rate limit reached for sender '${senderKey}' (${currentCount}/${senderLimit}). Rescheduling job ${data.emailId} in ${(rescheduleDelayMs / 1000).toFixed(0)}s`
        );

        // Update DB status
        const updatedJob = await prisma.emailJob.update({
          where: { id: data.emailId },
          data: {
            status: 'RATE_LIMITED',
            scheduledAt: nextHour,
            errorMessage: `Hourly limit of ${senderLimit} reached for sender ${senderKey}. Delayed to ${nextHour.toISOString()}`,
          },
        });

        // Index status in Elasticsearch
        await indexEmailInElasticsearch({
          id: updatedJob.id,
          userId: updatedJob.userId,
          senderAccountId: updatedJob.senderAccountId,
          recipient: updatedJob.recipient,
          subject: updatedJob.subject,
          body: updatedJob.body,
          status: updatedJob.status,
          etherealUrl: updatedJob.etherealUrl,
          scheduledAt: updatedJob.scheduledAt,
          sentAt: updatedJob.sentAt,
          createdAt: updatedJob.createdAt,
        });

        // Dispatch Live Slack Notification
        await sendSlackRateLimitNotification({
          userId: data.userId,
          senderEmail: data.senderEmail,
          hourlyLimit: senderLimit,
          attemptedRecipient: data.recipient,
          rescheduledTo: nextHour,
        });

        // Re-enqueue delayed job in BullMQ for next hour window
        const queue = getEmailQueue();
        await queue.add('send-email', data, {
          delay: rescheduleDelayMs,
          jobId: data.emailId,
        });

        return;
      }

      // 4. Send Email via Ethereal SMTP or Brevo HTTPS API based on EMAIL_PROVIDER
      try {
        let sendResult: { messageId: string; etherealUrl?: string };

        const provider = (config.emailProvider || process.env.EMAIL_PROVIDER || 'ethereal').toLowerCase();

        if (provider === 'brevo') {
          console.log(`📧 Sending email via Brevo HTTPS API for Job ${data.emailId}`);
          sendResult = await sendEmailViaBrevo({
            to: data.recipient,
            subject: data.subject,
            body: data.body,
          });
        } else {
          console.log(`📧 Sending email via Ethereal SMTP for Job ${data.emailId}`);
          const smtpUser = emailRecord.senderAccount?.smtpUser;
          const smtpPass = emailRecord.senderAccount?.smtpPass;
          const smtpHost = emailRecord.senderAccount?.smtpHost;
          const smtpPort = emailRecord.senderAccount?.smtpPort;

          sendResult = await sendEmailViaEthereal({
            smtpUser,
            smtpPass,
            smtpHost,
            smtpPort,
            from: data.senderEmail,
            to: data.recipient,
            subject: data.subject,
            body: data.body,
          });
        }

        const sentAt = new Date();

        // 5. Update Database State to SENT
        const sentRecord = await prisma.emailJob.update({
          where: { id: data.emailId },
          data: {
            status: 'SENT',
            sentAt: sentAt,
            etherealUrl: sendResult.etherealUrl || null,
            errorMessage: null,
          },
        });

        console.log(`✅ Email SENT successfully! ID: ${sentRecord.id} | Provider: ${provider}${sendResult.etherealUrl ? ` | Preview: ${sendResult.etherealUrl}` : ''}`);

        // 6. Index in Elasticsearch
        await indexEmailInElasticsearch({
          id: sentRecord.id,
          userId: sentRecord.userId,
          senderAccountId: sentRecord.senderAccountId,
          recipient: sentRecord.recipient,
          subject: sentRecord.subject,
          body: sentRecord.body,
          status: sentRecord.status,
          etherealUrl: sentRecord.etherealUrl,
          scheduledAt: sentRecord.scheduledAt,
          sentAt: sentRecord.sentAt,
          createdAt: sentRecord.createdAt,
        });
      } catch (err: any) {
        console.error(`❌ Failed to send email job ${data.emailId}:`, err);

        const failedRecord = await prisma.emailJob.update({
          where: { id: data.emailId },
          data: {
            status: 'FAILED',
            errorMessage: err.message || 'SMTP sending failed',
          },
        });

        await indexEmailInElasticsearch({
          id: failedRecord.id,
          userId: failedRecord.userId,
          senderAccountId: failedRecord.senderAccountId,
          recipient: failedRecord.recipient,
          subject: failedRecord.subject,
          body: failedRecord.body,
          status: failedRecord.status,
          etherealUrl: failedRecord.etherealUrl,
          scheduledAt: failedRecord.scheduledAt,
          sentAt: failedRecord.sentAt,
          createdAt: failedRecord.createdAt,
        });

        throw err;
      }
    },
    {
      connection: connection as any,
      concurrency: config.scheduler.workerConcurrency,
    }
  );

  emailWorker.on('completed', (job) => {
    console.log(`🎉 Job ${job.id} completed successfully`);
  });

  emailWorker.on('failed', (job, err) => {
    console.error(`💥 Job ${job?.id} failed with error: ${err.message}`);
  });

  console.log(`✅ BullMQ Worker initialized with concurrency: ${config.scheduler.workerConcurrency}`);
  return emailWorker;
}
