import { prisma } from '../lib/prisma';
import { User, Prisma } from '@prisma/client';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
      include: { slackIntegration: true, senderAccounts: true },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { googleId },
    });
  }

  async upsertGoogleUser(data: {
    googleId: string;
    email: string;
    name?: string;
    avatar?: string;
  }): Promise<User> {
    return prisma.user.upsert({
      where: { email: data.email },
      update: {
        googleId: data.googleId,
        name: data.name,
        avatar: data.avatar,
      },
      create: {
        googleId: data.googleId,
        email: data.email,
        name: data.name,
        avatar: data.avatar,
      },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  }
}

export const userRepository = new UserRepository();
