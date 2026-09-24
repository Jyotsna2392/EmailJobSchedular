import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL / Database connected successfully via Prisma');
  } catch (error) {
    console.error('❌ Database connection error:', error);
  }
}
