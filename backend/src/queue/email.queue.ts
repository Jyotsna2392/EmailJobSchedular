import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { prisma } from '../config/db';

export const EMAIL_QUEUE_NAME = 'email-scheduler-queue';

export interface EmailJobPayload {
  emailId: string;
  userId: string;
  senderAccountId?: string | null;
  senderEmail: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAtIso: string;
  delaySeconds: number;
  hourlyLimit: number;
}

let emailQueue: Queue<EmailJobPayload> | null = null;

export function getEmailQueue(): Queue<EmailJobPayload> {
  if (!emailQueue) {
    const connection = getRedisConnection();
    emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
      connection: connection as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
      },
    });
    console.log(`✅ BullMQ Queue '${EMAIL_QUEUE_NAME}' initialized.`);
  }
  return emailQueue;
}

/**
 * Adds an email send job to BullMQ with a calculated delay.
 */
export async function scheduleEmailJob(jobData: EmailJobPayload, delayMs: number) {
  const queue = getEmailQueue();
  const validDelay = Math.max(0, Math.floor(delayMs));

  const job = await queue.add('send-email', jobData, {
    delay: validDelay,
    jobId: jobData.emailId, // Guarantees idempotency (BullMQ will reject duplicate jobId)
  });

  console.log(`📌 Enqueued Job [ID: ${jobData.emailId}] for recipient '${jobData.recipient}' with delay ${validDelay}ms`);
  return job;
}

/**
 * Reconciles DB jobs on server restart to guarantee no scheduled email is lost.
 */
export async function reconcileJobsOnServerStart() {
  console.log('🔄 Checking database for pending scheduled jobs to reconcile after server restart...');
  try {
    const pendingEmails = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'RATE_LIMITED'] },
      },
      include: { senderAccount: true },
    });

    if (pendingEmails.length === 0) {
      console.log('✅ Server restart check complete: No pending jobs requiring reconciliation.');
      return;
    }

    const queue = getEmailQueue();
    let reEnqueuedCount = 0;

    for (const email of pendingEmails) {
      const now = Date.now();
      const scheduledTime = new Date(email.scheduledAt).getTime();
      const delayMs = Math.max(0, scheduledTime - now);

      const existingJob = await queue.getJob(email.id);
      if (!existingJob) {
        const payload: EmailJobPayload = {
          emailId: email.id,
          userId: email.userId,
          senderAccountId: email.senderAccountId,
          senderEmail: email.senderAccount?.email || 'default@reachinbox.ai',
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          scheduledAtIso: email.scheduledAt.toISOString(),
          delaySeconds: email.delaySeconds,
          hourlyLimit: email.hourlyLimit,
        };

        await queue.add('send-email', payload, {
          delay: delayMs,
          jobId: email.id,
        });
        reEnqueuedCount++;
      }
    }

    console.log(`✅ Server restart reconciliation complete. Total ${reEnqueuedCount} jobs verified/re-enqueued.`);
  } catch (error) {
    console.error('❌ Error reconciling jobs on server start:', error);
  }
}
