import { BrevoClient } from '@getbrevo/brevo';
import axios from 'axios';
import { config } from '../config/env';

export interface SendBrevoEmailParams {
  fromEmail?: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
}

export interface SendBrevoEmailResult {
  messageId: string;
  etherealUrl?: string;
}

export async function sendEmailViaBrevo(params: SendBrevoEmailParams): Promise<SendBrevoEmailResult> {
  const apiKey = config.brevo.apiKey || process.env.BREVO_API_KEY;

  if (!apiKey) {
    throw new Error('Brevo API Key (BREVO_API_KEY) is missing or not configured');
  }

  const senderEmail = params.fromEmail || config.brevo.senderEmail || process.env.BREVO_SENDER_EMAIL || 'outreach@reachinbox.ai';
  const senderName = params.fromName || config.brevo.senderName || process.env.BREVO_SENDER_NAME || 'ReachInbox Scheduler';

  const htmlContent = `<div style="font-family: Arial, sans-serif; padding: 20px;">
    <h2 style="color: #4F46E5;">ReachInbox Outreach</h2>
    <div style="border-left: 4px solid #4F46E5; padding-left: 15px; margin: 15px 0;">
      ${params.body.replace(/\n/g, '<br/>')}
    </div>
    <p style="color: #6B7280; font-size: 12px;">Sent via ReachInbox Email Job Scheduler</p>
   </div>`;

  try {
    const client = new BrevoClient({ apiKey });
    const response = await client.transactionalEmails.sendTransacEmail({
      subject: params.subject,
      textContent: params.body,
      htmlContent: htmlContent,
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [{ email: params.to }],
    });

    const messageId = (response as any)?.messageId || (response as any)?.messageIds?.[0] || 'brevo-sent';

    return {
      messageId: messageId,
    };
  } catch (sdkError: any) {
    console.warn('Brevo SDK call failed, attempting direct HTTPS API POST fallback:', sdkError?.message || sdkError);
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [{ email: params.to }],
        subject: params.subject,
        textContent: params.body,
        htmlContent: htmlContent,
      },
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    return {
      messageId: response.data?.messageId || 'brevo-sent',
    };
  }
}
