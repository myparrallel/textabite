import 'dotenv/config';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { db } from './db/client';
import smsRouter from './routes/sms';
import stripeRouter from './routes/stripe';
import legalRouter from './routes/legal';
import webRouter from './routes/web';
import dashboardRouter from './routes/dashboard';
import demoRouter from './routes/demo';
import featuresRouter from './routes/features';
import { scheduleJobs } from './cron/dailySummary';

const app = express();

// Stripe webhook needs the raw body for signature verification
app.use('/webhook/stripe', express.raw({ type: 'application/json' }));

// Everything else uses URL-encoded (Twilio) or JSON
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/webhook/sms', smsRouter);
app.use('/webhook/stripe', stripeRouter);
app.use('/api/demo', demoRouter);
app.get('/demo', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/food-journal-landing.html'));
});
app.use('/', legalRouter);
app.use('/', dashboardRouter);
app.use('/', featuresRouter);
app.use('/', webRouter);

const PORT = process.env.PORT ?? 3000;

async function start(): Promise<void> {
  await db.query('SELECT 1'); // verify DB connection
  scheduleJobs();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
