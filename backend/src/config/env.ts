import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgrespassword@localhost:5432/email_scheduler?schema=public'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  ELASTICSEARCH_NODE: z.string().default('http://localhost:9200'),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  DEFAULT_MIN_DELAY_SECONDS: z.coerce.number().default(2),
  DEFAULT_HOURLY_LIMIT: z.coerce.number().default(200),
  JWT_SECRET: z.string().default('super-secret-jwt-key-for-email-scheduler'),
  GOOGLE_CLIENT_ID: z.string().optional().default('mock-google-client-id'),
  GOOGLE_CLIENT_SECRET: z.string().optional().default('mock-google-client-secret'),
  SLACK_CLIENT_ID: z.string().optional().default('mock-slack-client-id'),
  SLACK_CLIENT_SECRET: z.string().optional().default('mock-slack-client-secret'),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:5000/api/slack/callback'),
  ETHEREAL_USER: z.string().optional(),
  ETHEREAL_PASS: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  throw new Error('Invalid environment variables');
}

export const env = _env.data;

export const config = {
  port: env.PORT,
  env: env.NODE_ENV,
  database: {
    url: env.DATABASE_URL,
  },
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },
  elasticsearch: {
    node: env.ELASTICSEARCH_NODE,
  },
  scheduler: {
    workerConcurrency: env.WORKER_CONCURRENCY,
    minSendDelayMs: env.DEFAULT_MIN_DELAY_SECONDS * 1000,
    defaultMaxEmailsPerHour: env.DEFAULT_HOURLY_LIMIT,
  },
  jwtSecret: env.JWT_SECRET,
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  },
  slack: {
    clientId: env.SLACK_CLIENT_ID,
    clientSecret: env.SLACK_CLIENT_SECRET,
    redirectUri: env.SLACK_REDIRECT_URI,
  },
  ethereal: {
    user: env.ETHEREAL_USER,
    pass: env.ETHEREAL_PASS,
  },
};
