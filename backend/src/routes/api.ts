import { Router } from 'express';
import { googleLogin } from '../controllers/auth.controller';
import { scheduleEmails, getEmails, getStats } from '../controllers/email.controller';
import { searchEmailsController } from '../controllers/search.controller';
import { connectSlackWebhook, disconnectSlack, getSlackStatus } from '../controllers/slack.controller';

const router = Router();

// Auth Routes
router.post('/auth/google', googleLogin);

// Email Scheduler Routes
router.post('/emails/schedule', scheduleEmails);
router.get('/emails', getEmails);
router.get('/emails/stats', getStats);
router.get('/emails/search', searchEmailsController);

// Slack Integration Routes
router.post('/slack/connect-webhook', connectSlackWebhook);
router.post('/slack/disconnect', disconnectSlack);
router.get('/slack/status', getSlackStatus);

export default router;
