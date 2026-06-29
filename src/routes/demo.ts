import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/client';

const router = Router();
const client = new Anthropic();

const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
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
  } catch (err) {
    console.error('Demo chat error:', err);
    res.status(500).json({ error: 'AI error' });
  }
});

export default router;
