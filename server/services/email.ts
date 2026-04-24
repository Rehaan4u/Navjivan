import * as nodemailer from "nodemailer";
import { storage } from "../storage";
import fs from "fs";

// Automatically detect if SMTP credentials are configured
const USE_REAL_EMAIL = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

if (USE_REAL_EMAIL) {
  console.log(`Email service: Using SMTP at ${process.env.SMTP_HOST}`);
} else {
  console.log("Email service: Using mock mode (emails will be logged, not sent)");
  console.log("To enable real email sending, configure SMTP_HOST, SMTP_USER, and SMTP_PASS");
}

// Initialize transporter lazily to avoid module loading issues
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    if (USE_REAL_EMAIL) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_PORT === "465", // true for port 465, false for other ports
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        jsonTransport: true, // For testing/development
      });
    }
  }
  return transporter;
}

export async function sendNewsletterEmail(
  newsletterId: string,
  recipientEmail: string
): Promise<void> {
  try {
    const newsletter = await storage.getNewsletter(newsletterId);
    if (!newsletter) {
      throw new Error(`Newsletter ${newsletterId} not found`);
    }

    const articles = await storage.getNewsletterArticles(newsletterId);
    const date = new Date(newsletter.generatedAt!);
    const formattedDate = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Create HTML email body
const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Chronicle</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Serif+4:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #F7F5F0;
      font-family: 'DM Sans', Arial, sans-serif;
      color: #1a1a1a;
      padding: 32px 16px;
    }
    .wrapper {
      max-width: 620px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 2px 24px rgba(0,0,0,0.07);
    }

    /* ── Header ── */
    .header {
      background: #0F1B2D;
      padding: 40px 48px 32px;
      text-align: center;
      border-bottom: 3px solid #C9A84C;
    }
    .header-eyebrow {
      font-family: 'DM Sans', sans-serif;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 3px;
      color: #C9A84C;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .header-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 28px;
      font-weight: 700;
      color: #FFFFFF;
      letter-spacing: -0.3px;
      margin-bottom: 6px;
    }
    .header-byline {
      font-family: 'DM Sans', sans-serif;
      font-size: 11px;
      color: rgba(255,255,255,0.4);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    .header-meta {
      display: inline-block;
      background: rgba(201,168,76,0.12);
      border: 1px solid rgba(201,168,76,0.3);
      border-radius: 2px;
      padding: 6px 16px;
      font-size: 12px;
      color: rgba(255,255,255,0.65);
      font-family: 'DM Sans', sans-serif;
    }
    .header-meta strong {
      color: #C9A84C;
      font-weight: 500;
    }

    /* ── Edition bar ── */
    .edition-bar {
      background: #F7F5F0;
      border-bottom: 1px solid #E8E4DC;
      padding: 12px 48px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .edition-date {
      font-size: 12px;
      color: #888;
      font-family: 'DM Sans', sans-serif;
      letter-spacing: 0.5px;
    }
    .edition-companies {
      font-size: 11px;
      color: #C9A84C;
      font-family: 'DM Sans', sans-serif;
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    /* ── Body ── */
    .body-wrap {
      padding: 0 48px 40px;
      background: #FFFFFF;
    }

    /* ── Article ── */
    .article {
      padding: 32px 0;
      border-bottom: 1px solid #EEEBE4;
    }
    .article:last-child {
      border-bottom: none;
    }
    .article-number {
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 2.5px;
      color: #C9A84C;
      text-transform: uppercase;
      margin-bottom: 10px;
      font-family: 'DM Sans', sans-serif;
    }
    .article-headline {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 20px;
      font-weight: 700;
      color: #0F1B2D;
      line-height: 1.35;
      margin-bottom: 14px;
      letter-spacing: -0.2px;
    }
    .article-summary {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 15.5px;
      line-height: 1.75;
      color: #2D2D2D;
      font-weight: 300;
    }
    .article-summary em {
      font-style: italic;
    }
    .article-footer {
      margin-top: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .source-label {
      font-size: 11px;
      font-weight: 500;
      color: #999;
      font-family: 'DM Sans', sans-serif;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .source-dot {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: #CCC;
      display: inline-block;
    }
    .read-more {
      font-size: 12px;
      color: #C9A84C;
      text-decoration: none;
      font-family: 'DM Sans', sans-serif;
      font-weight: 500;
      letter-spacing: 0.3px;
    }

    /* ── Divider ── */
    .section-divider {
      height: 1px;
      background: linear-gradient(to right, transparent, #E0DBD0, transparent);
      margin: 0 48px;
    }

    /* ── Footer ── */
    .footer {
      background: #0F1B2D;
      padding: 28px 48px;
      text-align: center;
    }
    .footer p {
      font-size: 11px;
      color: rgba(255,255,255,0.3);
      font-family: 'DM Sans', sans-serif;
      line-height: 1.8;
    }
    .footer a {
      color: rgba(201,168,76,0.7);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">

    <!-- Header -->
    <div class="header">
      <div class="header-eyebrow">Daily Intelligence Briefing</div>
      <div class="header-title">Payment Chronicle</div>
      <div class="header-byline">by Gajanan Pujari</div>
      <div class="header-meta">
        <strong>${formattedDate}</strong> &nbsp;·&nbsp; ${articles.length} stories today
      </div>
    </div>

    <!-- Edition bar -->
    <div class="edition-bar">
      <span class="edition-date">${formattedDate}</span>
      <span class="edition-companies">Tracking: ${newsletter.companies}</span>
    </div>

    <!-- Articles -->
    <div class="body-wrap">
      ${articles.map((article, index) => `
        <div class="article">
          <div class="article-number">Story ${index + 1} of ${articles.length}</div>
          <div class="article-headline">${article.headline}</div>
          <div class="article-summary">${article.summary}</div>
          <div class="article-footer">
            <span class="source-label">${article.sourceName}</span>
            <span class="source-dot"></span>
            <a href="${article.sourceUrl}" class="read-more" target="_blank">Read full story →</a>
          </div>
        </div>
      `).join('<div class="section-divider"></div>')}
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>© ${new Date().getFullYear()} Payment Chronicle by Gajanan Pujari. All rights reserved.</p>
      <p style="margin-top:6px;">You're receiving this because you subscribed to daily payments industry intelligence.</p>
      <p style="margin-top:4px;"><a href="#">Unsubscribe</a> &nbsp;·&nbsp; <a href="#">Privacy Policy</a></p>
    </div>

  </div>
</body>
</html>`;

    // Plain text version for email clients that don't support HTML
    const textBody = `
Payment Chronicle
${formattedDate}
Companies: ${newsletter.companies}

${articles
  .map(
    (article, index) => `
${index + 1}. ${article.headline}

${article.summary}

Source: ${article.sourceName}
Read more: ${article.sourceUrl}
`
  )
  .join("\n---\n")}

© 2025 Payment Chronicle by Gajanan. All rights reserved.
`;

    // Prepare attachments
    const attachments = [];
    if (newsletter.pdfPath && fs.existsSync(newsletter.pdfPath)) {
      attachments.push({
        filename: `payment-chronicle-${formattedDate}.pdf`,
        path: newsletter.pdfPath,
      });
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Payment Chronicle" <noreply@paymentchronicle.com>',
      to: recipientEmail,
      subject: `Payment Chronicle - ${formattedDate}`,
      text: textBody,
      html: htmlBody,
      attachments,
    };

    if (USE_REAL_EMAIL) {
      const info = await getTransporter().sendMail(mailOptions);
      console.log(`Email sent to ${recipientEmail}: ${info.messageId}`);
    } else {
      // For MVP: Log email instead of sending
      console.log(`[MVP MODE] Email would be sent to: ${recipientEmail}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Articles: ${articles.length}`);
      console.log(`PDF attached: ${!!newsletter.pdfPath}`);
    }

    // Mark as sent
    await storage.markNewsletterSent(newsletterId);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
