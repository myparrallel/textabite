import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/client';
import { sendSms } from '../services/twilio';

const router = Router();

// ── Auth middleware ───────────────────────────────────────────────────────────

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.session;
  if (!token) { res.redirect('/login'); return; }

  const { rows } = await db.query(
    `SELECT s.user_id FROM sessions s WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  if (rows.length === 0) { res.redirect('/login'); return; }

  res.locals.userId = rows[0].user_id;
  next();
}

// ── Login ─────────────────────────────────────────────────────────────────────

router.get('/login', (_req, res) => res.type('html').send(loginPage()));

router.post('/login/send-code', async (req: Request, res: Response): Promise<void> => {
  const phone = normalizePhone((req.body.phone ?? '').trim());
  if (!phone) { res.redirect('/login?error=phone'); return; }

  const code = String(Math.floor(100000 + Math.random() * 900000));

  await db.query(
    `INSERT INTO otp_codes (phone, code) VALUES ($1, $2)`,
    [phone, code]
  );

  // DEV BYPASS: show code on screen when SMS is blocked
  if (process.env.NODE_ENV !== 'production') {
    res.redirect(`/login/verify?phone=${encodeURIComponent(phone)}&dev_code=${code}`);
    return;
  }

  await sendSms(phone, `Your Textabite login code is ${code}. Expires in 10 minutes.`);
  res.redirect(`/login/verify?phone=${encodeURIComponent(phone)}`);
});

router.get('/login/verify', (req: Request, res: Response) => {
  res.type('html').send(verifyPage(req.query.phone as string, req.query.dev_code as string));
});

router.post('/login/verify', async (req: Request, res: Response): Promise<void> => {
  const phone = normalizePhone((req.body.phone ?? '').trim());
  const code = (req.body.code ?? '').trim();

  const { rows } = await db.query(
    `UPDATE otp_codes SET used = TRUE
     WHERE phone = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
     RETURNING id`,
    [phone, code]
  );

  if (rows.length === 0) {
    res.redirect(`/login/verify?phone=${encodeURIComponent(phone)}&error=invalid`);
    return;
  }

  // Upsert user
  const { rows: userRows } = await db.query<{ id: string }>(
    `INSERT INTO users (phone) VALUES ($1) ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone RETURNING id`,
    [phone]
  );
  const userId = userRows[0].id;

  // Create session
  const { rows: sessionRows } = await db.query<{ token: string }>(
    `INSERT INTO sessions (user_id) VALUES ($1) RETURNING token`,
    [userId]
  );

  res.setHeader('Set-Cookie', `session=${sessionRows[0].token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`);
  res.redirect('/dashboard');
});

router.post('/logout', (req: Request, res: Response) => {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
  res.redirect('/login');
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get('/dashboard', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as string;

  const [userRes, settingsRes, subRes, mealsRes] = await Promise.all([
    db.query(`SELECT phone, timezone FROM users WHERE id = $1`, [userId]),
    db.query(`SELECT * FROM user_settings WHERE user_id = $1`, [userId]),
    db.query(`SELECT plan, status, current_period_end FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`, [userId]),
    db.query(
      `SELECT description, calories, protein_g, carbs_g, fat_g, logged_at
       FROM meals WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 20`,
      [userId]
    ),
  ]);

  const user = userRes.rows[0];
  const settings = settingsRes.rows[0] ?? {};
  const sub = subRes.rows[0];
  const meals = mealsRes.rows;

  res.type('html').send(dashboardPage(user, settings, sub, meals));
});

// ── Settings save ─────────────────────────────────────────────────────────────

router.post('/dashboard/settings', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as string;
  const { response_style, timezone, goal_preset, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g } = req.body;
  const summary_time = req.body.summary_time || '08:00';

  // Parse reminders from form
  const reminderLabels = ['breakfast', 'lunch', 'dinner', 'snack'];
  const reminders = reminderLabels.map(label => ({
    label,
    time: req.body[`reminder_time_${label}`] ?? '',
    enabled: req.body[`reminder_enabled_${label}`] === 'on',
  })).filter(r => r.time);

  await db.query(
    `INSERT INTO user_settings (user_id, response_style, summary_time, goal_preset, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, reminders, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       response_style = EXCLUDED.response_style,
       summary_time   = EXCLUDED.summary_time,
       goal_preset    = EXCLUDED.goal_preset,
       calorie_goal   = EXCLUDED.calorie_goal,
       protein_goal_g = EXCLUDED.protein_goal_g,
       carbs_goal_g   = EXCLUDED.carbs_goal_g,
       fat_goal_g     = EXCLUDED.fat_goal_g,
       reminders      = EXCLUDED.reminders,
       updated_at     = NOW()`,
    [userId, response_style, summary_time, goal_preset || null,
     calorie_goal || null, protein_goal_g || null, carbs_goal_g || null, fat_goal_g || null,
     JSON.stringify(reminders)]
  );

  if (timezone) {
    await db.query(`UPDATE users SET timezone = $1 WHERE id = $2`, [timezone, userId]);
  }

  res.redirect('/dashboard?saved=1');
});

export default router;

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

// ── HTML Templates ────────────────────────────────────────────────────────────

function loginPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login – Textabite</title>
  ${sharedStyles()}
</head>
<body>
  <nav>${logo()}</nav>
  <div class="auth-wrap">
    <div class="auth-card">
      <h1>Welcome back 👋</h1>
      <p class="sub">Enter your phone number and we'll text you a login code.</p>
      <form action="/login/send-code" method="POST">
        <input type="tel" name="phone" placeholder="+1 (555) 000-0000" required>
        <button type="submit">Send code →</button>
      </form>
      <p class="back"><a href="/">← Back to home</a></p>
    </div>
  </div>
</body>
</html>`;
}

function verifyPage(phone: string, devCode?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify – Textabite</title>
  ${sharedStyles()}
</head>
<body>
  <nav>${logo()}</nav>
  <div class="auth-wrap">
    <div class="auth-card">
      <h1>Check your texts 📱</h1>
      <p class="sub">We sent a 6-digit code to ${phone}.</p>
      ${devCode ? `<div style="background:#fef3c7;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:0.9rem;color:#92400e;">
        <strong>Dev mode:</strong> Your code is <strong style="font-size:1.2rem;letter-spacing:4px;">${devCode}</strong>
      </div>` : ''}
      <form action="/login/verify" method="POST">
        <input type="hidden" name="phone" value="${phone}">
        <input type="text" name="code" placeholder="000000" maxlength="6" inputmode="numeric" required autocomplete="one-time-code" ${devCode ? `value="${devCode}"` : ''}>
        <button type="submit">Verify →</button>
      </form>
      <p class="back"><a href="/login">← Try a different number</a></p>
    </div>
  </div>
</body>
</html>`;
}

function dashboardPage(
  user: { phone: string; timezone: string },
  settings: Record<string, unknown>,
  sub: { plan: string; status: string; current_period_end: Date } | undefined,
  meals: { description: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; logged_at: Date }[]
): string {
  const isPremium = sub?.plan === 'premium';
  const reminders: { label: string; time: string; enabled: boolean }[] = (settings.reminders as []) ?? [];
  const reminderMap = Object.fromEntries(reminders.map(r => [r.label, r]));

  const todayMeals = meals.filter(m => {
    const d = new Date(m.logged_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  const todayCalories = todayMeals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
  const todayProtein = todayMeals.reduce((sum, m) => sum + Number(m.protein_g ?? 0), 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard – Textabite</title>
  ${sharedStyles()}
  <style>
    .dashboard { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
    .dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 12px; }
    .dash-header h1 { font-size: 1.6rem; font-weight: 800; }
    .plan-badge { background: ${isPremium ? '#fef3c7' : '#f0fdf4'}; color: ${isPremium ? '#92400e' : '#15803d'}; padding: 6px 14px; border-radius: 999px; font-size: 0.82rem; font-weight: 700; text-transform: uppercase; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat { background: #f9fafb; border-radius: 12px; padding: 20px; border: 1px solid #f0f0f0; }
    .stat .label { font-size: 0.8rem; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .stat .value { font-size: 1.8rem; font-weight: 800; color: #111; }
    .stat .unit { font-size: 0.85rem; color: #9ca3af; }
    .section { background: #fff; border: 1px solid #f0f0f0; border-radius: 16px; padding: 28px; margin-bottom: 24px; }
    .section h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 20px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 0.85rem; font-weight: 600; color: #374151; }
    .form-group input, .form-group select { padding: 10px 14px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 0.95rem; outline: none; }
    .form-group input:focus, .form-group select:focus { border-color: #16a34a; box-shadow: 0 0 0 3px #dcfce7; }
    .toggle-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f9fafb; }
    .toggle-row:last-child { border-bottom: none; }
    .toggle-row label { font-size: 0.95rem; color: #374151; flex: 1; }
    .toggle-row input[type=time] { padding: 6px 10px; border: 1.5px solid #e5e7eb; border-radius: 6px; font-size: 0.9rem; }
    .premium-gate { background: #fef3c7; border-radius: 10px; padding: 16px; font-size: 0.9rem; color: #92400e; margin-top: 12px; }
    .premium-gate a { color: #92400e; font-weight: 600; }
    .save-btn { background: #16a34a; color: #fff; border: none; border-radius: 8px; padding: 12px 28px; font-size: 1rem; font-weight: 700; cursor: pointer; margin-top: 8px; }
    .save-btn:hover { background: #15803d; }
    .meals-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .meals-table th { text-align: left; padding: 8px 12px; font-size: 0.78rem; color: #6b7280; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #f0f0f0; }
    .meals-table td { padding: 10px 12px; border-bottom: 1px solid #f9fafb; color: #374151; }
    .meals-table tr:last-child td { border-bottom: none; }
    .saved-banner { background: #dcfce7; color: #15803d; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; font-weight: 600; font-size: 0.9rem; }
    .meals-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    @media (max-width: 600px) {
      .form-row { grid-template-columns: 1fr; }
      .dashboard { padding: 20px 16px; }
      nav { padding: 14px 20px; }
      .dash-header h1 { font-size: 1.3rem; }
      .stat .value { font-size: 1.4rem; }
      .meals-table th:nth-child(4), .meals-table td:nth-child(4),
      .meals-table th:nth-child(5), .meals-table td:nth-child(5) { display: none; }
    }
  </style>
</head>
<body>
<nav>
  ${logo()}
  <div style="display:flex;gap:16px;align-items:center;">
    <span style="font-size:0.88rem;color:#6b7280;">${user.phone}</span>
    <form action="/logout" method="POST" style="margin:0;">
      <button style="background:none;border:1px solid #e5e7eb;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:0.88rem;">Log out</button>
    </form>
  </div>
</nav>

<div class="dashboard">
  <div class="dash-header">
    <h1>Your Dashboard</h1>
    <span class="plan-badge">${isPremium ? '⭐ Premium' : 'Basic'}</span>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="label">Today's calories</div>
      <div class="value">${todayCalories}<span class="unit"> cal</span></div>
    </div>
    <div class="stat">
      <div class="label">Today's protein</div>
      <div class="value">${todayProtein.toFixed(0)}<span class="unit">g</span></div>
    </div>
    <div class="stat">
      <div class="label">Meals logged today</div>
      <div class="value">${todayMeals.length}</div>
    </div>
    ${settings.calorie_goal ? `<div class="stat">
      <div class="label">Calories remaining</div>
      <div class="value">${Math.max(0, Number(settings.calorie_goal) - todayCalories)}<span class="unit"> cal</span></div>
    </div>` : ''}
  </div>

  <form action="/dashboard/settings" method="POST">

    <!-- RESPONSE STYLE -->
    <div class="section">
      <h2>📲 SMS reply style</h2>
      <div class="form-row">
        <div class="form-group">
          <label>When I log a meal, reply with:</label>
          <select name="response_style">
            <option value="detailed" ${settings.response_style === 'detailed' ? 'selected' : ''}>Full nutrition breakdown</option>
            <option value="simple" ${settings.response_style === 'simple' ? 'selected' : ''}>Simple confirmation only</option>
          </select>
        </div>
        <div class="form-group">
          <label>EOD summary time</label>
          <input type="time" name="summary_time" value="${settings.summary_time ?? '08:00'}"
            ${!isPremium ? 'disabled title="Upgrade to Premium to customize your summary time"' : ''}>
          ${!isPremium ? '<span style="font-size:0.78rem;color:#9ca3af;">Premium feature</span>' : ''}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Timezone</label>
          <select name="timezone">
            ${timezoneOptions(user.timezone)}
          </select>
        </div>
      </div>
    </div>

    <!-- GOALS -->
    <div class="section">
      <h2>🎯 Nutrition goals</h2>
      <div class="form-row">
        <div class="form-group">
          <label>Goal preset</label>
          <select name="goal_preset" id="goal_preset" onchange="toggleCustomGoals(this.value)">
            <option value="">None</option>
            <option value="lose_weight" ${settings.goal_preset === 'lose_weight' ? 'selected' : ''}>Lose weight</option>
            <option value="maintain" ${settings.goal_preset === 'maintain' ? 'selected' : ''}>Maintain</option>
            <option value="build_muscle" ${settings.goal_preset === 'build_muscle' ? 'selected' : ''}>Build muscle</option>
            <option value="custom" ${settings.goal_preset === 'custom' ? 'selected' : ''}>Custom</option>
          </select>
        </div>
      </div>
      <div id="custom-goals" style="display:${settings.goal_preset === 'custom' || !settings.goal_preset ? 'grid' : 'none'};grid-template-columns:1fr 1fr;gap:16px;">
        <div class="form-group">
          <label>Daily calories</label>
          <input type="number" name="calorie_goal" value="${settings.calorie_goal ?? ''}" placeholder="e.g. 2000">
        </div>
        <div class="form-group">
          <label>Protein (g)</label>
          <input type="number" name="protein_goal_g" value="${settings.protein_goal_g ?? ''}" placeholder="e.g. 150">
        </div>
        <div class="form-group">
          <label>Carbs (g)</label>
          <input type="number" name="carbs_goal_g" value="${settings.carbs_goal_g ?? ''}" placeholder="e.g. 200">
        </div>
        <div class="form-group">
          <label>Fat (g)</label>
          <input type="number" name="fat_goal_g" value="${settings.fat_goal_g ?? ''}" placeholder="e.g. 65">
        </div>
      </div>
    </div>

    <!-- REMINDERS (Premium only) -->
    <div class="section">
      <h2>⏰ Meal reminders</h2>
      ${isPremium ? `
      <p style="font-size:0.88rem;color:#6b7280;margin-bottom:16px;">Set times for friendly check-ins. We'll text you like a friend asking how your meal went.</p>
      ${['breakfast', 'lunch', 'dinner', 'snack'].map(label => `
      <div class="toggle-row">
        <input type="checkbox" name="reminder_enabled_${label}" id="r_${label}" ${reminderMap[label]?.enabled ? 'checked' : ''}>
        <label for="r_${label}" style="text-transform:capitalize;">${label}</label>
        <input type="time" name="reminder_time_${label}" value="${reminderMap[label]?.time ?? ''}">
      </div>`).join('')}
      ` : `
      <div class="premium-gate">
        ⭐ Reminders are a Premium feature. <a href="/#pricing">Upgrade to Premium ($9.99/mo)</a> to get friendly meal check-ins.
      </div>`}
    </div>

    <button type="submit" class="save-btn">Save settings</button>
  </form>

  <!-- RECENT MEALS -->
  <div class="section" style="margin-top:24px;">
    <h2>🍽️ Recent meals</h2>
    ${meals.length === 0 ? '<p style="color:#9ca3af;font-size:0.9rem;">No meals logged yet. Text your first meal!</p>' : `
    <div class="meals-wrap"><table class="meals-table">
      <thead><tr><th>Meal</th><th>Cal</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>When</th></tr></thead>
      <tbody>
        ${meals.map(m => `<tr>
          <td>${m.description ?? '—'}</td>
          <td>${m.calories ?? '—'}</td>
          <td>${m.protein_g ?? '—'}g</td>
          <td>${m.carbs_g ?? '—'}g</td>
          <td>${m.fat_g ?? '—'}g</td>
          <td style="color:#9ca3af;font-size:0.82rem;">${new Date(m.logged_at).toLocaleDateString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`}
  </div>
</div>

<script>
function toggleCustomGoals(val) {
  document.getElementById('custom-goals').style.display = (val === 'custom' || val === '') ? 'grid' : 'none';
}
</script>
</body>
</html>`;
}

function sharedStyles(): string {
  return `<style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; color: #111; }
    nav { display: flex; justify-content: space-between; align-items: center; padding: 18px 40px; background: #fff; border-bottom: 1px solid #f0f0f0; position: sticky; top: 0; z-index: 10; }
    .logo { font-size: 1.4rem; font-weight: 800; color: #16a34a; text-decoration: none; }
    .auth-wrap { display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 64px); padding: 24px; }
    .auth-card { background: #fff; border-radius: 16px; padding: 48px 40px; width: 100%; max-width: 400px; box-shadow: 0 4px 24px rgba(0,0,0,.07); }
    .auth-card h1 { font-size: 1.6rem; font-weight: 800; margin-bottom: 8px; }
    .auth-card .sub { color: #6b7280; font-size: 0.95rem; margin-bottom: 28px; line-height: 1.5; }
    .auth-card form { display: flex; flex-direction: column; gap: 12px; }
    .auth-card input { padding: 13px 16px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 1rem; outline: none; }
    .auth-card input:focus { border-color: #16a34a; box-shadow: 0 0 0 3px #dcfce7; }
    .auth-card button { padding: 13px; background: #16a34a; color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer; }
    .auth-card button:hover { background: #15803d; }
    .auth-card .back { margin-top: 16px; text-align: center; font-size: 0.85rem; }
    .auth-card .back a { color: #6b7280; text-decoration: none; }
  </style>`;
}

function logo(): string {
  return `<a href="/" class="logo">Textabite</a>`;
}

function timezoneOptions(current: string): string {
  const zones = [
    ['America/New_York', 'Eastern (ET)'],
    ['America/Chicago', 'Central (CT)'],
    ['America/Denver', 'Mountain (MT)'],
    ['America/Los_Angeles', 'Pacific (PT)'],
    ['America/Anchorage', 'Alaska (AKT)'],
    ['Pacific/Honolulu', 'Hawaii (HT)'],
    ['Europe/London', 'London (GMT)'],
    ['Europe/Paris', 'Paris (CET)'],
    ['Asia/Tokyo', 'Tokyo (JST)'],
  ];
  return zones.map(([val, label]) => `<option value="${val}" ${current === val ? 'selected' : ''}>${label}</option>`).join('');
}
