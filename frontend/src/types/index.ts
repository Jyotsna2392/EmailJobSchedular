export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  slackConnected?: boolean;
  senderAccounts?: SenderAccount[];
}

export interface SenderAccount {
  id: string;
  email: string;
  hourlyLimit: number;
  smtpHost: string;
  smtpPort: number;
}

export interface EmailJob {
  id: string;
  userId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RATE_LIMITED';
  etherealUrl?: string | null;
  delaySeconds: number;
  hourlyLimit: number;
  errorMessage?: string | null;
  senderAccount?: SenderAccount;
  createdAt: string;
}

export interface EmailStats {
  total: number;
  scheduled: number;
  sent: number;
  failed: number;
  rateLimited: number;
  senderCount: number;
}
