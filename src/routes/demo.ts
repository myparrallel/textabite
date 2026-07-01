import path from 'path';
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/client';
import { sendWaitlistConfirmation } from '../services/email';

const router = Router();
const client = new Anthropic();

const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in an hour.' },
});

router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Invalid email' });
    return;
  }
  try {
    await db.query(
      `INSERT INTO demo_signups (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
      [email.toLowerCase().trim()]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Demo signup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/chat', chatLimiter, async (req: Request, res: Response): Promise<void> => {
  const { messages, system, model, max_tokens } = req.body;
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }
  try {
    const response = await client.messages.create({
      model: model ?? 'claude-sonnet-4-6',
      max_tokens: max_tokens ?? 1000,
      system,
      messages,
    });
    res.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Demo chat error:', msg);
    res.status(500).json({ error: 'AI error', detail: msg });
  }
});

router.post('/waitlist', async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone } = req.body as { name?: string; email?: string; phone?: string };
  if (!name || !email || !email.includes('@')) {
    res.status(400).json({ error: 'Name and valid email required' });
    return;
  }
  try {
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();
    const { rowCount } = await db.query(
      `INSERT INTO waitlist (name, email, phone) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
      [cleanName, cleanEmail, phone?.trim() || null]
    );
    // Only send confirmation for new signups, not duplicates
    if (rowCount && rowCount > 0) {
      sendWaitlistConfirmation(cleanName, cleanEmail).catch(err =>
        console.error('Waitlist confirmation email error:', err)
      );
    }
    const isHtmlRequest = req.headers['accept']?.includes('text/html');
    if (isHtmlRequest) {
      res.redirect('/?waitlist=success');
    } else {
      res.json({ success: true });
    }
  } catch (err) {
    console.error('Waitlist error:', err);
    const isHtmlRequest = req.headers['accept']?.includes('text/html');
    if (isHtmlRequest) {
      res.redirect('/?waitlist=error');
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

export default router;
