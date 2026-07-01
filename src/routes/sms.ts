import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { db } from '../db/client';
import {
  detectIntent,
  parseMeal,
  NeedsDescriptionError,
  parseWater,
  parseCorrection,
  formatWeeklySummary,
  calcStreak,
  mealConfirmationReply,
  shouldIEatThis,
  handleReminderReply,
  goalOnboardingReply,
  helpReply,
  todaySummaryReply,
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
    const { rows: userRows } = await db.query<{ id: string; phone: string; timezone: string }>(
      `INSERT INTO users (phone) VALUES ($1)
       ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
       RETURNING id, phone, timezone`,
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

        let nutrition;
        try {
          nutrition = await parseMeal(mealText, mediaUrl);
        } catch (err) {
          if (err instanceof NeedsDescriptionError) {
            await sendSms(from, "Looks homemade! What's in it? Just a rough guess is fine 😊");
            res.sendStatus(204);
            return;
          }
          throw err;
        }

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

        const { rows: insertedRows } = await db.query<{ id: string }>(
          `INSERT INTO meals (user_id, raw_text, calories, protein_g, carbs_g, fat_g, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [user.id, mealText, nutrition.calories, nutrition.protein_g, nutrition.carbs_g, nutrition.fat_g, nutrition.description]
        );

        const reply = await mealConfirmationReply(
          nutrition,
          settings.response_style ?? 'detailed',
          plan === 'premium' ? goals : undefined,
          plan === 'premium' ? todayTotals : undefined
        );

        await sendSms(from, reply);

        // First meal ever — send a tip about what else they can do
        const { rows: mealCount } = await db.query<{ count: string }>(
          `SELECT COUNT(*) FROM meals WHERE user_id = $1`,
          [user.id]
        );
        if (parseInt(mealCount[0].count) === 1) {
          const twilioNumber = process.env.TWILIO_PHONE_NUMBER ?? 'this number';
          setTimeout(async () => {
            await sendSms(from, `💡 Pro tip: Save ${twilioNumber} as "Textabite" in your contacts so you always know it's me! You can also text "how'd I do today?", snap a photo of a meal, or text "help" to see everything I can do.`);
          }, 3000);
        }

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

      case 'log_water': {
        const { amount_ml, reply: waterReply } = await parseWater(body);
        await db.query(
          `INSERT INTO water_logs (user_id, amount_ml) VALUES ($1, $2)`,
          [user.id, amount_ml]
        );
        const { rows: todayWater } = await db.query<{ total_ml: number }>(
          `SELECT COALESCE(SUM(amount_ml), 0)::int AS total_ml FROM water_logs WHERE user_id = $1 AND logged_at >= NOW()::date`,
          [user.id]
        );
        const totalOz = Math.round(todayWater[0].total_ml / 30);
        await sendSms(from, `${waterReply} You've had ~${totalOz}oz today 💧`);
        break;
      }

      case 'delete_meal': {
        const { rows: lastMeal } = await db.query<{ id: string; description: string }>(
          `SELECT id, description FROM meals WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1`,
          [user.id]
        );
        if (lastMeal.length === 0) {
          await sendSms(from, "No meals to delete! You haven't logged anything yet 🤷");
        } else {
          await db.query(`DELETE FROM meals WHERE id = $1`, [lastMeal[0].id]);
          await sendSms(from, `Deleted "${lastMeal[0].description}" ✓ All good!`);
        }
        break;
      }

      case 'correct_meal': {
        const { rows: lastMeal } = await db.query<{ id: string; description: string; raw_text: string }>(
          `SELECT id, description, raw_text FROM meals WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1`,
          [user.id]
        );
        if (lastMeal.length === 0) {
          await sendSms(from, "No meal to correct — you haven't logged anything yet!");
        } else {
          const correctedText = await parseCorrection(body, lastMeal[0].description);
          const nutrition = await parseMeal(correctedText);
          await db.query(
            `UPDATE meals SET raw_text=$1, calories=$2, protein_g=$3, carbs_g=$4, fat_g=$5, description=$6 WHERE id=$7`,
            [correctedText, nutrition.calories, nutrition.protein_g, nutrition.carbs_g, nutrition.fat_g, nutrition.description, lastMeal[0].id]
          );
          await sendSms(from, `Updated! "${nutrition.description}" — ${nutrition.calories} cal, ${nutrition.protein_g}g protein ✓`);
        }
        break;
      }

      case 'today_summary': {
        const { rows: todayMeals } = await db.query<{ description: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }>(
          `SELECT description, calories, protein_g, carbs_g, fat_g
           FROM meals
           WHERE user_id = $1
             AND logged_at >= (NOW() AT TIME ZONE $2)::date
           ORDER BY logged_at`,
          [user.id, user.timezone ?? 'America/New_York']
        );
        const goals: UserGoals = {
          calorie_goal: settings.calorie_goal,
          protein_goal_g: settings.protein_goal_g,
        };
        const reply = await todaySummaryReply(todayMeals, settings.calorie_goal ? goals : undefined);
        await sendSms(from, reply);
        break;
      }

      case 'weekly_summary': {
        const { rows: weekMeals } = await db.query<{ date: string; calories: number; protein_g: number; meals: number }>(
          `SELECT
             DATE(logged_at AT TIME ZONE $2)::text AS date,
             COALESCE(SUM(calories), 0)::int AS calories,
             COALESCE(SUM(protein_g), 0)::numeric AS protein_g,
             COUNT(*)::int AS meals
           FROM meals
           WHERE user_id = $1 AND logged_at >= NOW() - INTERVAL '7 days'
           GROUP BY DATE(logged_at AT TIME ZONE $2)
           ORDER BY date`,
          [user.id, user.timezone ?? 'America/New_York']
        );
        const { rows: streakRows } = await db.query<{ date: string }>(
          `SELECT DISTINCT DATE(logged_at AT TIME ZONE $2)::text AS date FROM meals WHERE user_id = $1 ORDER BY date DESC LIMIT 30`,
          [user.id, user.timezone ?? 'America/New_York']
        );
        const streak = calcStreak(streakRows.map(r => r.date));
        const totalCal = weekMeals.reduce((s, d) => s + d.calories, 0);
        const avgCal = weekMeals.length > 0 ? Math.round(totalCal / weekMeals.length) : 0;
        const goals: UserGoals | undefined = settings.calorie_goal ? {
          calorie_goal: settings.calorie_goal,
          protein_goal_g: settings.protein_goal_g,
        } : undefined;
        const summary = await formatWeeklySummary({ days: weekMeals, totalCalories: totalCal, avgCalories: avgCal, streak, goals });
        await sendSms(from, summary);
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
