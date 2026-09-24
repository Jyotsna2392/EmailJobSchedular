import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/db';
import { config } from '../config/env';
import { getOrCreateEtherealAccount } from '../services/ethereal.service';

const googleClient = new OAuth2Client(config.google.clientId);

export async function googleLogin(req: Request, res: Response) {
  try {
    const { token, mockUser } = req.body;

    let email: string;
    let name: string;
    let avatar: string;

    // Support both real Google OAuth verification and direct payload
    if (token && token !== 'demo-token') {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: token,
          audience: config.google.clientId,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          return res.status(400).json({ error: 'Invalid Google OAuth payload' });
        }
        email = payload.email;
        name = payload.name || 'User';
        avatar = payload.picture || '';
      } catch (err) {
        // Fallback for custom frontend tokens / demo mode
        if (mockUser && mockUser.email) {
          email = mockUser.email;
          name = mockUser.name || 'ReachInbox User';
          avatar = mockUser.avatar || '';
        } else {
          return res.status(401).json({ error: 'Google authentication token verification failed' });
        }
      }
    } else if (mockUser && mockUser.email) {
      email = mockUser.email;
      name = mockUser.name || 'ReachInbox Demo User';
      avatar = mockUser.avatar || '';
    } else {
      return res.status(400).json({ error: 'Missing token or mockUser payload' });
    }

    // Attempt DB upsert with graceful fallback if DB is temporarily offline
    try {
      let user = await prisma.user.upsert({
        where: { email },
        update: { name, avatar },
        create: { email, name, avatar },
        include: { slackIntegration: true, senderAccounts: true },
      });

      // Ensure default Sender Account exists for user
      if (user.senderAccounts.length === 0) {
        const etherealAcc = await getOrCreateEtherealAccount();
        await prisma.senderAccount.create({
          data: {
            userId: user.id,
            email: `${email.split('@')[0]}@reachinbox-outreach.com`,
            smtpHost: etherealAcc.smtpHost,
            smtpPort: etherealAcc.smtpPort,
            smtpUser: etherealAcc.user,
            smtpPass: etherealAcc.pass,
            hourlyLimit: config.scheduler.defaultMaxEmailsPerHour,
          },
        });
        user = (await prisma.user.findUnique({
          where: { id: user.id },
          include: { slackIntegration: true, senderAccounts: true },
        }))!;
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          slackConnected: Boolean(user.slackIntegration?.isConnected),
          senderAccounts: user.senderAccounts,
        },
      });
    } catch (dbError) {
      console.warn('⚠️ Database query failed during auth login. Using fallback session:', dbError);
      return res.json({
        success: true,
        user: {
          id: 'demo-user-id-123',
          email,
          name,
          avatar,
          slackConnected: false,
          senderAccounts: [
            {
              id: 'demo-sender-id',
              userId: 'demo-user-id-123',
              email: `${email.split('@')[0]}@reachinbox-outreach.com`,
              smtpHost: 'smtp.ethereal.email',
              smtpPort: 587,
              smtpUser: 'ethereal.test@ethereal.email',
              smtpPass: 'etherealpass123',
              hourlyLimit: config.scheduler.defaultMaxEmailsPerHour,
              isDefault: true,
            },
          ],
        },
      });
    }
  } catch (error: any) {
    console.error('Google login error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
