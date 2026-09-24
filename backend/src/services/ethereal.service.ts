import nodemailer from 'nodemailer';
import { config } from '../config/env';

export interface EtherealAccountInfo {
  user: string;
  pass: string;
  smtpHost: string;
  smtpPort: number;
  webUrl?: string;
}

// In-memory cache of Ethereal accounts so we don't recreate them needlessly
let defaultAccount: EtherealAccountInfo | null = null;

export async function getOrCreateEtherealAccount(): Promise<EtherealAccountInfo> {
  if (defaultAccount) {
    return defaultAccount;
  }

  if (config.ethereal.user && config.ethereal.pass) {
    defaultAccount = {
      user: config.ethereal.user,
      pass: config.ethereal.pass,
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
    };
    return defaultAccount;
  }

  try {
    const testAccount = await nodemailer.createTestAccount();
    defaultAccount = {
      user: testAccount.user,
      pass: testAccount.pass,
      smtpHost: testAccount.smtp.host,
      smtpPort: testAccount.smtp.port,
      webUrl: testAccount.web,
    };
    console.log(`✅ Created Ethereal SMTP account: ${defaultAccount.user}`);
    return defaultAccount;
  } catch (error) {
    console.error('Failed to create Ethereal test account:', error);
    throw error;
  }
}

export async function sendEmailViaEthereal(params: {
  smtpUser?: string;
  smtpPass?: string;
  smtpHost?: string;
  smtpPort?: number;
  from: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ messageId: string; etherealUrl: string }> {
  let host = params.smtpHost;
  let port = params.smtpPort;
  let user = params.smtpUser;
  let pass = params.smtpPass;

  if (!user || !pass || user === 'ethereal.test@ethereal.email') {
    const defaultAcc = await getOrCreateEtherealAccount();
    host = defaultAcc.smtpHost;
    port = defaultAcc.smtpPort;
    user = defaultAcc.user;
    pass = defaultAcc.pass;
  }

  const transporter = nodemailer.createTransport({
    host: host || 'smtp.ethereal.email',
    port: port || 587,
    secure: false,
    auth: {
      user: user,
      pass: pass,
    },
  });

  const mailOptions = {
    from: params.from || user,
    to: params.to,
    subject: params.subject,
    text: params.body,
    html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #4F46E5;">ReachInbox Outreach</h2>
            <div style="border-left: 4px solid #4F46E5; padding-left: 15px; margin: 15px 0;">
              ${params.body.replace(/\n/g, '<br/>')}
            </div>
            <p style="color: #6B7280; font-size: 12px;">Sent via ReachInbox Email Job Scheduler</p>
           </div>`,
  };

  const info = await transporter.sendMail(mailOptions);
  const previewUrl = nodemailer.getTestMessageUrl(info);
  const etherealUrlStr = typeof previewUrl === 'string' ? previewUrl : `https://ethereal.email/message/${info.messageId}`;

  return {
    messageId: info.messageId,
    etherealUrl: etherealUrlStr,
  };
}
