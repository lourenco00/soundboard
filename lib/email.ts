// lib/email.ts
import { Resend } from "resend";

const FROM = process.env.RESEND_FROM || "support@soundboardlab.com";

export async function sendVerifyEmail(email: string, link: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Missing RESEND_API_KEY; skipping email send");
    return;
  }

  // Lazy init em runtime (não corre no build)
  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Verify your SoundboardLab account",
    html: `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.6">
        <h2>Confirm your email</h2>
        <p>Click the button below to verify your account.</p>
        <p>
          <a href="${link}" style="display:inline-block;padding:10px 16px;border-radius:8px;text-decoration:none;border:1px solid #111">
            Verify account
          </a>
        </p>
        <p>Or copy this link:<br/><code>${link}</code></p>
        <p>This link expires in 24 hours.</p>
      </div>
    `,
    text: `Verify your account: ${link}`,
  });
}
