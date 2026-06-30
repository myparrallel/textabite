import { Resend } from 'resend';

const FROM = 'Textabite <support@textabite.com>';

function getClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  return new Resend(key);
}

function getAppUrl(): string {
  return process.env.APP_URL ?? 'https://textabite.com';
}

export async function sendWaitlistConfirmation(name: string, email: string): Promise<void> {
  await getClient().emails.send({
    from: FROM,
    to: email,
    subject: "You're on the Textabite waitlist",
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FFFDE7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFDE7;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

        <!-- Header -->
        <tr><td style="background:#FFFDE7;padding:32px 40px 24px;border-bottom:1px solid #e8e4dd;">
          <p style="margin:0;font-size:1.4rem;font-weight:800;color:#2E2A14;">Textabite</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px 40px 32px;">
          <h1 style="margin:0 0 12px;font-size:1.6rem;font-weight:800;color:#2E2A14;letter-spacing:-0.5px;">You're on the list, ${name.split(' ')[0]}.</h1>
          <p style="margin:0 0 20px;font-size:1rem;color:#8A8060;line-height:1.6;">Thanks for joining the Textabite waitlist. You'll be first to know when we go live.</p>

          <table cellpadding="0" cellspacing="0" style="background:#FFFDE7;border-radius:12px;padding:24px;width:100%;margin-bottom:28px;">
            <tr><td>
              <p style="margin:0 0 16px;font-size:0.85rem;font-weight:700;color:#C9A227;text-transform:uppercase;letter-spacing:1px;">What to expect</p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;font-size:0.95rem;color:#2E2A14;line-height:1.5;">
                    📱 &nbsp;Text any meal to get instant calories and macros
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:0.95rem;color:#2E2A14;line-height:1.5;">
                    ☀️ &nbsp;Daily morning nutrition summary straight to your phone
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:0.95rem;color:#2E2A14;line-height:1.5;">
                    📸 &nbsp;Snap a photo of your plate — no typing needed
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:0.95rem;color:#2E2A14;line-height:1.5;">
                    ✅ &nbsp;No app to download. Ever.
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>

          <p style="margin:0 0 28px;font-size:0.95rem;color:#8A8060;line-height:1.6;">We'll send you a follow-up email with your login link the moment we launch. In the meantime, try the live demo on our site.</p>

          <table cellpadding="0" cellspacing="0">
            <tr><td style="border-radius:8px;background:#C9A227;">
              <a href="${getAppUrl()}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:1rem;font-weight:700;text-decoration:none;">Try the demo →</a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 40px;border-top:1px solid #e8e4dd;">
          <p style="margin:0;font-size:0.8rem;color:#8A8060;line-height:1.5;">You're receiving this because you joined the Textabite waitlist. Reply STOP to opt out, or email <a href="mailto:support@textabite.com" style="color:#C9A227;">support@textabite.com</a> with any questions.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendSetPasswordEmail(email: string, token: string): Promise<void> {
  const link = `${getAppUrl()}/set-password?token=${token}`;
  await getClient().emails.send({
    from: FROM,
    to: email,
    subject: "Set your password — Textabite is live",
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FFFDE7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFDE7;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

        <tr><td style="background:#FFFDE7;padding:32px 40px 24px;border-bottom:1px solid #e8e4dd;">
          <p style="margin:0;font-size:1.4rem;font-weight:800;color:#2E2A14;">Textabite</p>
        </td></tr>

        <tr><td style="padding:40px 40px 32px;">
          <h1 style="margin:0 0 12px;font-size:1.6rem;font-weight:800;color:#2E2A14;letter-spacing:-0.5px;">We're live. You're in.</h1>
          <p style="margin:0 0 28px;font-size:1rem;color:#8A8060;line-height:1.6;">Click below to set your password and access your Textabite dashboard. This link expires in 24 hours.</p>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="border-radius:8px;background:#C9A227;">
              <a href="${link}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:1rem;font-weight:700;text-decoration:none;">Set my password →</a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:0.85rem;color:#8A8060;line-height:1.6;">If the button doesn't work, copy and paste this link:<br><a href="${link}" style="color:#C9A227;word-break:break-all;">${link}</a></p>
        </td></tr>

        <tr><td style="padding:24px 40px;border-top:1px solid #e8e4dd;">
          <p style="margin:0;font-size:0.8rem;color:#8A8060;line-height:1.5;">Questions? Reply to this email or contact <a href="mailto:support@textabite.com" style="color:#C9A227;">support@textabite.com</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
