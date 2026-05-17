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
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Navjivan</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#EEF4FB;font-family:Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF4FB;padding:24px 0;">
    <tr>
      <td align="center">

        <!-- Main content table -->
        <table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,82,204,0.10);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0052CC 0%,#0747A6 100%);padding:40px 48px 32px;text-align:center;border-bottom:4px solid #4C9AFF;">
              <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:3px;color:#4C9AFF;text-transform:uppercase;font-family:Arial,sans-serif;">Daily Cloud Intelligence Briefing</p>
              <h1 style="margin:0 0 6px;font-size:34px;font-weight:700;color:#ffffff;font-family:Georgia,serif;letter-spacing:-0.5px;">Navjivan</h1>
              <p style="margin:0 0 20px;font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Est. 1919 · Reborn in AI</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:4px;padding:8px 20px;">
                    <span style="font-size:13px;color:#ffffff;font-family:Arial,sans-serif;"><strong>${formattedDate}</strong> &nbsp;·&nbsp; ${articles.length} stories today</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- EDITION BAR -->
          <tr>
            <td style="background:#F0F6FF;border-bottom:1px solid #DEEBFF;padding:12px 48px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px;color:#5E6C84;font-family:Arial,sans-serif;">${formattedDate}</td>
                  <td align="right" style="font-size:11px;color:#0052CC;font-family:Arial,sans-serif;font-weight:700;">Tracking: ${newsletter.companies}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ARTICLES -->
          <tr>
            <td style="padding:0 48px 40px;background:#ffffff;">

              ${articles.map((article, index) => {
                const imagePrompt = `${article.headline}, cloud computing, technology, professional, cinematic lighting, 4k`;
                const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=800&height=350&nologo=true&seed=${index + 42}`;

                return `
              <!-- ARTICLE ${index + 1} -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:36px;border-bottom:2px solid #DEEBFF;padding-bottom:36px;">
                <tr>
                  <td>

                    <!-- Story label -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                      <tr>
                        <td style="background:#EEF4FF;border-left:3px solid #0052CC;padding:4px 12px;border-radius:0 4px 4px 0;">
                          <span style="font-size:10px;font-weight:700;letter-spacing:3px;color:#0052CC;text-transform:uppercase;font-family:Arial,sans-serif;">Story ${index + 1} of ${articles.length}</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Article image -->
                    <img
                      src="${imageUrl}"
                      alt="${article.headline}"
                      width="584"
                      style="width:100%;max-width:584px;height:auto;display:block;border-radius:8px;margin-bottom:20px;border:1px solid #DEEBFF;"
                    />

                    <!-- Headline -->
                    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0747A6;font-family:Georgia,serif;line-height:1.4;border-bottom:1px solid #EEF4FF;padding-bottom:12px;">${article.headline}</h2>

                    <!-- Summary box -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                      <tr>
                        <td style="background:#F8FBFF;border-left:3px solid #4C9AFF;border-radius:0 6px 6px 0;padding:16px 20px;">
                          <p style="margin:0;font-size:15px;line-height:1.85;color:#1A1A2E;font-family:Georgia,serif;font-weight:400;">${article.summary}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Source + Read more -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #EBECF0;padding-top:14px;">
                      <tr>
                        <td style="font-size:11px;font-weight:700;color:#5E6C84;text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,sans-serif;">${article.sourceName}</td>
                        <td align="right"><a href="${article.sourceUrl}" target="_blank" style="font-size:13px;color:#0052CC;text-decoration:none;font-weight:600;font-family:Arial,sans-serif;">Read full story →</a></td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>
              `;
              }).join("")}

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:linear-gradient(135deg,#0052CC 0%,#0747A6 100%);padding:28px 48px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.5);font-family:Arial,sans-serif;">© ${new Date().getFullYear()} Navjivan. Inspired by Mahatma Gandhi's newspaper of 1919.</p>
              <p style="margin:0 0 8px;font-size:11px;color:rgba(255,255,255,0.4);font-family:Arial,sans-serif;">You're receiving this because you subscribed to daily cloud industry intelligence.</p>
              <p style="margin:0;font-size:11px;font-family:Arial,sans-serif;">
                <a href="#" style="color:rgba(255,255,255,0.6);text-decoration:none;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="#" style="color:rgba(255,255,255,0.6);text-decoration:none;">Privacy Policy</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- End main content table -->

      </td>
    </tr>
  </table>

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
