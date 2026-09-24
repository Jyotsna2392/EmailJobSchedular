import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { scheduleEmailJob, EmailJobPayload } from '../queue/email.queue';
import { indexEmailInElasticsearch } from '../services/search.service';

export async function scheduleEmails(req: Request, res: Response) {
  try {
    const {
      userId,
      recipients,
      subject,
      body,
      scheduledAt,
      delaySeconds = 2,
      hourlyLimit = 200,
      senderAccountId,
    } = req.body;

    if (!userId || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Invalid payload: userId and recipients array required' });
    }

    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();
    const now = Date.now();
    const delayMs = Math.max(0, scheduledDate.getTime() - now);

    // Fetch sender account or fallback
    let senderAccount = null;
    if (senderAccountId) {
      senderAccount = await prisma.senderAccount.findUnique({
        where: { id: senderAccountId },
      });
    }

    if (!senderAccount) {
      senderAccount = await prisma.senderAccount.findFirst({
        where: { userId },
      });
    }

    const senderEmail = senderAccount?.email || 'outreach@reachinbox.ai';

    const createdJobs = [];

    for (const recipientRaw of recipients) {
      const recipient = recipientRaw.trim();
      if (!recipient || !recipient.includes('@')) continue;

      // 1. Create DB Record
      const emailRecord = await prisma.emailJob.create({
        data: {
          userId,
          senderAccountId: senderAccount?.id || null,
          recipient,
          subject,
          body,
          scheduledAt: scheduledDate,
          status: 'SCHEDULED',
          delaySeconds: Number(delaySeconds) || 2,
          hourlyLimit: Number(hourlyLimit) || senderAccount?.hourlyLimit || 200,
        },
      });

      // 2. Schedule in BullMQ Queue
      const payload: EmailJobPayload = {
        emailId: emailRecord.id,
        userId,
        senderAccountId: senderAccount?.id || null,
        senderEmail,
        recipient,
        subject,
        body,
        scheduledAtIso: scheduledDate.toISOString(),
        delaySeconds: Number(delaySeconds) || 2,
        hourlyLimit: Number(hourlyLimit) || senderAccount?.hourlyLimit || 200,
      };

      await scheduleEmailJob(payload, delayMs);

      // 3. Index in Elasticsearch
      await indexEmailInElasticsearch({
        id: emailRecord.id,
        userId: emailRecord.userId,
        senderAccountId: emailRecord.senderAccountId,
        recipient: emailRecord.recipient,
        subject: emailRecord.subject,
        body: emailRecord.body,
        status: emailRecord.status,
        scheduledAt: emailRecord.scheduledAt,
        createdAt: emailRecord.createdAt,
      });

      createdJobs.push(emailRecord);
    }

    return res.json({
      success: true,
      message: `Successfully scheduled ${createdJobs.length} email(s)`,
      count: createdJobs.length,
      scheduledAt: scheduledDate.toISOString(),
    });
  } catch (error: any) {
    console.error('Error scheduling emails:', error);
    return res.status(500).json({ error: error.message || 'Failed to schedule emails' });
  }
}

export async function getEmails(req: Request, res: Response) {
  try {
    const { userId, status = 'ALL', page = 1, limit = 20 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { userId: userId as string };

    if (status !== 'ALL') {
      where.status = status as string;
    }

    const [total, emails] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip,
        take: limitNum,
        include: { senderAccount: true },
      }),
    ]);

    return res.json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      emails,
    });
  } catch (error: any) {
    console.error('Error fetching emails:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch emails' });
  }
}

export async function getStats(req: Request, res: Response) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId parameter required' });
    }

    const uid = userId as string;

    const [total, scheduled, sent, failed, rateLimited, senderCount] = await Promise.all([
      prisma.emailJob.count({ where: { userId: uid } }),
      prisma.emailJob.count({ where: { userId: uid, status: 'SCHEDULED' } }),
      prisma.emailJob.count({ where: { userId: uid, status: 'SENT' } }),
      prisma.emailJob.count({ where: { userId: uid, status: 'FAILED' } }),
      prisma.emailJob.count({ where: { userId: uid, status: 'RATE_LIMITED' } }),
      prisma.senderAccount.count({ where: { userId: uid } }),
    ]);

    return res.json({
      success: true,
      stats: {
        total,
        scheduled,
        sent,
        failed,
        rateLimited,
        senderCount,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch stats' });
  }
}
