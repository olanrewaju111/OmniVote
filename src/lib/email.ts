import * as nodemailer from 'nodemailer';

/**
 * Create a pre-configured SMTP transporter from env vars.
 * Falls back to a no-op test transporter if SMTP is not configured.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || 'noreply@omnivote.ng';
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    console.warn('[EMAIL] SMTP not configured — emails will be logged only');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Connection timeout & retry for reliability
    connectionTimeout: 10_000,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
}

const FROM_ADDRESS = process.env.SMTP_FROM || 'noreply@omnivote.ng';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send a single email. Returns true on success, false on failure.
 * Failures are logged but never throw — callers should not expose
 * email-sending errors to end-users.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  const transporter = createTransporter();

  // No SMTP configured — log and pretend success
  if (!transporter) {
    console.log(`[EMAIL] (dry-run) To: ${to}, Subject: ${subject}`);
    console.log(`[EMAIL] (dry-run) Body (first 300 chars): ${html.substring(0, 300)}`);
    return true;
  }

  try {
    const info = await transporter.sendMail({
      from: `"${'OmniVote Monitor'}" <${FROM_ADDRESS}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' '),
    });
    console.log(`[EMAIL] Sent to ${to} — MessageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to}:`, err);
    return false;
  }
}

// ─── Template Helpers ──────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export function passwordResetHtml(name: string, resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
        .header { background: #10b981; color: #fff; padding: 24px 32px; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
        .body { padding: 32px; }
        .body p { color: #3f3f46; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
        .btn { display: inline-block; background: #10b981; color: #fff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0 24px; }
        .footer { padding: 20px 32px; border-top: 1px solid #e4e4e7; font-size: 12px; color: #a1a1aa; }
        .expires { color: #ef4444; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>OmniVote Monitor</h1>
        </div>
        <div class="body">
          <p>Hi <strong>${name}</strong>,</p>
          <p>You requested a password reset for your OmniVote account. Click the button below to set a new password:</p>
          <p style="text-align:center;"><a href="${resetLink}" class="btn">Reset Password</a></p>
          <p style="font-size:13px;color:#71717a;">Or copy this link into your browser:</p>
          <p style="font-size:13px;word-break:break-all;color:#71717a;">${resetLink}</p>
          <p>This link will expire in <span class="expires">1 hour</span>. If you did not request this, ignore this email — your password will not be changed.</p>
        </div>
        <div class="footer">
          OmniVote Monitor &mdash; Secure Election Command Center<br />
          This is an automated message. Do not reply to this email.
        </div>
      </div>
    </body>
    </html>
  `;
}

export function buildResetLink(token: string, tenantSlug?: string): string {
  if (tenantSlug) {
    return `${APP_URL}/t/${tenantSlug}/reset-password?token=${token}`;
  }
  return `${APP_URL}/reset-password?token=${token}`;
}
