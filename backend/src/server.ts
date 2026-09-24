import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { config } from './config/env';
import { connectDB } from './config/db';
import { initElasticsearch } from './config/elasticsearch';
import { getEmailQueue, reconcileJobsOnServerStart } from './queue/email.queue';
import { initEmailWorker } from './queue/email.worker';
import apiRouter from './routes/api';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'ReachInbox Email Job Scheduler API',
  });
});

// Mounting API Routes
app.use('/api', apiRouter);

// Setup Live BullMQ Dashboard via Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const queue = getEmailQueue();
createBullBoard({
  queues: [new BullMQAdapter(queue) as any],
  serverAdapter: serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

async function startServer() {
  try {
    console.log('🚀 Starting ReachInbox Email Job Scheduler Service...');

    // 1. Connect DB
    await connectDB();

    // 2. Init Elasticsearch
    await initElasticsearch();

    // 3. Init Worker
    initEmailWorker();

    // 4. Reconcile DB jobs on server restart
    await reconcileJobsOnServerStart();

    // 5. Start Express Listener
    app.listen(config.port, () => {
      console.log(`\n======================================================`);
      console.log(`📡 Backend Server listening on http://localhost:${config.port}`);
      console.log(`📊 Live BullMQ Dashboard: http://localhost:${config.port}/admin/queues`);
      console.log(`======================================================\n`);
    });
  } catch (err) {
    console.error('Fatal Server Startup Error:', err);
    process.exit(1);
  }
}

startServer();
