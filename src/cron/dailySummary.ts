import cron from 'node-cron';
import { db } from '../db/client';
import { sendDailySummaries } from '../services/summary';
import { generateReminder } from '../services/claude';
import { sendSms } from '../services/twilio';

// Runs every minute — checks which users have a summary or reminder due right now
export function scheduleJobs(): void {
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const hhmm = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

    await Promise.allSettled([
      fireDueSummaries(hhmm),
      fireDueReminders(hhmm),
    ]);
  });
}

async function fireDueSummaries(utcHHMM: string): Promise<void> {
  // Compare summary_time against the current time in each user's own timezone
  const { rows } = await db.query<{ user_id: string }>(
    `SELECT us.user_id
     FROM user_settings us
     JOIN subscriptions s ON s.user_id = us.user_id
     JOIN users u ON u.id = us.user_id
     WHERE s.status = 'active'
       AND to_char(us.summary_time, 'HH24:MI') = to_char(NOW() AT TIME ZONE u.timezone, 'HH24:MI')`,
    []
  );

  if (rows.length > 0) {
    console.log(`[cron] Sending EOD summaries to ${rows.length} user(s)`);
    await sendDailySummaries(rows.map(r => r.user_id));
  }
}

async function fireDueReminders(utcHHMM: string): Promise<void> {
  const { rows } = await db.query<{ user_id: string; phone: string; timezone: string; reminders: { label: string; time: string; enabled: boolean }[] }>(
    `SELECT u.id AS user_id, u.phone, u.timezone, us.reminders
     FROM users u
     JOIN user_settings us ON us.user_id = u.id
     JOIN subscriptions s ON s.user_id = u.id
     WHERE s.status = 'active'
       AND s.plan = 'premium'
       AND jsonb_array_length(us.reminders) > 0`
  );

  for (const row of rows) {
    const localHHMM = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: row.timezone });
    const due = (row.reminders ?? []).filter(r => r.enabled && r.time === localHHMM);
    for (const reminder of due) {
      try {
        const msg = await generateReminder(reminder.label);
        await sendSms(row.phone, msg);
      } catch (err) {
        console.error(`[cron] Reminder failed for user ${row.user_id}:`, err);
      }
    }
  }
}
