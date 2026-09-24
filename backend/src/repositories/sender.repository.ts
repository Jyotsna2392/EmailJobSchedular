import { prisma } from '../lib/prisma';
import { SenderAccount, Prisma } from '@prisma/client';

export class SenderRepository {
  async findById(id: string): Promise<SenderAccount | null> {
    return prisma.senderAccount.findUnique({
      where: { id },
    });
  }

  async findByUserId(userId: string): Promise<SenderAccount[]> {
    return prisma.senderAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findDefaultByUserId(userId: string): Promise<SenderAccount | null> {
    return prisma.senderAccount.findFirst({
      where: { userId, isDefault: true },
    });
  }

  async create(data: Prisma.SenderAccountCreateInput): Promise<SenderAccount> {
    return prisma.senderAccount.create({ data });
  }

  async update(id: string, data: Prisma.SenderAccountUpdateInput): Promise<SenderAccount> {
    return prisma.senderAccount.update({
      where: { id },
      data,
    });
  }
}

export const senderRepository = new SenderRepository();
