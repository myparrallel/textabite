import { Router, Request, Response } from 'express';

const router = Router();

const APP_NAME = 'Textabite';
const APP_URL = process.env.APP_URL ?? 'https://textabite.com';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? 'support@textabite.com';

const sharedStyles = `
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FFFDE7; color: #2E2A14; }
    nav { display: flex; justify-content: space-between; align-items: center; padding: 18px 40px; background: #fff; border-bottom: 1px solid #e8e4dd; }
    .logo { font-size: 1.4rem; font-weight: 800; color: #2E2A14; text-decoration: none; }
    .content { max-width: 720px; margin: 48px auto; padding: 0 24px 80px; }
    h1 { font-size: 2rem; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.5px; }
    .updated { font-size: 0.85rem; color: #8A8060; margin-bottom: 40px; }
    h2 { font-size: 1.1rem; font-weight: 700; margin-top: 36px; margin-bottom: 10px; }
    p { line-height: 1.7; color: #2E2A14; margin-bottom: 12px; font-size: 0.95rem; }
    ul { padding-left: 20px; margin-bottom: 12px; }
    ul li { line-height: 1.7; font-size: 0.95rem; margin-bottom: 4px; }
    a { color: #C9A227; }
    strong { font-weight: 600; }
    .divider { border: none; border-top: 1px solid #e8e4dd; margin: 40px 0; }
  </style>
`;

