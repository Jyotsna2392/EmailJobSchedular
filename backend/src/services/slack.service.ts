import axios from 'axios';
import { prisma } from '../config/db';

export async function sendSlackRateLimitNotification(params: {
  userId: string;
  senderEmail: string;
  hourlyLimit: number;
  attemptedRecipient: string;
  rescheduledTo: Date;
}) {
  try {
    const slackIntegration = await prisma.slackIntegration.findUnique({
      where: { userId: params.userId },
    });

    if (!slackIntegration || !slackIntegration.isConnected) {
      console.log(`ℹ️ Slack not connected for user ${params.userId}. Skipping rate limit notification.`);
      return;
    }

    const payload = {
      text: `🚨 *ReachInbox Rate Limit Alert*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 ReachInbox Hourly Rate Limit Reached',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender Account:*\n\`${params.senderEmail}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Cap:*\n${params.hourlyLimit} emails/hr`,
            },
            {
              type: 'mrkdwn',
              text: `*Attempted Lead:*\n${params.attemptedRecipient}`,
            },
            {
              type: 'mrkdwn',
              text: `*Rescheduled Time:*\n${params.rescheduledTo.toLocaleString()}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '⚠️ Job was automatically delayed to the next hour window without dropping leads.',
            },
          ],
        },
      ],
    };

    if (slackIntegration.incomingWebhookUrl) {
      await axios.post(slackIntegration.incomingWebhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });
      console.log(`✅ Live Slack Notification sent via Webhook for sender ${params.senderEmail}`);
    } else if (slackIntegration.accessToken) {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: slackIntegration.channel || '#general',
          ...payload,
        },
        {
          headers: {
            Authorization: `Bearer ${slackIntegration.accessToken}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          timeout: 5000,
        }
      );
      console.log(`✅ Live Slack Notification sent via OAuth Bot Token for sender ${params.senderEmail}`);
    }
  } catch (error: any) {
    console.error('❌ Failed to dispatch Slack notification:', error?.response?.data || error?.message || error);
  }
}
