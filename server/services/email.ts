import * as nodemailer from "nodemailer";
import { storage } from "../storage";
import fs from "fs";

// For MVP: Log emails instead of sending
// In production: Configure with real SMTP credentials
const USE_REAL_EMAIL = false;

// Initialize transporter lazily to avoid module loading issues
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = USE_REAL_EMAIL
      ? nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        })
      : nodemailer.createTransport({
          jsonTransport: true, // For testing/development
        });
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
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #217BF4; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #217BF4; margin: 0; font-size: 24px; }
    .header p { color: #666; margin: 5px 0; font-size: 14px; }
    .article { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #E0E0E0; }
    .article h2 { color: #000; font-size: 18px; margin-bottom: 10px; font-family: 'Lora', Georgia, serif; }
    .article p { color: #555; font-size: 14px; line-height: 1.6; }
    .article .source { color: #999; font-size: 12px; margin-top: 10px; }
    .article a { color: #217BF4; text-decoration: none; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E0E0E0; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Payment Chronicle by Gajanan</h1>
    <p>${formattedDate}</p>
    <p style="color: #999;">Companies: ${newsletter.companies}</p>
  </div>

  ${articles
    .map(
      (article, index) => `
    <div class="article">
      <h2>${article.headline}</h2>
      <p>${article.summary}</p>
      <div class="source">
        <strong>${article.sourceName}</strong> • 
        <a href="${article.sourceUrl}" target="_blank">Read more</a>
      </div>
    </div>
  `
    )
    .join("")}

  <div class="footer">
    <p>© 2025 Payment Chronicle by Gajanan. All rights reserved.</p>
    <p>You're receiving this because you subscribed to daily payments industry news.</p>
  </div>
</body>
</html>`;

    // Plain text version for email clients that don't support HTML
    const textBody = `
Payment Chronicle by Gajanan
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
      from: '"Payment Chronicle" <noreply@paymentchronicle.com>',
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
