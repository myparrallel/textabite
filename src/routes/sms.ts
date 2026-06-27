import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { db } from '../db/client';
import {
  detectIntent,
  parseMeal,
  mealConfirmationReply,
  shouldIEatThis,
  handleReminderReply,
  goalOnboardingReply,
  helpReply,
  UserGoals,
  DayTotals,
} from '../services/claude';
import { sendSms } from '../services/twilio';

const router = Router();

function validateTwilio(req: Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const signature = req.headers['x-twilio-signature'] as string;
  const url = `${process.env.APP_URL}/webhook/sms`;
  return twilio.validateRequest(authToken, signature, url, req.body as Record<string, string>);
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production' && !validateTwilio(req)) {
    res.status(403).send('Forbidden');
    return;
  }

  const from: string = req.body.From;
  const body: string = (req.body.Body ?? '').trim();
  const mediaUrl: string | undefined = req.body.MediaUrl0; // MMS photo

  if (!from || (!body && !mediaUrl)) {
    res.status(400).send('Bad Request');
    return;
  }

  try {
    // Upsert user
    const { rows: userRows } = await db.query<{ id: string; phone: string }>(
      `INSERT INTO users (phone) VALUES ($1)
       ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
       RETURNING id, phone`,
      [from]
    );
    const user = userRows[0];

    // Check active subscription
    const { rows: subs } = await db.query<{ plan: string }>(
      `SELECT plan FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [user.id]
    );

    if (subs.length === 0) {
      await sendSms(from, `Hey! To get started with Textabite, grab a subscription at ${process.env.APP_URL} 🥗`);
      res.sendStatus(204);
      return;
    }

    const plan = subs[0].plan as 'basic' | 'premium';

    // Load user settings
    const { rows: settingsRows } = await db.query(
      `SELECT * FROM user_settings WHERE user_id = $1`,
      [user.id]
    );

    let settings = settingsRows[0];
    if (!settings) {
      await db.query(`INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]);
      const { rows } = await db.query(`SELECT * FROM user_settings WHERE user_id = $1`, [user.id]);
      settings = rows[0];
    }

    // If user is mid-onboarding, continue that flow
    if (settings.onboarding_step) {
      await handleOnboarding(user.id, from, body, settings.onboarding_step);
      res.sendStatus(204);
      return;
    }

    // Detect intent
    const intent = await detectIntent(body || 'photo of food');

    switch (intent) {
      case 'log_meal':
      case 'reminder_reply': {
        let mealText = body;

        // If it's a reminder reply, extract the actual food first
        if (intent === 'reminder_reply') {
          const parsed = await handleReminderReply(body, 'meal');
          if (!parsed.shouldLog) {
            await sendSms(from, parsed.response);
            res.sendStatus(204);
            return;
          }
          mealText = parsed.mealText || body;
          // Send the reminder ack first, then fall through to log
          await sendSms(from, parsed.response);
        }

        const nutrition = await parseMeal(mealText, mediaUrl);

        // Get today's totals before this meal
        const { rows: totalsRows } = await db.query<DayTotals>(
          `SELECT
             COALESCE(SUM(calories),0)::int   AS calories,
             COALESCE(SUM(protein_g),0)::numeric AS protein_g,
             COALESCE(SUM(carbs_g),0)::numeric   AS carbs_g,
             COALESCE(SUM(fat_g),0)::numeric      AS fat_g
           FROM meals
           WHERE user_id = $1
             AND logged_at >= NOW()::date`,
          [user.id]
        );
        const todayTotals = totalsRows[0];

        const goals: UserGoals = {
          preset: settings.goal_preset,
          calorie_goal: settings.calorie_goal,
          protein_goal_g: settings.protein_goal_g,
          carbs_goal_g: settings.carbs_goal_g,
          fat_goal_g: settings.fat_goal_g,
        };

        await db.query(
          `INSERT INTO meals (user_id, raw_text, calories, protein_g, carbs_g, fat_g, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [user.id, mealText, nutrition.calories, nutrition.protein_g, nutrition.carbs_g, nutrition.fat_g, nutrition.description]
        );

        const reply = await mealConfirmationReply(
          nutrition,
          settings.response_style ?? 'detailed',
          plan === 'premium' ? goals : undefined,
          plan === 'premium' ? todayTotals : undefined
        );

        await sendSms(from, reply);
        break;
      }

      case 'should_i_eat': {
        if (plan !== 'premium') {
          await sendSms(from, `That's a Premium feature! Upgrade at ${process.env.APP_URL} to get goal-aware advice 🎯`);
          break;
        }

        const goals: UserGoals = {
          preset: settings.goal_preset,
          calorie_goal: settings.calorie_goal,
          protein_goal_g: settings.protein_goal_g,
          carbs_goal_g: settings.carbs_goal_g,
          fat_goal_g: settings.fat_goal_g,
        };

        if (!goals.calorie_goal) {
          await sendSms(from, `Set your goals first so I can give you real advice! Text "set my goals" or do it faster at ${process.env.APP_URL}/dashboard`);
          break;
        }

        const { rows: totalsRows } = await db.query<DayTotals>(
          `SELECT
             COALESCE(SUM(calories),0)::int      AS calories,
             COALESCE(SUM(protein_g),0)::numeric AS protein_g,
             COALESCE(SUM(carbs_g),0)::numeric   AS carbs_g,
             COALESCE(SUM(fat_g),0)::numeric      AS fat_g
           FROM meals WHERE user_id = $1 AND logged_at >= NOW()::date`,
          [user.id]
        );

        const reply = await shouldIEatThis(body, goals, totalsRows[0], mediaUrl);
        await sendSms(from, reply);
        break;
      }

      case 'goal_setting': {
        // Start onboarding
        const { reply, nextStep } = await goalOnboardingReply(body, null);
        await db.query(
          `UPDATE user_settings SET onboarding_step = $1, updated_at = NOW() WHERE user_id = $2`,
          [nextStep, user.id]
        );
        await sendSms(from, reply);
        break;
      }

      case 'help':
      default: {
        await sendSms(from, await helpReply());
        break;
      }
    }

    res.sendStatus(204);
  } catch (err) {
    console.error('SMS webhook error:', err);
    await sendSms(from, "Hmm something went wrong on my end — try again in a sec!").catch(() => {});
    res.sendStatus(500);
  }
});

async function handleOnboarding(userId: string, phone: string, message: string, currentStep: string): Promise<void> {
  const { reply, nextStep, goals } = await goalOnboardingReply(message, currentStep);

  if (goals && Object.keys(goals).length > 0) {
    const fields = Object.entries(goals)
      .map(([k, v]) => `${k} = $${k}`)
      .join(', ');

    const setClauses = Object.keys(goals).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = [userId, ...Object.values(goals)];

    await db.query(
      `UPDATE user_settings SET ${setClauses}, updated_at = NOW() WHERE user_id = $1`,
      values
    );
  }

  await db.query(
    `UPDATE user_settings SET onboarding_step = $1, updated_at = NOW() WHERE user_id = $2`,
    [nextStep, userId]
  );

  await sendSms(phone, reply);
}

export default router;
