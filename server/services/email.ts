import * as nodemailer from "nodemailer";
import { storage } from "../storage";

const USE_REAL_EMAIL = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

if (USE_REAL_EMAIL) {
  console.log(`Email service: Using SMTP at ${process.env.SMTP_HOST}`);
} else {
  console.log("Email service: Using mock mode (emails will be logged, not sent)");
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    if (USE_REAL_EMAIL) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST!,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_PORT === "465",
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!,
        },
      });
    } else {
      transporter = nodemailer.createTransport({ jsonTransport: true });
    }
  }
  return transporter;
}

// ── Fetch a relevant image URL for a given article headline ──
async function fetchArticleImage(headline: string, index: number): Promise<string> {
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY || "";

  // Strip leading emoji from AI-generated headlines
  const cleanHeadline = headline
  .replace(/^[\uD83C-\uDBFF][\uDC00-\uDFFF]/, "")
  .replace(/^[\u2600-\u27FF]\s*/, "")
  .trim();

  // Build a focused 2-3 word search query from the headline
  const searchQuery = cleanHeadline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(" ")
    .filter((w: string) => w.length > 3)
    .slice(0, 3)
    .join(" ");

  // ── Try Unsplash first ──
  if (unsplashKey) {
    try {
      const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(searchQuery + " technology")}&orientation=landscape&client_id=${unsplashKey}`;
      const response = await fetch(url, {
        headers: { "Accept-Version": "v1" },
      });

      if (response.ok) {
        const data = await response.json();
        const imageUrl = data?.urls?.regular || data?.urls?.full || "";
        if (imageUrl) {
          console.log(`[IMAGE] Unsplash: "${searchQuery}" → ${imageUrl.slice(0, 60)}...`);
          return imageUrl;
        }
      } else {
        console.warn(`[IMAGE] Unsplash returned ${response.status} for "${searchQuery}"`);
      }
    } catch (err) {
      console.warn(`[IMAGE] Unsplash fetch failed:`, err);
    }
  }

  // ── Fallback: Pollinations AI ──
  const imagePrompt = `Photorealistic editorial news photograph: ${cleanHeadline}. Professional lighting, sharp focus, no text, no logos, high resolution`;
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=800&height=350&nologo=true&seed=${index + 7}&model=flux`;
  console.log(`[IMAGE] Pollinations fallback for: "${cleanHeadline}"`);
  return pollinationsUrl;
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

    // ── Pre-fetch all article images before building HTML ──
    console.log(`[IMAGE] Fetching images for ${articles.length} articles...`);
    const articleImages: string[] = await Promise.all(
      articles.map((article, index) => fetchArticleImage(article.headline, index))
    );
    console.log(`[IMAGE] All images ready`);

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
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;padding:0;">
    <tr>
      <td align="center">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:700px;width:100%;background:#ffffff;">

          <!-- HEADER -->
          <tr>
            <td style="padding:40px 48px 24px;text-align:center;border-bottom:2px solid #0052CC;">
              <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:3px;color:#0052CC;text-transform:uppercase;font-family:Arial,sans-serif;">Daily Cloud Intelligence Briefing</p>
              <h1 style="margin:0 0 4px;font-size:40px;font-weight:900;color:#0A0F2E;font-family:Georgia,serif;letter-spacing:-1px;">Navjivan</h1>
              <p style="margin:0 0 16px;font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">Est. 1919 · Reborn in AI</p>
              <p style="margin:0;font-size:13px;color:#444;font-family:Arial,sans-serif;"><strong>${formattedDate}</strong> &nbsp;·&nbsp; ${articles.length} stories today</p>
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
                const imageUrl = articleImages[index] || "";
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
                    ${imageUrl ? `<img
                      src="${imageUrl}"
                      alt="${article.headline.replace(/"/g, "&quot;")}"
                      width="604"
                      style="width:100%;max-width:604px;height:280px;object-fit:cover;display:block;border-radius:8px;margin-bottom:20px;border:1px solid #DEEBFF;"
                    />` : ""}

                    <!-- Headline -->
                    <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0747A6;font-family:Georgia,serif;line-height:1.4;border-bottom:2px solid #EEF4FF;padding-bottom:12px;">${article.headline}</h2>

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
            <td style="background:#F8F9FA;border-top:1px solid #DEEBFF;padding:28px 48px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:#888;font-family:Arial,sans-serif;">© ${new Date().getFullYear()} Navjivan. Inspired by Mahatma Gandhi's newspaper of 1919.</p>
              <p style="margin:0 0 8px;font-size:11px;color:#aaa;font-family:Arial,sans-serif;">You're receiving this because you subscribed to daily cloud industry intelligence.</p>
              <p style="margin:0;font-size:11px;font-family:Arial,sans-serif;">
                <a href="#" style="color:#0052CC;text-decoration:none;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="#" style="color:#0052CC;text-decoration:none;">Privacy Policy</a>
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;

    const textBody = `
Navjivan — Daily Cloud Intelligence Briefing
${formattedDate}
Companies: ${newsletter.companies}

${articles.map((article, index) => `
${index + 1}. ${article.headline}

${article.summary}

Source: ${article.sourceName}
Read more: ${article.sourceUrl}
`).join("\n---\n")}

© ${new Date().getFullYear()} Navjivan. Inspired by Mahatma Gandhi's newspaper of 1919.
`;

    const attachments: any[] = [];

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Navjivan" <noreply@navjivan.com>',
      to: recipientEmail,
      subject: `Navjivan — Your Cloud Briefing · ${formattedDate}`,
      text: textBody,
      html: htmlBody,
      attachments,
    };

    if (USE_REAL_EMAIL) {
      const info = await getTransporter().sendMail(mailOptions);
      console.log(`Email sent to ${recipientEmail}: ${info.messageId}`);
    } else {
      console.log(`[MOCK] Email would be sent to: ${recipientEmail}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Articles: ${articles.length}`);
    }

    await storage.markNewsletterSent(newsletterId);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}