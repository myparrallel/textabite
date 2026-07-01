import { Router, Request, Response } from 'express';

const router = Router();

router.get('/features', (_req: Request, res: Response) => {
  res.type('html').send(featuresPage());
});

export default router;

function featuresPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Features – Textabite</title>
  <meta name="description" content="See everything Textabite can do. Log meals by text or photo, track nutrition, set goals, get daily summaries, and view your history in a clean dashboard.">
  <meta property="og:title" content="Textabite Features – The nutrition tracker that lives in your texts">
  <meta property="og:description" content="Log meals by text or photo. Instant nutrition breakdowns. Daily morning summaries. Goal tracking. All from your phone's messaging app.">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --bg: #FFFDE7; --bg2: #FFFFFF; --ink: #2E2A14; --accent: #FFE066; --accent2: #C9A227; --muted: #8A8060; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg2); color: var(--ink); }
    nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 48px; background: var(--bg2); border-bottom: 1px solid #e8e4dd; position: sticky; top: 0; z-index: 10; }
    .logo { font-size: 1.5rem; font-weight: 800; color: var(--ink); text-decoration: none; letter-spacing: -0.5px; }
    nav .nav-links { display: flex; gap: 32px; align-items: center; }
    nav .nav-links a { text-decoration: none; color: var(--muted); font-size: 0.95rem; font-weight: 500; }
    nav .nav-links a.cta { background: var(--accent2); color: #fff; padding: 10px 20px; border-radius: 8px; }
    @media (max-width: 640px) { nav { padding: 16px 20px; } .hide-mobile { display: none; } }

    .hero { background: var(--bg); padding: 80px 24px 64px; text-align: center; }
    .section-label { font-size: 0.78rem; font-weight: 700; color: var(--accent2); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .hero h1 { font-size: clamp(2rem, 4vw, 3.2rem); font-weight: 900; letter-spacing: -1px; margin-bottom: 16px; }
    .hero h1 span { color: var(--accent2); }
    .hero p { font-size: 1.1rem; color: var(--muted); max-width: 520px; margin: 0 auto 36px; line-height: 1.7; }
    .hero-cta { display: inline-block; padding: 14px 32px; background: var(--accent2); color: #fff; border-radius: 10px; font-size: 1rem; font-weight: 700; text-decoration: none; }

    /* FEATURE SECTIONS */
    .feature-section { padding: 96px 24px; }
    .feature-section:nth-child(even) { background: var(--bg); }
    .feature-inner { max-width: 1000px; margin: 0 auto; display: flex; gap: 64px; align-items: center; flex-wrap: wrap; justify-content: center; }
    .feature-inner.reverse { flex-direction: row-reverse; }
    .feature-text { flex: 1; min-width: 280px; max-width: 420px; }
    .feature-text h2 { font-size: 2rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 16px; }
    .feature-text p { color: var(--muted); line-height: 1.7; margin-bottom: 12px; }
    .feature-list { list-style: none; margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
    .feature-list li { display: flex; gap: 10px; align-items: flex-start; font-size: 0.95rem; color: var(--ink); }
    .feature-list li::before { content: "✓"; color: var(--accent2); font-weight: 800; flex-shrink: 0; margin-top: 1px; }
    .mockup { flex-shrink: 0; }

    /* PHONE MOCKUP */
    .phone { background: #1a1a1a; border-radius: 36px; padding: 14px; width: 270px; box-shadow: 0 24px 64px rgba(0,0,0,0.2); }
    .phone-screen { background: #f2f2f7; border-radius: 24px; overflow: hidden; }
    .phone-header { background: #fff; padding: 12px 16px 10px; text-align: center; border-bottom: 1px solid #e5e5ea; }
    .phone-header .contact { font-weight: 600; font-size: 0.88rem; }
    .phone-header .number { font-size: 0.72rem; color: #8e8e93; }
    .phone-msgs { padding: 14px 10px; display: flex; flex-direction: column; gap: 7px; }
    .pmsg { padding: 9px 12px; border-radius: 18px; font-size: 0.78rem; line-height: 1.4; max-width: 200px; }
    .pmsg.sent { background: #34c759; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
    .pmsg.recv { background: #fff; color: #111; align-self: flex-start; border-bottom-left-radius: 4px; }

    /* DASHBOARD MOCKUP */
    .dash-mockup { width: 100%; max-width: 540px; background: #fff; border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.1); border: 1px solid #e8e4dd; overflow: hidden; }
    .dash-topbar { padding: 14px 20px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
    .dash-topbar span { font-weight: 800; font-size: 1rem; color: var(--ink); }
    .dash-body { padding: 20px; }
    .dash-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .dash-stat { background: #f9fafb; border-radius: 10px; padding: 14px; border: 1px solid #f0f0f0; }
    .dash-stat .lbl { font-size: 0.7rem; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .dash-stat .val { font-size: 1.4rem; font-weight: 800; color: #111; }
    .dash-stat .unit { font-size: 0.75rem; color: #9ca3af; }
    .progress-bar { height: 6px; background: #f0f0f0; border-radius: 999px; overflow: hidden; margin-top: 8px; }
    .progress-fill { height: 100%; background: var(--accent2); border-radius: 999px; }
    .dash-meals { background: #fff; border: 1px solid #f0f0f0; border-radius: 10px; overflow: hidden; }
    .dash-meal-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #f9fafb; font-size: 0.82rem; }
    .dash-meal-row:last-child { border-bottom: none; }
    .dash-meal-name { color: #374151; }
    .dash-meal-cal { color: var(--accent2); font-weight: 700; }

    /* GOAL MOCKUP */
    .goal-mockup { width: 100%; max-width: 440px; background: #fff; border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.1); border: 1px solid #e8e4dd; overflow: hidden; }
    .goal-header { padding: 16px 20px; border-bottom: 1px solid #f0f0f0; font-weight: 700; font-size: 1rem; }
    .goal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
    .goal-row { display: flex; justify-content: space-between; align-items: center; }
    .goal-label { font-size: 0.88rem; color: #374151; }
    .goal-val { font-size: 0.88rem; font-weight: 700; color: var(--ink); }
    .goal-bar-wrap { margin-top: 6px; }
    .goal-bar-label { display: flex; justify-content: space-between; font-size: 0.72rem; color: #9ca3af; margin-bottom: 4px; }
    .goal-bar { height: 6px; background: #f0f0f0; border-radius: 999px; overflow: hidden; }
    .goal-fill { height: 100%; border-radius: 999px; }

    /* REMINDER MOCKUP */
    .reminder-phone .pmsg.reminder { background: #FFFDE7; border: 1px solid #FFE066; color: var(--ink); align-self: flex-start; border-bottom-left-radius: 4px; }

    /* SUMMARY MOCKUP */
    .summary-card { width: 100%; max-width: 320px; background: #fff; border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.1); border: 1px solid #e8e4dd; overflow: hidden; }
    .summary-header { background: var(--bg); padding: 16px 20px; border-bottom: 1px solid #e8e4dd; }
    .summary-header .time { font-size: 0.75rem; color: var(--muted); }
    .summary-header .from { font-weight: 700; font-size: 0.9rem; color: var(--ink); }
    .summary-body { padding: 20px; font-size: 0.88rem; color: var(--ink); line-height: 1.7; }

    /* CTA SECTION */
    .cta-section { background: var(--ink); padding: 96px 24px; text-align: center; }
    .cta-section h2 { font-size: 2.2rem; font-weight: 900; color: #fff; letter-spacing: -0.5px; margin-bottom: 16px; }
    .cta-section p { color: var(--muted); margin-bottom: 36px; font-size: 1.05rem; }
    .cta-section a { display: inline-block; padding: 15px 36px; background: var(--accent2); color: #fff; border-radius: 10px; font-size: 1rem; font-weight: 700; text-decoration: none; }

    footer { background: var(--ink); color: var(--muted); padding: 32px 48px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; border-top: 1px solid #3a3520; }
    footer a { color: var(--muted); text-decoration: none; font-size: 0.85rem; }
    footer a:hover { color: #fff; }
  </style>
</head>
<body>

<nav>
  <a href="/" class="logo">Textabite</a>
  <div class="nav-links">
    <a href="/#how" class="hide-mobile">How it works</a>
    <a href="/#pricing" class="hide-mobile">Pricing</a>
    <a href="/login" class="hide-mobile">Log in</a>
    <a href="/#pricing" class="cta">Join waitlist</a>
  </div>
</nav>

<!-- HERO -->
<div class="hero">
  <p class="section-label">Full feature tour</p>
  <h1>Everything Textabite can do<br><span>in one place</span></h1>
  <p>No app. No barcode scanning. No friction. Just text your meals and let Textabite handle the rest.</p>
  <a href="/#pricing" class="hero-cta">Join the waitlist →</a>
</div>

<!-- FEATURE 1: LOG BY TEXT -->
<section class="feature-section">
  <div class="feature-inner">
    <div class="feature-text">
      <p class="section-label">Feature 01</p>
      <h2>Log any meal in seconds</h2>
      <p>Just describe what you ate in plain English — the same way you'd text a friend. No searching a database, no portion size dropdowns, no barcode scanning.</p>
      <p>Works with restaurant meals, home cooking, coffee shop orders, snacks — anything.</p>
      <ul class="feature-list">
        <li>Unlimited meal logging</li>
        <li>Instant calories, protein, carbs, and fat</li>
        <li>AI understands natural language</li>
        <li>Delete or correct any entry by text</li>
      </ul>
    </div>
    <div class="mockup">
      <div class="phone">
        <div class="phone-screen">
          <div class="phone-header">
            <div class="contact">Textabite</div>
            <div class="number">(573) GO-HEALTH</div>
          </div>
          <div class="phone-msgs">
            <div class="pmsg sent">grilled chicken burrito bowl, extra guac</div>
            <div class="pmsg recv">Logged: Grilled chicken burrito bowl with guac — 720 cal | 52g protein | 68g carbs | 24g fat 🌯 Nice protein hit!</div>
            <div class="pmsg sent">actually it was a small, no rice</div>
            <div class="pmsg recv">Updated! Grilled chicken burrito bowl (small, no rice) — 480 cal | 42g protein | 28g carbs | 20g fat ✓</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- FEATURE 2: LOG BY PHOTO -->
<section class="feature-section">
  <div class="feature-inner reverse">
    <div class="feature-text">
      <p class="section-label">Feature 02</p>
      <h2>Don't feel like typing? Snap a photo 📸</h2>
      <p>Send a photo of your meal and our AI identifies what's on your plate automatically. No typing required.</p>
      <p>Works great for restaurant meals, home cooking, and anything you don't know the name of.</p>
      <ul class="feature-list">
        <li>AI-powered food recognition</li>
        <li>Works with any meal photo</li>
        <li>Estimates nutrition from the image</li>
        <li>Ask it to describe what it sees</li>
      </ul>
    </div>
    <div class="mockup">
      <div class="phone">
        <div class="phone-screen">
          <div class="phone-header">
            <div class="contact">Textabite</div>
            <div class="number">(573) GO-HEALTH</div>
          </div>
          <div class="phone-msgs">
            <div class="pmsg sent" style="background:#e5e5ea;color:#111;">📷 [photo of pasta dish]</div>
            <div class="pmsg recv">Looks like penne arrabbiata with a side salad! Logged — 580 cal | 18g protein | 82g carbs | 14g fat 🍝</div>
            <div class="pmsg sent">should i eat the bread too</div>
            <div class="pmsg recv">You've had 1,480 cal today vs your 2,000 goal. Bread's ~150 cal — totally fine, go for it 😄</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- FEATURE 3: DAILY SUMMARY -->
<section class="feature-section">
  <div class="feature-inner">
    <div class="feature-text">
      <p class="section-label">Feature 03</p>
      <h2>Wake up to your daily summary ☀️</h2>
      <p>Every morning you get a full breakdown of yesterday — calories, macros, streak, and a note on how you did. Honest but never harsh.</p>
      <p>Premium subscribers can set a custom delivery time from their dashboard.</p>
      <ul class="feature-list">
        <li>Daily nutrition recap via SMS</li>
        <li>Streak tracking to keep momentum</li>
        <li>Goal-aware feedback (Premium)</li>
        <li>Custom summary time (Premium)</li>
      </ul>
    </div>
    <div class="mockup">
      <div class="summary-card">
        <div class="summary-header">
          <div class="time">Today, 8:00 AM</div>
          <div class="from">Textabite · (573) GO-HEALTH</div>
        </div>
        <div class="summary-body">
          ☀️ Good morning! Here's yesterday:<br><br>
          🔥 <strong>12-day streak</strong> — incredible!<br><br>
          📊 1,840 cal · 112g protein · 198g carbs · 64g fat<br><br>
          You crushed your protein goal and came in 160 cal under budget. That's consistency. Keep it up today.
        </div>
      </div>
    </div>
  </div>
</section>

<!-- FEATURE 4: GOAL TRACKING -->
<section class="feature-section">
  <div class="feature-inner reverse">
    <div class="feature-text">
      <p class="section-label">Feature 04 · Premium</p>
      <h2>Set goals. Get held accountable.</h2>
      <p>Set your nutrition goals by text or in your dashboard. Every meal log comes back with goal-aware feedback — how you're tracking, what you have left, whether to slow down or keep going.</p>
      <ul class="feature-list">
        <li>Preset goals: lose weight, maintain, build muscle</li>
        <li>Custom calorie and macro targets</li>
        <li>Per-meal feedback against your goals</li>
        <li>"Should I eat this?" food advisor</li>
      </ul>
    </div>
    <div class="mockup">
      <div class="goal-mockup">
        <div class="goal-header">🎯 Your nutrition goals</div>
        <div class="goal-body">
          <div>
            <div class="goal-row"><span class="goal-label">Daily calories</span><span class="goal-val">2,000 cal</span></div>
            <div class="goal-bar-wrap">
              <div class="goal-bar-label"><span>Today: 1,240 cal</span><span>62%</span></div>
              <div class="goal-bar"><div class="goal-fill" style="width:62%;background:#C9A227;"></div></div>
            </div>
          </div>
          <div>
            <div class="goal-row"><span class="goal-label">Protein</span><span class="goal-val">150g</span></div>
            <div class="goal-bar-wrap">
              <div class="goal-bar-label"><span>Today: 87g</span><span>58%</span></div>
              <div class="goal-bar"><div class="goal-fill" style="width:58%;background:#34c759;"></div></div>
            </div>
          </div>
          <div>
            <div class="goal-row"><span class="goal-label">Carbs</span><span class="goal-val">200g</span></div>
            <div class="goal-bar-wrap">
              <div class="goal-bar-label"><span>Today: 142g</span><span>71%</span></div>
              <div class="goal-bar"><div class="goal-fill" style="width:71%;background:#3b82f6;"></div></div>
            </div>
          </div>
          <div>
            <div class="goal-row"><span class="goal-label">Fat</span><span class="goal-val">65g</span></div>
            <div class="goal-bar-wrap">
              <div class="goal-bar-label"><span>Today: 38g</span><span>58%</span></div>
              <div class="goal-bar"><div class="goal-fill" style="width:58%;background:#f59e0b;"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- FEATURE 5: REMINDERS -->
<section class="feature-section">
  <div class="feature-inner">
    <div class="feature-text">
      <p class="section-label">Feature 05 · Premium</p>
      <h2>Friendly reminders that don't feel robotic</h2>
      <p>Set meal reminders for breakfast, lunch, dinner, or snacks. We'll check in like a friend — casual, warm, never preachy. Just enough to keep you on track.</p>
      <ul class="feature-list">
        <li>Custom reminder times for each meal</li>
        <li>AI-generated messages, never the same twice</li>
        <li>Reply directly to log what you ate</li>
        <li>Toggle on/off anytime from dashboard</li>
      </ul>
    </div>
    <div class="mockup reminder-phone">
      <div class="phone">
        <div class="phone-screen">
          <div class="phone-header">
            <div class="contact">Textabite</div>
            <div class="number">(573) GO-HEALTH</div>
          </div>
          <div class="phone-msgs">
            <div class="pmsg reminder">Hey! 🍽️ Lunch time — what are you eating? Even a quick "salad" works, I'll handle the rest.</div>
            <div class="pmsg sent">leftover salmon and rice from last night</div>
            <div class="pmsg recv">Logged: Salmon with rice — 520 cal | 44g protein | 48g carbs | 12g fat 🐟 Solid lunch — you're sitting at 1,080 cal for the day.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- FEATURE 6: DASHBOARD -->
<section class="feature-section">
  <div class="feature-inner reverse">
    <div class="feature-text">
      <p class="section-label">Feature 06</p>
      <h2>Your full picture, one login away</h2>
      <p>The dashboard gives you a deeper view when you want it — meal history, calorie progress, streak, and settings. Everything syncs automatically from your texts.</p>
      <ul class="feature-list">
        <li>Today's stats at a glance</li>
        <li>Full meal history with macros</li>
        <li>Calorie progress bar toward your goal</li>
        <li>Logging streak to keep momentum</li>
        <li>Set goals, reminders, and preferences</li>
      </ul>
    </div>
    <div class="mockup">
      <div class="dash-mockup">
        <div class="dash-topbar">
          <span>Textabite</span>
          <span style="background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:999px;font-size:0.75rem;font-weight:700;">⭐ Premium</span>
        </div>
        <div class="dash-body">
          <div class="dash-stats">
            <div class="dash-stat">
              <div class="lbl">Today's calories</div>
              <div class="val">1,240<span class="unit"> cal</span></div>
              <div class="progress-bar"><div class="progress-fill" style="width:62%;"></div></div>
            </div>
            <div class="dash-stat">
              <div class="lbl">Protein</div>
              <div class="val">87<span class="unit">g</span></div>
            </div>
            <div class="dash-stat">
              <div class="lbl">Meals today</div>
              <div class="val">3</div>
            </div>
            <div class="dash-stat">
              <div class="lbl">Streak</div>
              <div class="val">12<span class="unit"> days</span></div>
              <div style="font-size:0.72rem;color:#C9A227;margin-top:4px;">🔥 Keep it up!</div>
            </div>
          </div>
          <div class="dash-meals">
            <div class="dash-meal-row"><span class="dash-meal-name">2 scrambled eggs & toast</span><span class="dash-meal-cal">320 cal</span></div>
            <div class="dash-meal-row"><span class="dash-meal-name">Oat milk latte</span><span class="dash-meal-cal">180 cal</span></div>
            <div class="dash-meal-row"><span class="dash-meal-name">Salmon & rice</span><span class="dash-meal-cal">520 cal</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta-section">
  <h2>Set your goals.<br>We'll keep you honest.</h2>
  <p>No app to download. No barcode scanning. Just text (573) GO-HEALTH.</p>
  <a href="/#pricing">Join the waitlist →</a>
</section>

<footer>
  <a href="/" style="font-weight:800;font-size:1.1rem;color:#fff;">Textabite</a>
  <div style="display:flex;gap:24px;">
    <a href="/privacy">Privacy Policy</a>
    <a href="/terms">Terms of Service</a>
    <a href="/">← Back to home</a>
  </div>
</footer>

</body>
</html>`;
}
