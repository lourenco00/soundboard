import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendVerifyEmail(to: string, link: string) {
  await resend.emails.send({
    from: "Soundboard <no-reply@soundboard.app>",
    to, subject: "Verify your email",
    html: `<p>Welcome to Pro Soundboard!</p>
           <p>Confirm your email to continue: <a href="${link}">${link}</a></p>`,
  });
}