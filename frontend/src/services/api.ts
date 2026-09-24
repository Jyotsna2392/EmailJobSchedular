import axios from 'axios';
import { User, EmailJob, EmailStats } from '../types';

const API_BASE = '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function loginWithGoogle(token?: string, mockUser?: any): Promise<{ user: User }> {
  const res = await api.post('/auth/google', { token, mockUser });
  return res.data;
}

export async function scheduleEmailsApi(payload: {
  userId: string;
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt: string;
  delaySeconds: number;
  hourlyLimit: number;
  senderAccountId?: string;
}): Promise<{ success: boolean; message: string; count: number }> {
  const res = await api.post('/emails/schedule', payload);
  return res.data;
}

export async function getEmailsApi(
  userId: string,
  status: string = 'ALL',
  page: number = 1,
  limit: number = 20
): Promise<{ emails: EmailJob[]; total: number; page: number; totalPages: number }> {
  const res = await api.get('/emails', {
    params: { userId, status, page, limit },
  });
  return res.data;
}

export async function getStatsApi(userId: string): Promise<{ stats: EmailStats }> {
  const res = await api.get('/emails/stats', {
    params: { userId },
  });
  return res.data;
}

export async function searchEmailsApi(
  userId: string,
  q: string,
  status: string = 'ALL',
  page: number = 1,
  limit: number = 20
): Promise<{ emails: EmailJob[]; total: number; source: 'elasticsearch' | 'database' }> {
  const res = await api.get('/emails/search', {
    params: { userId, q, status, page, limit },
  });
  return res.data;
}

export async function connectSlackWebhookApi(
  userId: string,
  webhookUrl: string
): Promise<{ success: boolean; message: string }> {
  const res = await api.post('/slack/connect-webhook', { userId, webhookUrl });
  return res.data;
}

export async function disconnectSlackApi(userId: string): Promise<{ success: boolean }> {
  const res = await api.post('/slack/disconnect', { userId });
  return res.data;
}

export async function getSlackStatusApi(
  userId: string
): Promise<{ isConnected: boolean; webhookUrl?: string }> {
  const res = await api.get('/slack/status', { params: { userId } });
  return res.data;
}
