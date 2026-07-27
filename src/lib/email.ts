import "server-only";
import { Resend } from "resend";
import { SITE } from "./site";

// Transactional email for the request-to-host flow.
//
// Unconfigured is a supported state, not an error: without RESEND_API_KEY the
// send is skipped and reported back so the ops console can show a copy-ready
// message to send by hand. Approving an organizer must never fail because email
// is down.

export type SendResult =
  | { sent: true }
  | { sent: false; reason: "unconfigured" | "failed"; error?: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || `ISW Wave <onboarding@resend.dev>`;
}

export async function sendEmail({
  to,
  subject,
  heading,
  body,
  cta,
}: {
  to: string;
  subject: string;
  heading: string;
  /** Paragraphs, rendered in order. */
  body: string[];
  cta?: { label: string; url: string };
}): Promise<SendResult> {
  if (!emailConfigured()) return { sent: false, reason: "unconfigured" };

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!.trim());
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to,
      subject,
      html: renderHtml({ heading, body, cta }),
      text: renderText({ heading, body, cta }),
    });
    if (error) {
      console.error("[email] resend error", error);
      return { sent: false, reason: "failed", error: error.message };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] send threw", err);
    return { sent: false, reason: "failed", error: String(err) };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Inline styles and a table shell — email clients strip <style> blocks.
function renderHtml({
  heading,
  body,
  cta,
}: {
  heading: string;
  body: string[];
  cta?: { label: string; url: string };
}): string {
  const paragraphs = body
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#c9ced8;">${escapeHtml(
          p
        )}</p>`
    )
    .join("");

  const button = cta
    ? `<p style="margin:24px 0 8px;">
         <a href="${escapeHtml(cta.url)}"
            style="display:inline-block;background:#22d3ee;color:#07080c;text-decoration:none;
                   font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">
           ${escapeHtml(cta.label)}
         </a>
       </p>
       <p style="margin:8px 0 0;font-size:12px;color:#6b7280;word-break:break-all;">
         Or paste this link: ${escapeHtml(cta.url)}
       </p>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#07080c;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr><td style="padding:0 0 20px;">
      <span style="font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#22d3ee;">
        ${escapeHtml(SITE.name)}
      </span>
    </td></tr>
    <tr><td style="background:#101319;border:1px solid #1f2430;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#ffffff;">${escapeHtml(
        heading
      )}</h1>
      ${paragraphs}
      ${button}
    </td></tr>
    <tr><td style="padding:18px 4px 0;font-size:12px;color:#5b6270;">
      ${escapeHtml(SITE.name)} · <a href="${SITE.appUrl}" style="color:#6b7280;">${
    SITE.appUrl
  }</a>
    </td></tr>
  </table>
</body></html>`;
}

function renderText({
  heading,
  body,
  cta,
}: {
  heading: string;
  body: string[];
  cta?: { label: string; url: string };
}): string {
  return [
    heading,
    "",
    ...body,
    ...(cta ? ["", `${cta.label}: ${cta.url}`] : []),
    "",
    `${SITE.name} — ${SITE.appUrl}`,
  ].join("\n");
}
