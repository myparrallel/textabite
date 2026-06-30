import { db } from '../db/client';
import { formatDailySummary, UserGoals, calcStreak } from './claude';
import { sendSms } from './twilio';

export async function sendDailySummaries(userIds?: string[]): Promise<void> {
  const filter = userIds && userIds.length > 0
    ? `AND u.id = ANY($1::uuid[])`
    : '';

  const params = userIds && userIds.length > 0 ? [userIds] : [];

  const { rows: users } = await db.query<{ id: string; phone: string | null; timezone: string }>(
    `SELECT u.id, u.phone, u.timezone
     FROM users u
     JOIN subscriptions s ON s.user_id = u.id
     WHERE s.status = 'active' ${filter}`,
    params
  );

  await Promise.allSettled(users.map(user => sendSummaryForUser(user)));
}

async function sendSummaryForUser(user: { id: string; phone: string | null; timezone: string }): Promise<void> {
  if (!user.phone) return; // email-only users have no SMS channel yet
  const { rows: settingsRows } = await db.query(
    `SELECT goal_preset, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g FROM user_settings WHERE user_id = $1`,
    [user.id]
  );
  const settings = settingsRows[0];

  const { rows: meals } = await db.query<{
    description: string; calories: number; protein_g: number; carbs_g: number; fat_g: number;
  }>(
    `SELECT description, calories, protein_g, carbs_g, fat_g
     FROM meals
     WHERE user_id = $1
       AND logged_at >= (NOW() AT TIME ZONE $2)::date - interval '1 day'
       AND logged_at <  (NOW() AT TIME ZONE $2)::date
     ORDER BY logged_at`,
    [user.id, user.timezone]
  );

  if (meals.length === 0) {
    await sendSms(user.phone, "Hey! Looks like you didn't log anything yesterday 👀 No worries — just text me what you eat today and we're back on track!");
    return;
  }

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein_g: acc.protein_g + Number(m.protein_g ?? 0),
      carbs_g: acc.carbs_g + Number(m.carbs_g ?? 0),
      fat_g: acc.fat_g + Number(m.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const goals: UserGoals | undefined = settings?.calorie_goal ? {
    preset: settings.goal_preset,
    calorie_goal: settings.calorie_goal,
    protein_goal_g: settings.protein_goal_g,
    carbs_goal_g: settings.carbs_goal_g,
    fat_goal_g: settings.fat_goal_g,
  } : undefined;

  const { rows: streakRows } = await db.query<{ date: string }>(
    `SELECT DISTINCT DATE(logged_at AT TIME ZONE $2)::text AS date FROM meals WHERE user_id = $1 ORDER BY date DESC LIMIT 30`,
    [user.id, user.timezone]
  );
  const streak = calcStreak(streakRows.map(r => r.date));

  const summary = await formatDailySummary({ meals, totals, goals, streak });
  await sendSms(user.phone, summary);
}
