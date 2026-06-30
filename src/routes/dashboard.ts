import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db/client';
import { sendSetPasswordEmail } from '../services/email';

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

router.get('/login', (req: Request, res: Response) => {
  res.type('html').send(loginPage(req.query.error as string));
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const email = (req.body.email ?? '').trim().toLowerCase();
  const password = (req.body.password ?? '');

  if (!email || !password) {
    res.redirect('/login?error=missing');
    return;
  }

  const { rows } = await db.query(
    `SELECT id, password_hash FROM users WHERE email = $1`,
    [email]
  );

  if (rows.length === 0 || !rows[0].password_hash) {
    res.redirect('/login?error=invalid');
    return;
  }

  const valid = await bcrypt.compare(password, rows[0].password_hash);
  if (!valid) {
    res.redirect('/login?error=invalid');
    return;
  }

  const { rows: sessionRows } = await db.query<{ token: string }>(
    `INSERT INTO sessions (user_id) VALUES ($1) RETURNING token`,
    [rows[0].id]
  );

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `session=${sessionRows[0].token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`);
  res.redirect('/dashboard');
});

router.post('/logout', (req: Request, res: Response) => {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
  res.redirect('/login');
});

// ── Forgot password ───────────────────────────────────────────────────────────

router.get('/forgot-password', (_req: Request, res: Response) => {
  res.type('html').send(forgotPasswordPage());
});

router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const email = (req.body.email ?? '').trim().toLowerCase();
  if (email) {
    const { rows } = await db.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (rows.length > 0) {
      // Invalidate any existing unused tokens
      await db.query(`UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE`, [rows[0].id]);
      const { rows: tokenRows } = await db.query<{ token: string }>(
        `INSERT INTO password_reset_tokens (user_id) VALUES ($1) RETURNING token`,
        [rows[0].id]
      );
      sendSetPasswordEmail(email, tokenRows[0].token).catch(err =>
        console.error('Forgot-password email error:', err)
      );
    }
  }
  // Always show success to prevent email enumeration
  res.type('html').send(forgotPasswordPage('sent'));
});

// ── Set password (waitlist → active user flow) ────────────────────────────────

