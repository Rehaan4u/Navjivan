import * as nodemailer from "nodemailer";
import { storage } from "../storage";

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
  <title>Navjivan</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Serif+4:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        background-color: #EEF4FB;
        font-family: 'DM Sans', Arial, sans-serif;
        color: #1a1a1a;
        padding: 0;
        margin: 0;
      }
    .wrapper {
      max-width: 900px;
      width: 100%
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 32px rgba(0,82,204,0.10);
    }
    .header {
      background: linear-gradient(135deg, #0052CC 0%, #0747A6 100%);
      padding: 40px 48px 32px;
      text-align: center;
      border-bottom: 4px solid #4C9AFF;
    }
    .header-eyebrow {
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 3px;
      color: #4C9AFF;
      text-transform: uppercase;
      margin-bottom: 12px;
      font-family: 'DM Sans', sans-serif;
    }
    .header-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 32px;
      font-weight: 700;
      color: #FFFFFF;
      letter-spacing: -0.5px;
      margin-bottom: 4px;
    }
    .header-byline {
      font-size: 11px;
      color: rgba(255,255,255,0.5);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 20px;
      font-family: 'DM Sans', sans-serif;
    }
    .header-meta {
      display: inline-block;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 4px;
      padding: 6px 18px;
      font-size: 12px;
      color: rgba(255,255,255,0.8);
      font-family: 'DM Sans', sans-serif;
    }
    .header-meta strong { color: #FFFFFF; font-weight: 600; }
    .edition-bar {
      background: #F0F6FF;
      border-bottom: 1px solid #DEEBFF;
      padding: 12px 48px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .edition-date { font-size: 12px; color: #5E6C84; font-family: 'DM Sans', sans-serif; }
    .edition-companies { font-size: 11px; color: #0052CC; font-family: 'DM Sans', sans-serif; font-weight: 600; }
    .body-wrap { padding: 8px 40px 40px; background: #FFFFFF; }
    .article { padding: 36px 0 32px; border-bottom: 2px solid #DEEBFF; margin-bottom: 8px;}
    .article:last-child { border-bottom: none; }
    .article-number {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 3px;
        color: #0052CC;
        text-transform: uppercase;
        margin-bottom: 16px;
        font-family: 'DM Sans', sans-serif;
        background: #EEF4FF;
        display: inline-block;
        padding: 4px 12px;
        border-radius: 4px;
        border-left: 3px solid #0052CC;
      }
    .article-image {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 6px;
      margin-bottom: 16px;
      display: block;
    }
    .article-image {
      width: 100%;
      height: 260px;
      object-fit: cover;
      border-radius: 8px;
      margin-bottom: 20px;
      margin-top: 4px;
      display: block;
      border: 1px solid #DEEBFF;
    }
      .article-headline {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 22px;
        font-weight: 700;
        color: #0747A6;
        line-height: 1.4;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #EEF4FF;
      }
        .article-summary {
        font-family: 'Source Serif 4', Georgia, serif;
        font-size: 15.5px;
        line-height: 1.85;
        color: #1A1A2E;
        font-weight: 300;
        padding: 16px;
        background: #F8FBFF;
        border-radius: 6px;
        border-left: 3px solid #4C9AFF;
      }
        .article-footer {
        margin-top: 20px;
        padding-top: 12px;
        border-top: 1px solid #EBECF0;
        display: flex;
        align-items: center;
        gap: 10px;
      }
    .source-label {
      font-size: 11px;
      font-weight: 500;
      color: #5E6C84;
      font-family: 'DM Sans', sans-serif;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .source-dot { width: 3px; height: 3px; border-radius: 50%; background: #B3BAC5; display: inline-block; }
    .read-more {
      font-size: 12px;
      color: #0052CC;
      text-decoration: none;
      font-family: 'DM Sans', sans-serif;
      font-weight: 600;
    }
    .section-divider {
      height: 1px;
      background: linear-gradient(to right, transparent, #DEEBFF, transparent);
      margin: 0 40px;
    }
    .footer {
      background: linear-gradient(135deg, #0052CC 0%, #0747A6 100%);
      padding: 28px 48px;
      text-align: center;
    }
    .footer p { font-size: 11px; color: rgba(255,255,255,0.5); font-family: 'DM Sans', sans-serif; line-height: 1.8; }
    .footer a { color: rgba(255,255,255,0.7); text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">

    <div class="header">
      <div class="header-eyebrow">Daily Cloud Intelligence Briefing</div>
      <div class="header-title">Navjivan</div>
      <div class="header-byline">Est. 1919 · Reborn in AI</div>
      <div class="header-meta">
        <strong>${formattedDate}</strong> &nbsp;·&nbsp; ${articles.length} stories today
      </div>
    </div>

    <div class="edition-bar">
      <span class="edition-date">${formattedDate}</span>
      <span class="edition-companies">Tracking: ${newsletter.companies}</span>
    </div>

    <div class="body-wrap">
      ${articles.map((article, index) => {
        // ✅ Generate Unsplash image URL from headline keywords
        const imageKeywords = article.headline
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .split(" ")
          .filter((w: string) => w.length > 3)
          .slice(0, 3)
          .join(",");
          // ✅ Pollinations AI — free AI image generation, no API key needed
const imagePrompt = `${article.headline}, cloud computing, technology, professional, digital art, blue theme`;
const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=800&height=300&nologo=true`;

        return `
        <div class="article">
          <div class="article-number">Story ${index + 1} of ${articles.length}</div>
          <img
            src="${imageUrl}"
            alt="${article.headline}"
            class="article-image"
            onerror="this.style.display='none'"
          />
          <div class="article-headline">${article.headline}</div>
          <div class="article-summary">${article.summary}</div>
          <div class="article-footer">
            <span class="source-label">${article.sourceName}</span>
            <span class="source-dot"></span>
            <a href="${article.sourceUrl}" class="read-more" target="_blank">Read full story →</a>
          </div>
        </div>
      `;
      }).join('<div class="section-divider"></div>')}
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} Navjivan. Inspired by Mahatma Gandhi's newspaper of 1919.</p>
      <p style="margin-top:6px;">You're receiving this because you subscribed to daily cloud industry intelligence.</p>
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

// No PDF attachments — articles sent as email body only
const attachments: any[] = [];

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Navjivan" <noreply@navjivan.com>',
      to: recipientEmail,
      subject: `Navjivan - ${formattedDate}`,
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
