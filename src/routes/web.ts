import { Router, Request, Response } from 'express';
import Stripe from 'stripe';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const APP_URL = process.env.APP_URL!;

router.get('/', (_req: Request, res: Response) => {
  res.type('html').send(landingPage());
});

router.post('/checkout', async (req: Request, res: Response): Promise<void> => {
  const phone: string = (req.body.phone ?? '').trim();
  const plan: string = (req.body.plan ?? 'basic').trim();

  if (!phone) {
    res.redirect('/?error=phone');
    return;
  }

  const priceId = plan === 'premium'
    ? process.env.STRIPE_PRICE_ID_PREMIUM!
    : process.env.STRIPE_PRICE_ID_BASIC!;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      phone_number_collection: { enabled: true },
      metadata: { phone, plan },
      subscription_data: { trial_period_days: 14 },
      success_url: `${APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/cancel`,
    });

    res.redirect(303, session.url!);
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.redirect('/?error=checkout');
  }
});

router.get('/success', (_req: Request, res: Response) => {
  res.type('html').send(successPage());
});

router.get('/cancel', (_req: Request, res: Response) => {
  res.type('html').send(cancelPage());
});

export default router;

// ── HTML templates ────────────────────────────────────────────────────────────

function landingPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Textabite – Track meals by text</title>
  <style>
    :root {
      --bg: #FFFDE7; --bg2: #FFFFFF; --ink: #2E2A14;
      --accent: #FFE066; --accent2: #C9A227; --muted: #8A8060;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--ink); }

    /* NAV */
    nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 48px; background: var(--bg2); border-bottom: 1px solid #e8e4dd; position: sticky; top: 0; z-index: 10; }
    nav .logo { font-size: 1.5rem; font-weight: 800; color: var(--ink); letter-spacing: -0.5px; }
    nav .nav-links { display: flex; gap: 32px; align-items: center; }
    nav .nav-links a { text-decoration: none; color: var(--muted); font-size: 0.95rem; font-weight: 500; }
    nav .nav-links a.cta { background: var(--accent2); color: #fff; padding: 10px 20px; border-radius: 8px; }
    nav .nav-links a.cta:hover { background: #a8871f; }
    nav .nav-links a.login { color: var(--ink); font-weight: 600; }
    @media (max-width: 640px) {
      nav { padding: 16px 20px; }
      nav .nav-links .hide-mobile { display: none; }
      .comp-row .feature { font-size: 0.8rem; }
    }

    /* HERO */
    .hero { background: var(--bg); padding: 100px 24px 80px; text-align: center; }
    .hero .badge { display: inline-block; background: var(--accent); color: var(--ink); font-size: 0.8rem; font-weight: 600; padding: 6px 14px; border-radius: 999px; margin-bottom: 24px; letter-spacing: 0.5px; text-transform: uppercase; }
    .hero h1 { font-size: clamp(2.4rem, 5vw, 4rem); font-weight: 900; line-height: 1.1; margin-bottom: 20px; letter-spacing: -1.5px; color: var(--ink); }
    .hero h1 span { color: var(--accent2); }
    .hero p { font-size: 1.2rem; color: var(--muted); max-width: 540px; margin: 0 auto 40px; line-height: 1.7; }
    .hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .btn-hero-primary { padding: 15px 32px; background: var(--accent2); color: #fff; border-radius: 10px; font-size: 1rem; font-weight: 700; text-decoration: none; border: none; cursor: pointer; }
    .btn-hero-primary:hover { background: #a8871f; }
    .btn-hero-secondary { padding: 15px 28px; background: var(--bg2); color: var(--ink); border: 1.5px solid #e8e4dd; border-radius: 10px; font-size: 1rem; font-weight: 600; text-decoration: none; cursor: pointer; }
    .btn-hero-secondary:hover { border-color: var(--muted); }
    /* DEMO MODAL */
    .demo-modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; align-items: center; justify-content: center; padding: 16px; }
    .demo-modal-overlay.open { display: flex; }
    .demo-modal { background: #fff; border-radius: 20px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 60px rgba(0,0,0,0.2); }
    .demo-modal-header { padding: 24px 24px 0; display: flex; justify-content: space-between; align-items: center; }
    .demo-modal-header h3 { font-size: 1.1rem; font-weight: 700; }
    .demo-modal-close { background: none; border: none; font-size: 1.4rem; cursor: pointer; color: var(--muted); line-height: 1; }
    .demo-email-screen { padding: 24px; }
    .demo-email-screen p { color: var(--muted); font-size: 0.9rem; margin-bottom: 16px; line-height: 1.5; }
    .demo-email-screen input { width: 100%; padding: 12px 14px; border: 1.5px solid #e8e4dd; border-radius: 8px; font-size: 1rem; outline: none; margin-bottom: 10px; }
    .demo-email-screen input:focus { border-color: var(--accent2); }
    .demo-email-screen button { width: 100%; padding: 13px; background: var(--accent2); color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer; }
    .demo-chat-screen { display: none; flex-direction: column; height: 480px; }
    .demo-chat-screen.active { display: flex; }
    .demo-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: var(--bg); }
    .demo-msg { max-width: 80%; padding: 10px 14px; border-radius: 14px; font-size: 0.88rem; line-height: 1.5; }
    .demo-msg.ai { background: var(--bg2); border: 1px solid #e8e4dd; align-self: flex-start; color: var(--ink); }
    .demo-msg.user { background: var(--accent2); color: #fff; align-self: flex-end; }
    .demo-input-row { padding: 12px 16px; border-top: 1px solid #e8e4dd; display: flex; gap: 8px; }
    .demo-input-row input { flex: 1; padding: 10px 14px; border: 1.5px solid #e8e4dd; border-radius: 8px; font-size: 0.9rem; outline: none; }
    .demo-input-row input:focus { border-color: var(--accent2); }
    .demo-input-row button { padding: 10px 16px; background: var(--accent2); color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.9rem; }
    .demo-signup-banner { margin: 12px 16px; padding: 14px 16px; background: var(--bg); border: 1px solid var(--accent); border-radius: 10px; text-align: center; }
    .demo-signup-banner p { font-size: 0.85rem; color: var(--accent2); font-weight: 600; margin-bottom: 10px; }
    .demo-signup-banner a { display: block; padding: 11px; background: var(--accent2); color: #fff; border-radius: 8px; font-weight: 700; font-size: 0.9rem; text-decoration: none; }
    .demo-count { padding: 6px 16px; font-size: 0.75rem; color: var(--muted); text-align: right; background: var(--bg); }
    .hero-sub { margin-top: 14px; font-size: 0.85rem; color: var(--muted); display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
    .hero-sub span::before { content: "✓ "; color: var(--accent2); }

    /* TRUST BAR */
    .trust-bar { background: var(--bg2); border-top: 1px solid #e8e4dd; border-bottom: 1px solid #e8e4dd; padding: 20px 24px; display: flex; gap: 32px; justify-content: center; flex-wrap: wrap; }
    .trust-bar .trust-item { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; color: var(--muted); font-weight: 500; }
    .trust-bar .trust-item span.icon { font-size: 1.1rem; }

    /* HOW IT WORKS */
    .how { padding: 96px 24px; background: var(--bg2); }
    .section-label { text-align: center; font-size: 0.8rem; font-weight: 700; color: var(--accent2); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
    .how h2 { text-align: center; font-size: 2.2rem; font-weight: 800; margin-bottom: 64px; letter-spacing: -0.5px; }
    .steps { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; max-width: 960px; margin: 0 auto; }
    .step { flex: 1; min-width: 220px; max-width: 280px; background: var(--bg); border-radius: 16px; padding: 32px 24px; text-align: center; border: 1px solid #e8e4dd; }
    .step .step-num { display: inline-block; width: 36px; height: 36px; background: var(--accent2); color: #fff; border-radius: 50%; font-weight: 800; font-size: 1rem; line-height: 36px; margin-bottom: 16px; }
    .step .icon { font-size: 2rem; margin-bottom: 12px; }
    .step h3 { font-size: 1.05rem; font-weight: 700; margin-bottom: 8px; }
    .step p { font-size: 0.9rem; color: var(--muted); line-height: 1.6; }

    /* SMS PREVIEW */
    .preview { background: var(--bg); padding: 96px 24px; }
    .preview-inner { max-width: 960px; margin: 0 auto; display: flex; gap: 64px; align-items: center; flex-wrap: wrap; justify-content: center; }
    .preview-text { flex: 1; min-width: 280px; max-width: 420px; }
    .preview-text h2 { font-size: 2.2rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 16px; }
    .preview-text p { color: var(--muted); line-height: 1.7; margin-bottom: 12px; }
    .phone { background: #1a1a1a; border-radius: 36px; padding: 16px; width: 280px; box-shadow: 0 24px 64px rgba(0,0,0,0.2); flex-shrink: 0; }
    .phone-screen { background: #f2f2f7; border-radius: 24px; overflow: hidden; }
    .phone-header { background: #fff; padding: 14px 16px 10px; text-align: center; border-bottom: 1px solid #e5e5ea; }
    .phone-header .contact { font-weight: 600; font-size: 0.9rem; }
    .phone-header .number { font-size: 0.75rem; color: #8e8e93; }
    .phone-msgs { padding: 16px 12px; display: flex; flex-direction: column; gap: 8px; }
    .pmsg { padding: 10px 13px; border-radius: 18px; font-size: 0.8rem; line-height: 1.4; max-width: 210px; }
    .pmsg.sent { background: #34c759; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
    .pmsg.recv { background: #fff; color: #111; align-self: flex-start; border-bottom-left-radius: 4px; }
    .pmsg.summary { background: #fff; color: #111; align-self: flex-start; border-bottom-left-radius: 4px; font-size: 0.75rem; }

    /* PHOTO FEATURE */
    .photo-feature { padding: 96px 24px; background: var(--bg2); }
    .photo-inner { max-width: 800px; margin: 0 auto; text-align: center; }
    .photo-inner h2 { font-size: 2.2rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 16px; }
    .photo-inner p { color: var(--muted); max-width: 560px; margin: 0 auto 48px; line-height: 1.7; }
    .photo-steps { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    .photo-step { background: var(--bg); border-radius: 12px; padding: 24px; flex: 1; min-width: 180px; max-width: 220px; border: 1px solid #e8e4dd; }
    .photo-step .icon { font-size: 2rem; margin-bottom: 10px; }
    .photo-step p { font-size: 0.88rem; color: var(--ink); line-height: 1.5; }

    /* COMPARISON */
    .comparison { background: var(--bg); padding: 96px 24px; }
    .comparison h2 { text-align: center; font-size: 2.2rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 48px; }
    .comp-table { max-width: 700px; margin: 0 auto; background: var(--bg2); border-radius: 16px; overflow: hidden; border: 1px solid #e8e4dd; }
    .comp-row { display: grid; grid-template-columns: 2fr 1fr 1fr; padding: 16px 24px; border-bottom: 1px solid #e8e4dd; align-items: center; }
    .comp-row:last-child { border-bottom: none; }
    .comp-row.header { background: var(--bg); font-weight: 700; font-size: 0.9rem; color: var(--ink); }
    .comp-row .feature { font-size: 0.92rem; color: var(--ink); }
    .comp-row .val { text-align: center; font-size: 1rem; }
    .comp-row .val.yes { color: var(--accent2); font-weight: 700; }
    .comp-row .val.no { color: #d1d5db; }
    .comp-row .val.brand { color: var(--accent2); font-weight: 800; }

    /* TESTIMONIALS */
    .testimonials { padding: 96px 24px; background: var(--bg2); }
    .testimonials h2 { text-align: center; font-size: 2.2rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 48px; }
    .testi-grid { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; max-width: 960px; margin: 0 auto; }
    .testi { background: var(--bg); border-radius: 16px; padding: 28px; flex: 1; min-width: 260px; max-width: 300px; border: 1px solid #e8e4dd; }
    .testi .stars { color: #facc15; font-size: 1rem; margin-bottom: 12px; }
    .testi p { font-size: 0.92rem; color: var(--ink); line-height: 1.6; margin-bottom: 16px; font-style: italic; }
    .testi .author { font-size: 0.85rem; font-weight: 600; color: var(--ink); }
    .testi .role { font-size: 0.8rem; color: var(--muted); }

    /* FAQ */
    .faq { background: var(--bg); padding: 96px 24px; }
    .faq h2 { text-align: center; font-size: 2.2rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 48px; }
    .faq-list { max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .faq-item { background: var(--bg2); border-radius: 12px; padding: 24px; border: 1px solid #e8e4dd; }
    .faq-item h3 { font-size: 1rem; font-weight: 700; margin-bottom: 8px; }
    .faq-item p { font-size: 0.92rem; color: var(--muted); line-height: 1.6; }

    /* PRICING */
    .pricing { padding: 96px 24px; background: var(--bg2); text-align: center; }
    .pricing h2 { font-size: 2.2rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 8px; }
    .pricing .sub { color: var(--muted); margin-bottom: 48px; }
    .price-grid { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; max-width: 860px; margin: 0 auto; }
    .price-card { background: var(--bg2); border: 2px solid #e8e4dd; border-radius: 20px; padding: 40px 36px; flex: 1; min-width: 280px; max-width: 380px; text-align: left; position: relative; }
    .price-card.featured { border-color: var(--accent2); box-shadow: 0 8px 40px rgba(201,162,39,0.15); }
    .popular-badge { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--accent2); color: #fff; font-size: 0.78rem; font-weight: 700; padding: 4px 16px; border-radius: 999px; white-space: nowrap; }
    .plan-name { font-size: 0.85rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .price-card .amount { font-size: 3rem; font-weight: 900; color: var(--ink); letter-spacing: -2px; }
    .price-card.featured .amount { color: var(--accent2); }
    .price-card .period { font-size: 0.9rem; color: var(--muted); margin-bottom: 28px; }
    .price-card ul { list-style: none; margin-bottom: 28px; display: flex; flex-direction: column; gap: 10px; }
    .price-card ul li { font-size: 0.9rem; color: var(--ink); display: flex; gap: 10px; align-items: flex-start; }
    .price-card ul li.no { color: var(--muted); }
    .price-card ul li .check { color: var(--accent2); font-weight: 700; flex-shrink: 0; }
    .price-form { display: flex; flex-direction: column; gap: 10px; }
    .price-form input { padding: 13px 16px; border: 1.5px solid #e8e4dd; border-radius: 8px; font-size: 0.95rem; outline: none; width: 100%; }
    .price-form input:focus { border-color: var(--accent2); box-shadow: 0 0 0 3px rgba(255,224,102,0.3); }
    .btn-basic { padding: 14px; background: var(--ink); color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer; width: 100%; }
    .btn-basic:hover { background: #4a4535; }
    .btn-premium { padding: 14px; background: var(--accent2); color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer; width: 100%; }
    .btn-premium:hover { background: #a8871f; }
    .price-guarantee { margin-top: 12px; font-size: 0.8rem; color: var(--muted); text-align: center; }

    /* FOOTER */
    footer { background: var(--ink); color: var(--muted); padding: 40px 48px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
    footer .logo { color: #fff; font-weight: 800; font-size: 1.1rem; }
    footer .links { display: flex; gap: 24px; }
    footer .links a { color: var(--muted); text-decoration: none; font-size: 0.85rem; }
    footer .links a:hover { color: #fff; }
  </style>
</head>
<body>

<nav>
  <span class="logo">Textabite</span>
  <div class="nav-links">
    <a href="#how" class="hide-mobile">How it works</a>
    <a href="#pricing" class="hide-mobile">Pricing</a>
    <a href="/login" class="hide-mobile login">Log in</a>
    <a href="#faq" class="hide-mobile">FAQ</a>
    <a href="#pricing" class="cta">Join waitlist</a>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="badge">✨ No app download required</div>
  <h1>Your AI nutritionist<br><span>lives in your texts</span></h1>
  <p>Text any meal — or snap a photo — and get instant calorie and macro info. Plus a daily summary every morning. It's that simple.</p>
  <div class="hero-btns">
    <button onclick="openDemo()" class="btn-hero-primary">Try demo free →</button>
    <a href="#pricing" class="btn-hero-secondary">Join waitlist</a>
  </div>
  <div class="hero-sub">
    <span>Cancel anytime</span>
    <span>No app to download</span>
    <span>Works on any phone</span>
  </div>
</section>

<!-- TRUST BAR -->
<div class="trust-bar">
  <div class="trust-item"><span class="icon">🔒</span> Secured by Stripe</div>
  <div class="trust-item"><span class="icon">✅</span> No app to download</div>
  <div class="trust-item"><span class="icon">✅</span> Cancel anytime</div>
  <div class="trust-item"><span class="icon">🤖</span> Powered by Claude AI</div>
  <div class="trust-item"><span class="icon">📱</span> Works on any carrier</div>
</div>

<!-- HOW IT WORKS -->
<section class="how" id="how">
  <p class="section-label">How it works</p>
  <h2>Three steps. That's it.</h2>
  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="icon">📱</div>
      <h3>Text your meal</h3>
      <p>Type what you ate — or snap a photo of your plate. Send it to your Textabite number.</p>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="icon">⚡</div>
      <h3>Get instant nutrition</h3>
      <p>AI replies in seconds with calories, protein, carbs, and fat. No manual lookups.</p>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="icon">☀️</div>
      <h3>Morning summary</h3>
      <p>Every morning you receive yesterday's full nutrition breakdown with an encouraging note.</p>
    </div>
  </div>
</section>

<!-- SMS PREVIEW -->
<section class="preview">
  <div class="preview-inner">
    <div class="preview-text">
      <p class="section-label">See it in action</p>
      <h2>As easy as texting a friend</h2>
      <p>No forms. No barcode scanning. No searching a database. Just describe what you ate in plain English and we handle the rest.</p>
      <p>Works with restaurants, home cooking, coffee shop orders — anything.</p>
    </div>
    <div class="phone">
      <div class="phone-screen">
        <div class="phone-header">
          <div class="contact">Textabite</div>
          <div class="number">+1 (573) 464-3258</div>
        </div>
        <div class="phone-msgs">
          <div class="pmsg sent">2 scrambled eggs and whole wheat toast</div>
          <div class="pmsg recv">Logged: 2 scrambled eggs with whole wheat toast — 320 cal | 18g protein | 30g carbs | 12g fat 🥚</div>
          <div class="pmsg sent">grande oat milk latte</div>
          <div class="pmsg recv">Logged: Grande oat milk latte — 180 cal | 7g protein | 28g carbs | 5g fat ☕</div>
          <div class="pmsg summary">☀️ Good morning! Yesterday: 1,840 cal | 112g protein | 198g carbs | 64g fat. Solid protein day — keep it up!</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- PHOTO FEATURE -->
<section class="photo-feature">
  <div class="photo-inner">
    <p class="section-label">New feature</p>
    <h2>Just snap a photo 📸</h2>
    <p>Don't feel like typing? Send a photo of your meal instead. Our AI identifies what's on your plate and estimates the nutrition automatically.</p>
    <div class="photo-steps">
      <div class="photo-step">
        <div class="icon">📷</div>
        <p>Take a photo of your meal</p>
      </div>
      <div class="photo-step">
        <div class="icon">💬</div>
        <p>Text it to your Textabite number</p>
      </div>
      <div class="photo-step">
        <div class="icon">🤖</div>
        <p>AI identifies the food instantly</p>
      </div>
      <div class="photo-step">
        <div class="icon">✅</div>
        <p>Get your nutrition breakdown</p>
      </div>
    </div>
  </div>
</section>

<!-- COMPARISON -->
<section class="comparison">
  <h2>Why Textabite?</h2>
  <div class="comp-table">
    <div class="comp-row header">
      <div class="feature">Feature</div>
      <div class="val brand">Textabite</div>
      <div class="val">MyFitnessPal</div>
    </div>
    <div class="comp-row">
      <div class="feature">No app required</div>
      <div class="val yes">✓</div>
      <div class="val no">✗</div>
    </div>
    <div class="comp-row">
      <div class="feature">Log by text message</div>
      <div class="val yes">✓</div>
      <div class="val no">✗</div>
    </div>
    <div class="comp-row">
      <div class="feature">Log by photo</div>
      <div class="val yes">✓</div>
      <div class="val no">✗</div>
    </div>
    <div class="comp-row">
      <div class="feature">AI-powered recognition</div>
      <div class="val yes">✓</div>
      <div class="val no">✗</div>
    </div>
    <div class="comp-row">
      <div class="feature">Daily morning summary</div>
      <div class="val yes">✓</div>
      <div class="val no">✗</div>
    </div>
    <div class="comp-row">
      <div class="feature">Works on any phone</div>
      <div class="val yes">✓</div>
      <div class="val yes">✓</div>
    </div>
    <div class="comp-row">
      <div class="feature">No barcode scanning needed</div>
      <div class="val yes">✓</div>
      <div class="val no">✗</div>
    </div>
  </div>
</section>

<!-- FAQ -->
<section class="faq" id="faq">
  <h2>Frequently asked questions</h2>
  <div class="faq-list">
    <div class="faq-item">
      <h3>Does it work on any phone?</h3>
      <p>Yes. Textabite works via SMS, so it works on any phone with a text messaging plan — iPhone, Android, or even a basic phone.</p>
    </div>
    <div class="faq-item">
      <h3>How accurate is the nutrition data?</h3>
      <p>Our AI uses Claude, one of the most capable AI models available, trained on extensive nutrition databases. Estimates are very close for common foods. For packaged foods with exact labels, there may be small variations.</p>
    </div>
    <div class="faq-item">
      <h3>Can I really just text a photo?</h3>
      <p>Yes. Send an MMS photo of your meal and our AI will identify the food and estimate the nutrition automatically. It works great for restaurant meals, home cooking, and snacks.</p>
    </div>
    <div class="faq-item">
      <h3>What time does the daily summary arrive?</h3>
      <p>Your morning summary arrives at 8 AM. It covers everything you logged the previous day.</p>
    </div>
    <div class="faq-item">
      <h3>How do I cancel?</h3>
      <p>Reply STOP to any message to stop receiving texts, or cancel your subscription anytime from your billing portal. No questions asked.</p>
    </div>
    <div class="faq-item">
      <h3>Is my data private?</h3>
      <p>Yes. We never sell or share your phone number or meal data with third parties. See our <a href="/privacy">Privacy Policy</a> for full details.</p>
    </div>
  </div>
</section>

<!-- PRICING -->
<section class="pricing" id="pricing">
  <p class="section-label">Pricing</p>
  <h2>Simple, honest pricing</h2>
  <p class="sub">No hidden fees. Cancel anytime.</p>
  <div class="price-grid">

    <!-- BASIC -->
    <div class="price-card">
      <div class="plan-name">Basic</div>
      <div class="amount">$7.99</div>
      <div class="period">per month</div>
      <ul>
        <li><span class="check">✓</span> Unlimited meal logging via text</li>
        <li><span class="check">✓</span> Photo meal recognition</li>
        <li><span class="check">✓</span> Instant AI nutrition breakdown</li>
        <li><span class="check">✓</span> Daily 8 AM summary</li>
        <li><span class="check">✓</span> Works on any phone & carrier</li>
        <li><span class="check">✓</span> No app download ever</li>
        <li class="no"><span>✗</span> Custom summary time</li>
        <li class="no"><span>✗</span> Goal tracking & feedback</li>
        <li class="no"><span>✗</span> "Should I eat this?" advisor</li>
        <li class="no"><span>✗</span> Meal reminders</li>
      </ul>
      <button onclick="openWaitlist('basic')" class="btn-basic">Join waitlist →</button>
      <p class="price-guarantee">🔒 Launching soon · Be first in line</p>
    </div>

    <!-- PREMIUM -->
    <div class="price-card featured">
      <div class="popular-badge">Most Popular</div>
      <div class="plan-name">Premium</div>
      <div class="amount">$9.99</div>
      <div class="period">per month</div>
      <ul>
        <li><span class="check">✓</span> Everything in Basic</li>
        <li><span class="check">✓</span> Custom summary time</li>
        <li><span class="check">✓</span> Goal setting (presets or custom macros)</li>
        <li><span class="check">✓</span> Goal-aware AI feedback per meal</li>
        <li><span class="check">✓</span> "Should I eat this?" food advisor</li>
        <li><span class="check">✓</span> Personalized meal reminders</li>
        <li><span class="check">✓</span> Friendly check-in texts</li>
        <li><span class="check">✓</span> Dashboard with meal history</li>
      </ul>
      <button onclick="openWaitlist('premium')" class="btn-premium">Join waitlist →</button>
      <p class="price-guarantee">🔒 Launching soon · Be first in line</p>
    </div>

  </div>
</section>

<footer>
  <span class="logo">Textabite</span>
  <div class="links">
    <a href="/privacy">Privacy Policy</a>
    <a href="/terms">Terms of Service</a>
    <a href="mailto:${process.env.CONTACT_EMAIL}">Contact</a>
  </div>
  <span style="font-size:0.82rem;">© ${new Date().getFullYear()} Textabite. All rights reserved.</span>
</footer>

<!-- WAITLIST MODAL -->
<div class="demo-modal-overlay" id="waitlistOverlay">
  <div class="demo-modal">
    <div class="demo-modal-header">
      <h3>Join the waitlist</h3>
      <button class="demo-modal-close" onclick="closeWaitlist()">&#x2715;</button>
    </div>
    <div class="demo-email-screen" id="waitlistForm">
      <p>We're launching soon. Be first in line and get notified the moment we go live.</p>
      <input type="hidden" id="waitlistPlan">
      <input type="text" id="waitlistName" placeholder="Your name" style="margin-bottom:10px;width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:1rem;outline:none;">
      <input type="email" id="waitlistEmail" placeholder="your@email.com" style="margin-bottom:10px;width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:1rem;outline:none;">
      <input type="tel" id="waitlistPhone" placeholder="Phone number (optional)" style="margin-bottom:10px;width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:1rem;outline:none;">
      <button onclick="submitWaitlist()" style="width:100%;padding:13px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;">Reserve my spot &#x2192;</button>
    </div>
    <div class="demo-email-screen" id="waitlistSuccess" style="display:none;">
      <p style="font-size:1.1rem;font-weight:700;color:#111;margin-bottom:8px;">You're on the list!</p>
      <p>We'll text and email you the moment Textabite launches. Thanks for being an early supporter.</p>
    </div>
  </div>
</div>

<!-- DEMO MODAL -->
<div class="demo-modal-overlay" id="demoOverlay">
  <div class="demo-modal">
    <div class="demo-modal-header">
      <h3>Try Textabite free</h3>
      <button class="demo-modal-close" onclick="closeDemo()">&#x2715;</button>
    </div>
    <div class="demo-email-screen" id="demoEmailScreen">
      <p>Enter your email to unlock the live demo. No card required.</p>
      <input type="email" id="demoEmail" placeholder="you@example.com" onkeydown="if(event.key==='Enter') startDemo()">
      <button onclick="startDemo()">Start demo &#x2192;</button>
    </div>
    <div class="demo-chat-screen" id="demoChatScreen">
      <div class="demo-count" id="demoCount">5 messages remaining</div>
      <div class="demo-messages" id="demoMessages">
        <div class="demo-msg ai">Hey! I'm Textabite. Tell me what you ate and I'll give you the calories and macros instantly.</div>
      </div>
      <div class="demo-input-row" id="demoInputRow">
        <input type="text" id="demoChatInput" placeholder="e.g. 2 eggs and toast..." onkeydown="if(event.key==='Enter') sendDemoMsg()">
        <button onclick="sendDemoMsg()">Send</button>
      </div>
      <div class="demo-signup-banner" id="demoSignupBanner" style="display:none;">
        <p>Like what you see? Start your 14-day free trial.</p>
        <a href="#pricing" onclick="closeDemo()">Start my free trial &#x2192;</a>
      </div>
    </div>
  </div>
</div>

<script>
function openWaitlist(plan) {
  document.getElementById('waitlistPlan').value = plan;
  document.getElementById('waitlistOverlay').classList.add('open');
  setTimeout(() => document.getElementById('waitlistName').focus(), 100);
}
function closeWaitlist() {
  document.getElementById('waitlistOverlay').classList.remove('open');
}
document.getElementById('waitlistOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeWaitlist();
});
async function submitWaitlist() {
  const name = document.getElementById('waitlistName').value.trim();
  const email = document.getElementById('waitlistEmail').value.trim();
  const phone = document.getElementById('waitlistPhone').value.trim();
  if (!name || !email || !email.includes('@')) {
    if (!name) document.getElementById('waitlistName').style.borderColor = '#ef4444';
    if (!email || !email.includes('@')) document.getElementById('waitlistEmail').style.borderColor = '#ef4444';
    return;
  }
  try {
    await fetch('/api/demo/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone })
    });
  } catch(e) {}
  document.getElementById('waitlistForm').style.display = 'none';
  document.getElementById('waitlistSuccess').style.display = 'block';
}

let demoCount = 0;
const DEMO_MAX = 5;
let demoHistory = [];

function openDemo() {
  document.getElementById('demoOverlay').classList.add('open');
  setTimeout(() => document.getElementById('demoEmail').focus(), 100);
}
function closeDemo() {
  document.getElementById('demoOverlay').classList.remove('open');
}
document.getElementById('demoOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeDemo();
});

async function startDemo() {
  const email = document.getElementById('demoEmail').value.trim();
  if (!email || !email.includes('@')) {
    document.getElementById('demoEmail').style.borderColor = '#ef4444';
    return;
  }
  try {
    await fetch('/api/demo/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
  } catch(e) {}
  document.getElementById('demoEmailScreen').style.display = 'none';
  document.getElementById('demoChatScreen').classList.add('active');
  setTimeout(() => document.getElementById('demoChatInput').focus(), 100);
}

function appendDemoMsg(role, text) {
  const el = document.createElement('div');
  el.className = 'demo-msg ' + role;
  el.textContent = text;
  const msgs = document.getElementById('demoMessages');
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}

async function sendDemoMsg() {
  if (demoCount >= DEMO_MAX) return;
  const input = document.getElementById('demoChatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  appendDemoMsg('user', text);
  demoHistory.push({ role: 'user', content: text });

  const typing = document.createElement('div');
  typing.className = 'demo-msg ai';
  typing.id = 'demoTyping';
  typing.textContent = '...';
  document.getElementById('demoMessages').appendChild(typing);
  document.getElementById('demoMessages').scrollTop = 9999;

  try {
    const res = await fetch('/api/demo/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system: 'You are Textabite, a friendly SMS food journal assistant. When the user describes food, give calories and key macros in a casual friendly way. Keep replies under 160 chars. Plain text only, no markdown.',
        messages: demoHistory
      })
    });
    const data = await res.json();
    document.getElementById('demoTyping')?.remove();
    const reply = data.content?.find(b => b.type === 'text')?.text || 'Something went wrong, try again!';
    appendDemoMsg('ai', reply);
    demoHistory.push({ role: 'assistant', content: reply });
  } catch(e) {
    document.getElementById('demoTyping')?.remove();
    appendDemoMsg('ai', 'Connection error — please try again.');
  }

  demoCount++;
  const remaining = DEMO_MAX - demoCount;
  document.getElementById('demoCount').textContent = remaining > 0 ? remaining + ' messages remaining' : 'Demo limit reached';
  if (demoCount >= DEMO_MAX) {
    document.getElementById('demoInputRow').style.display = 'none';
    document.getElementById('demoSignupBanner').style.display = 'block';
  }
}
</script>

</body>
</html>`;
}

function successPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Textabite!</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0fdf4; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 16px; padding: 56px 48px; text-align: center; max-width: 480px; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .icon { font-size: 3rem; margin-bottom: 16px; }
    h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 12px; color: #111; }
    p { color: #4b5563; line-height: 1.6; margin-bottom: 8px; }
    .highlight { color: #16a34a; font-weight: 600; }
    a { display: inline-block; margin-top: 24px; padding: 12px 28px; background: #16a34a; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🎉</div>
    <h1>You're all set!</h1>
    <p>Welcome to Textabite. Your subscription is active.</p>
    <p class="highlight">Text your first meal to get started!</p>
    <p style="margin-top:16px; font-size:0.9rem;">Just send any meal description to your Textabite number and we'll reply with the nutrition breakdown instantly.</p>
    <a href="/">Back to home</a>
  </div>
</body>
</html>`;
}

function cancelPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Checkout cancelled – Textabite</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 16px; padding: 56px 48px; text-align: center; max-width: 480px; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .icon { font-size: 3rem; margin-bottom: 16px; }
    h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 12px; color: #111; }
    p { color: #4b5563; line-height: 1.6; }
    a { display: inline-block; margin-top: 24px; padding: 12px 28px; background: #16a34a; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">😕</div>
    <h1>Checkout cancelled</h1>
    <p>No worries — you haven't been charged. Come back whenever you're ready.</p>
    <a href="/">Back to home</a>
  </div>
</body>
</html>`;
}