router.get('/set-password', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query as { token?: string };
  if (!token) { res.redirect('/login'); return; }

  const { rows } = await db.query(
    `SELECT id FROM password_reset_tokens WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
    [token]
  );
  if (rows.length === 0) {
    res.type('html').send(setPasswordPage(token, 'expired'));
    return;
  }
  res.type('html').send(setPasswordPage(token));
});

router.post('/set-password', async (req: Request, res: Response): Promise<void> => {
  const { token, password, confirm } = req.body as { token?: string; password?: string; confirm?: string };

  if (!token || !password || password.length < 8) {
    res.type('html').send(setPasswordPage(token ?? '', 'weak'));
    return;
  }
  if (password !== confirm) {
    res.type('html').send(setPasswordPage(token, 'mismatch'));
    return;
  }

  const { rows } = await db.query(
    `UPDATE password_reset_tokens SET used = TRUE
     WHERE token = $1 AND used = FALSE AND expires_at > NOW()
     RETURNING user_id`,
    [token]
  );
  if (rows.length === 0) {
    res.type('html').send(setPasswordPage(token, 'expired'));
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, rows[0].user_id]);

  const { rows: sessionRows } = await db.query<{ token: string }>(
    `INSERT INTO sessions (user_id) VALUES ($1) RETURNING token`,
    [rows[0].user_id]
  );
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `session=${sessionRows[0].token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`);
  res.redirect('/dashboard');
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get('/dashboard', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as string;

  const [userRes, settingsRes, subRes, mealsRes] = await Promise.all([
    db.query(`SELECT phone, email, timezone FROM users WHERE id = $1`, [userId]),
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

// ── HTML Templates ────────────────────────────────────────────────────────────

function loginPage(error?: string): string {
  const errorMsg = error === 'invalid' ? 'Email or password is incorrect.'
    : error === 'missing' ? 'Please enter your email and password.'
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log in – Textabite</title>
  ${sharedStyles()}
</head>
<body>
  <nav>${logo()}</nav>
  <div class="auth-wrap">
    <div class="auth-card">
      <h1>Welcome back</h1>
      <p class="sub">Log in to your Textabite dashboard.</p>
      ${errorMsg ? `<div class="auth-error">${errorMsg}</div>` : ''}
      <form action="/login" method="POST">
        <input type="email" name="email" placeholder="you@example.com" required autocomplete="email">
        <input type="password" name="password" placeholder="Password" required autocomplete="current-password">
        <button type="submit">Log in →</button>
      </form>
      <p class="back" style="margin-top:12px;"><a href="/forgot-password" style="color:#C9A227;">Forgot password?</a></p>
      <p class="back"><a href="/">← Back to home</a></p>
    </div>
  </div>
</body>
</html>`;
}

function forgotPasswordPage(state?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset password – Textabite</title>
  ${sharedStyles()}
</head>
<body>
  <nav>${logo()}</nav>
  <div class="auth-wrap">
    <div class="auth-card">
      <h1>Reset password</h1>
      ${state === 'sent'
        ? `<p class="sub">If that email has an account, we've sent a reset link. Check your inbox.</p>
           <p class="back"><a href="/login">← Back to login</a></p>`
        : `<p class="sub">Enter your email and we'll send you a link to set a new password.</p>
           <form action="/forgot-password" method="POST">
             <input type="email" name="email" placeholder="you@example.com" required autocomplete="email">
             <button type="submit">Send reset link →</button>
           </form>
           <p class="back"><a href="/login">← Back to login</a></p>`}
    </div>
  </div>
</body>
</html>`;
}

function setPasswordPage(token: string, error?: string): string {
  const errorMsg = error === 'expired' ? 'This link has expired or already been used. Contact support.'
    : error === 'weak' ? 'Password must be at least 8 characters.'
    : error === 'mismatch' ? 'Passwords do not match.'
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Set your password – Textabite</title>
  ${sharedStyles()}
</head>
<body>
  <nav>${logo()}</nav>
  <div class="auth-wrap">
    <div class="auth-card">
      <h1>Create your password</h1>
      <p class="sub">You're in. Set a password to access your dashboard anytime.</p>
      ${errorMsg ? `<div class="auth-error">${errorMsg}</div>` : ''}
      ${error === 'expired' ? '<p class="back"><a href="/">← Back to home</a></p>' : `
      <form action="/set-password" method="POST">
        <input type="hidden" name="token" value="${token}">
        <input type="password" name="password" placeholder="Password (min 8 characters)" required minlength="8" autocomplete="new-password">
        <input type="password" name="confirm" placeholder="Confirm password" required autocomplete="new-password">
        <button type="submit">Set password & go to dashboard →</button>
      </form>`}
    </div>
  </div>
</body>
</html>`;
}

function dashboardPage(
  user: { phone: string | null; email: string | null; timezone: string },
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
    .plan-badge { background: ${isPremium ? '#fef3c7' : '#FFFDE7'}; color: ${isPremium ? '#92400e' : '#C9A227'}; padding: 6px 14px; border-radius: 999px; font-size: 0.82rem; font-weight: 700; text-transform: uppercase; }
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
    .form-group input:focus, .form-group select:focus { border-color: #C9A227; box-shadow: 0 0 0 3px rgba(255,224,102,0.3); }
    .toggle-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f9fafb; }
    .toggle-row:last-child { border-bottom: none; }
    .toggle-row label { font-size: 0.95rem; color: #374151; flex: 1; }
    .toggle-row input[type=time] { padding: 6px 10px; border: 1.5px solid #e5e7eb; border-radius: 6px; font-size: 0.9rem; }
    .premium-gate { background: #fef3c7; border-radius: 10px; padding: 16px; font-size: 0.9rem; color: #92400e; margin-top: 12px; }
    .premium-gate a { color: #92400e; font-weight: 600; }
    .save-btn { background: #C9A227; color: #fff; border: none; border-radius: 8px; padding: 12px 28px; font-size: 1rem; font-weight: 700; cursor: pointer; margin-top: 8px; }
    .save-btn:hover { background: #a8871f; }
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
    <span style="font-size:0.88rem;color:#8A8060;">${user.email ?? user.phone ?? ''}</span>
    <form action="/logout" method="POST" style="margin:0;">
      <button style="background:none;border:1px solid #e5e7eb;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:0.88rem;">Log out</button>
    </form>
  </div>
</nav>

<div class="dashboard">
  <div class="dash-header">
    <h1>Your Dashboard</h1>
    <span class="plan-badge">${isPremium ? '⭐ Premium' : sub ? 'Basic' : 'No plan'}</span>
  </div>

  ${!sub ? `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:18px 24px;margin-bottom:28px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
    <div>
      <strong style="color:#92400e;">You don't have an active subscription.</strong>
      <span style="color:#92400e;font-size:0.9rem;"> Start your 14-day free trial to begin logging meals.</span>
    </div>
    <form action="/checkout" method="POST" style="margin:0;">
      <input type="hidden" name="plan" value="basic">
      <button type="submit" style="background:#C9A227;color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:0.95rem;font-weight:700;cursor:pointer;white-space:nowrap;">Subscribe →</button>
    </form>
  </div>` : ''}

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
    .logo { font-size: 1.4rem; font-weight: 800; color: #2E2A14; text-decoration: none; }
    .auth-wrap { display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 64px); padding: 24px; background: #FFFDE7; }
    .auth-card { background: #fff; border-radius: 16px; padding: 48px 40px; width: 100%; max-width: 400px; box-shadow: 0 4px 24px rgba(0,0,0,.07); }
    .auth-card h1 { font-size: 1.6rem; font-weight: 800; margin-bottom: 8px; color: #2E2A14; }
    .auth-card .sub { color: #8A8060; font-size: 0.95rem; margin-bottom: 28px; line-height: 1.5; }
    .auth-card form { display: flex; flex-direction: column; gap: 12px; }
    .auth-card input { padding: 13px 16px; border: 1.5px solid #e8e4dd; border-radius: 8px; font-size: 1rem; outline: none; }
    .auth-card input:focus { border-color: #C9A227; box-shadow: 0 0 0 3px rgba(255,224,102,0.3); }
    .auth-card button { padding: 13px; background: #C9A227; color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer; }
    .auth-card button:hover { background: #a8871f; }
    .auth-card .back { margin-top: 16px; text-align: center; font-size: 0.85rem; }
    .auth-card .back a { color: #8A8060; text-decoration: none; }
    .auth-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 8px; padding: 12px 14px; font-size: 0.88rem; margin-bottom: 16px; }
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