router.get('/privacy', (_req: Request, res: Response) => {
  const updated = 'June 30, 2025';
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy – ${APP_NAME}</title>
  ${sharedStyles}
</head>
<body>
<nav><a href="/" class="logo">${APP_NAME}</a></nav>
<div class="content">
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: ${updated}</p>

  <p>This Privacy Policy explains how ${APP_NAME} ("we," "us," or "our") collects, uses, and protects your information when you use our SMS-based nutrition tracking service at ${APP_URL}.</p>

  <h2>1. Information We Collect</h2>
  <p>We collect the following categories of information:</p>
  <ul>
    <li><strong>Account information:</strong> your name, email address, and phone number when you join our waitlist or create an account.</li>
    <li><strong>Meal data:</strong> the text messages and photos you send us describing your meals.</li>
    <li><strong>Usage data:</strong> timestamps of messages sent and received, and nutrition data we calculate from your logs.</li>
    <li><strong>Payment information:</strong> billing details are collected and processed directly by Stripe. We do not store your credit card number.</li>
    <li><strong>Device and technical data:</strong> when you visit our website, we may collect your browser type, IP address, and pages visited through standard server logs.</li>
  </ul>

  <h2>2. How We Use Your Information</h2>
  <ul>
    <li>To provide the service: process your meal logs and send SMS replies with nutrition information.</li>
    <li>To send your daily morning nutrition summary.</li>
    <li>To manage your account, subscription, and billing.</li>
    <li>To notify you of service updates, launches, or changes to these terms.</li>
    <li>To improve the accuracy and quality of our AI nutrition estimates.</li>
    <li>To comply with legal obligations.</li>
  </ul>
  <p>We do not use your data for advertising or sell it to marketers.</p>

  <h2>3. SMS Messaging</h2>
  <p>By joining our waitlist or subscribing, you consent to receive recurring SMS messages from ${APP_NAME}, including meal logging confirmations, nutrition summaries, account notifications, and launch updates. <strong>Message and data rates may apply.</strong> Message frequency varies based on your usage (typically 1–15 messages per day).</p>
  <p>Reply <strong>STOP</strong> at any time to unsubscribe. Reply <strong>HELP</strong> for support. You can also email us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

  <h2>4. No Sale or Sharing of Mobile Numbers</h2>
  <p>We will never sell, rent, trade, or share your mobile phone number with any third party for their marketing purposes. Your number is used solely to deliver the ${APP_NAME} service.</p>

  <h2>5. Third-Party Service Providers</h2>
  <p>We share data only with vendors necessary to operate the service:</p>
  <ul>
    <li><strong>Twilio</strong> — sends and receives SMS messages on our behalf.</li>
    <li><strong>Anthropic</strong> — powers the AI that parses your meal descriptions and generates nutrition estimates. Meal text is sent to Anthropic's API for processing.</li>
    <li><strong>Stripe</strong> — processes payments. Your billing data is governed by <a href="https://stripe.com/privacy" target="_blank">Stripe's Privacy Policy</a>.</li>
    <li><strong>Railway</strong> — hosts our servers and database infrastructure.</li>
  </ul>
  <p>Each provider is contractually required to protect your data and may not use it for their own marketing purposes.</p>

  <h2>6. Data Security</h2>
  <p>We use industry-standard security measures including encrypted connections (HTTPS/TLS), hashed passwords, and access-controlled databases. No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security. We will notify you promptly in the event of a data breach affecting your personal information.</p>

  <h2>7. Data Retention</h2>
  <p>We retain your meal logs and account data for as long as your account is active. If you cancel your subscription or request deletion, we will remove your personal data within 30 days, except where required by law to retain it longer (e.g., billing records for tax purposes).</p>

  <h2>8. Your Rights</h2>
  <p>Depending on your location, you may have the right to:</p>
  <ul>
    <li>Access the personal data we hold about you.</li>
    <li>Request correction of inaccurate data.</li>
    <li>Request deletion of your data ("right to be forgotten").</li>
    <li>Opt out of SMS communications at any time by replying STOP.</li>
  </ul>
  <p>To exercise any of these rights, email us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

  <h2>9. California Residents (CCPA)</h2>
  <p>If you are a California resident, you have the right to know what personal information we collect, request deletion of your data, and opt out of the sale of personal information. We do not sell personal information. To submit a request, contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

  <h2>10. Children's Privacy</h2>
  <p>${APP_NAME} is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us and we will delete it promptly.</p>

  <h2>11. Cookies</h2>
  <p>We use a single session cookie to keep you logged in to your dashboard. We do not use advertising or tracking cookies. We do not use third-party analytics services that track you across other websites.</p>

  <h2>12. Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top and, for material changes, notify you by email or SMS. Continued use of the service after changes constitutes acceptance of the updated policy.</p>

  <h2>13. Contact Us</h2>
  <p>Questions or concerns? Reach us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> or by mail at ${APP_NAME}, United States.</p>
</div>
</body>
</html>`);
});

router.get('/terms', (_req: Request, res: Response) => {
  const updated = 'June 30, 2025';
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service – ${APP_NAME}</title>
  ${sharedStyles}
</head>
<body>
<nav><a href="/" class="logo">${APP_NAME}</a></nav>
<div class="content">
  <h1>Terms of Service</h1>
  <p class="updated">Last updated: ${updated}</p>

  <p>These Terms of Service ("Terms") govern your access to and use of ${APP_NAME} ("Service"), operated by ${APP_NAME} ("we," "us," or "our"). By using the Service, you agree to these Terms. If you do not agree, do not use the Service.</p>

  <h2>1. Description of Service</h2>
  <p>${APP_NAME} is an SMS-based nutrition tracking service. Users text meal descriptions or photos to a designated phone number and receive estimated calorie and macro information in return, along with a daily nutrition summary each morning.</p>

  <h2>2. Eligibility</h2>
  <p>You must be at least 18 years old to use the Service. By using ${APP_NAME}, you represent that you are 18 or older and have the legal capacity to enter into these Terms. The Service is intended for users in the United States.</p>

  <h2>3. Account & Waitlist</h2>
  <p>To join our waitlist or use the Service, you must provide accurate contact information including your name, email address, and phone number. You are responsible for maintaining the accuracy of your information. We reserve the right to refuse service to anyone for any reason.</p>

  <h2>4. Subscriptions & Billing</h2>
  <p>Access to the full Service requires a paid subscription. Subscriptions are billed monthly as described at checkout and processed by Stripe. By subscribing, you authorize us to charge your payment method on a recurring basis until you cancel.</p>
  <p>Prices are listed in USD and may change with 30 days' notice. All fees are non-refundable except where required by law or at our sole discretion. You may cancel your subscription at any time; cancellation takes effect at the end of the current billing period.</p>

  <h2>5. Free Trial</h2>
  <p>We may offer a free trial period. At the end of the trial, your payment method will be charged automatically unless you cancel before the trial ends. We will remind you before the trial expires.</p>

  <h2>6. SMS Consent & Opt-Out</h2>
  <p>By joining the waitlist or subscribing, you consent to receive recurring SMS messages from ${APP_NAME}, including meal logging confirmations, nutrition summaries, account notifications, and service updates. <strong>Message and data rates may apply.</strong> Message frequency varies.</p>
  <p>Reply <strong>STOP</strong> to any message to unsubscribe. Reply <strong>HELP</strong> for support. Opting out of SMS will disable the core functionality of the Service.</p>

  <h2>7. Nutrition Information Disclaimer</h2>
  <p>All nutrition estimates provided by ${APP_NAME} are generated by artificial intelligence and are approximations only. They are <strong>not medical advice</strong> and should not be used to diagnose, treat, cure, or prevent any health condition. Always consult a qualified healthcare professional or registered dietitian for dietary guidance. We are not responsible for decisions made based on our nutrition estimates.</p>

  <h2>8. Prohibited Uses</h2>
  <p>You agree not to:</p>
  <ul>
    <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
    <li>Attempt to gain unauthorized access to our systems or other users' accounts.</li>
    <li>Use automated tools to send messages to our system at a rate that disrupts service for others.</li>
    <li>Reverse-engineer, copy, or resell any part of the Service.</li>
    <li>Provide false information during registration or checkout.</li>
    <li>Use the Service if you are under 18 years of age.</li>
  </ul>

  <h2>9. Intellectual Property</h2>
  <p>All content, branding, software, and materials associated with ${APP_NAME} are owned by us and protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written permission. You retain ownership of the meal data you submit but grant us a limited license to process it to provide the Service.</p>

  <h2>10. Termination</h2>
  <p>We reserve the right to suspend or terminate your account at any time, with or without notice, if we believe you have violated these Terms, engaged in fraudulent activity, or if required by law. Upon termination, your right to use the Service ceases immediately. Provisions that by their nature should survive termination (including disclaimers, limitations of liability, and governing law) will survive.</p>

  <h2>11. Disclaimer of Warranties</h2>
  <p>The Service is provided "as is" and "as available" without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or that nutrition estimates will be accurate.</p>

  <h2>12. Limitation of Liability</h2>
  <p>To the fullest extent permitted by law, ${APP_NAME} and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, loss of profits, or health-related outcomes, arising from your use of the Service. Our total liability to you for any claim shall not exceed the amount you paid us in the 12 months preceding the claim.</p>

  <h2>13. Indemnification</h2>
  <p>You agree to indemnify and hold harmless ${APP_NAME} and its operators from any claims, damages, losses, or expenses (including reasonable attorney's fees) arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.</p>

  <h2>14. Governing Law & Dispute Resolution</h2>
  <p>These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles. Any disputes arising under these Terms shall first be attempted to be resolved through good-faith negotiation. If unresolved, disputes shall be submitted to binding arbitration in accordance with the American Arbitration Association rules, conducted in English. You waive any right to participate in a class-action lawsuit or class-wide arbitration.</p>

  <h2>15. Changes to These Terms</h2>
  <p>We may update these Terms at any time. When we do, we will update the "Last updated" date above and notify you by email or SMS for material changes. Continued use of the Service after changes constitutes acceptance of the updated Terms. If you do not agree to the updated Terms, you must stop using the Service and cancel your subscription.</p>

  <h2>16. Severability</h2>
  <p>If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.</p>

  <h2>17. Contact Us</h2>
  <p>Questions about these Terms? Contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
</div>
</body>
</html>`);
});

export default router;
