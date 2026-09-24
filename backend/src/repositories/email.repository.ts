import { prisma } from '../lib/prisma';
import { EmailJob, EmailStatus, Prisma } from '@prisma/client';

export class EmailRepository {
  async findById(id: string): Promise<EmailJob | null> {
    return prisma.emailJob.findUnique({
      where: { id },
      include: { senderAccount: true },
    });
  }

  async findByUserId(
    userId: string,
    options?: { status?: EmailStatus; page?: number; limit?: number }
  ): Promise<{ data: EmailJob[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.EmailJobWhereInput = {
      userId,
      ...(options?.status ? { status: options.status } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { senderAccount: true },
      }),
      prisma.emailJob.count({ where }),
    ]);

    return { data, total };
  }

  async create(data: Prisma.EmailJobCreateInput): Promise<EmailJob> {
    return prisma.emailJob.create({ data });
  }

  async createMany(data: Prisma.EmailJobCreateManyInput[]): Promise<number> {
    const res = await prisma.emailJob.createMany({ data });
    return res.count;
  }

  /**
   * Atomic DB status transition guard:
   * Only transitions status to PROCESSING if current status is SCHEDULED or RATE_LIMITED.
   * Prevents race conditions and duplicate email dispatch on worker restarts/retries.
   */
  async acquireForProcessing(id: string): Promise<EmailJob | null> {
    const updated = await prisma.$queryRaw<EmailJob[]>`
      UPDATE email_jobs
      SET status = 'PROCESSING'::"EmailStatus", "updatedAt" = NOW()
      WHERE id = ${id} AND status IN ('SCHEDULED'::"EmailStatus", 'RATE_LIMITED'::"EmailStatus")
      RETURNING *;
    `;

    return updated.length > 0 ? updated[0] : null;
  }

  async markAsSent(id: string, etherealUrl?: string): Promise<EmailJob> {
    return prisma.emailJob.update({
      where: { id },
      data: {
        status: EmailStatus.SENT,
        sentAt: new Date(),
        etherealUrl,
      },
    });
  }

  async markAsFailed(id: string, errorMessage: string): Promise<EmailJob> {
    return prisma.emailJob.update({
      where: { id },
      data: {
        status: EmailStatus.FAILED,
        errorMessage,
      },
    });
  }

  async markAsRateLimited(id: string): Promise<EmailJob> {
    return prisma.emailJob.update({
      where: { id },
      data: {
        status: EmailStatus.RATE_LIMITED,
      },
    });
  }

  async updateBullJobId(id: string, bullJobId: string): Promise<EmailJob> {
    return prisma.emailJob.update({
      where: { id },
      data: { bullJobId },
    });
  }
}

export const emailRepository = new EmailRepository();
