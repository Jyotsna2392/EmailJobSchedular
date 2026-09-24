import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../config/db';

export async function connectSlackWebhook(req: Request, res: Response) {
  try {
    const { userId, webhookUrl, channel } = req.body;

    if (!userId || !webhookUrl) {
      return res.status(400).json({ error: 'userId and webhookUrl are required' });
    }

    const integration = await prisma.slackIntegration.upsert({
      where: { userId },
      update: {
        incomingWebhookUrl: webhookUrl,
        channel: channel || '#general',
        isConnected: true,
      },
      create: {
        userId,
        incomingWebhookUrl: webhookUrl,
        channel: channel || '#general',
        isConnected: true,
      },
    });

    // Send welcome test notification to Slack webhook
    try {
      await axios.post(webhookUrl, {
        text: '🎉 *ReachInbox Connected to Slack!* You will now receive instant notifications when rate limits are hit.',
      });
    } catch (e) {
      console.warn('Initial webhook ping failed, saved integration anyway:', e);
    }

    return res.json({
      success: true,
      message: 'Slack Webhook connected successfully',
      integration,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to connect Slack Webhook' });
  }
}

export async function disconnectSlack(req: Request, res: Response) {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    await prisma.slackIntegration.update({
      where: { userId },
      data: { isConnected: false },
    });

    return res.json({ success: true, message: 'Slack disconnected' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function getSlackStatus(req: Request, res: Response) {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const integration = await prisma.slackIntegration.findUnique({
      where: { userId: userId as string },
    });

    return res.json({
      success: true,
      isConnected: Boolean(integration?.isConnected),
      webhookUrl: integration?.incomingWebhookUrl || null,
      channel: integration?.channel || null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
