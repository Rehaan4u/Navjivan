import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { storage } from "../storage";
import { buildEmailHtml } from "./email-template";

// ── SES Client Setup ──
const sesClient = new SESClient({
  region: "ap-south-2",   // hardcoded since AWS_REGION is reserved in Lambda
});

const USE_REAL_EMAIL = !!process.env.SES_FROM_ADDRESS;

if (USE_REAL_EMAIL) {
  console.log(`Email service: Using AWS SES`);
} else {
  console.log("Email service: Using mock mode (emails will be logged, not sent)");
}
 
// ── Fetch a relevant image URL for a given article headline ──
async function fetchArticleImage(
  headline: string,
  index: number,
  cloudProvider?: "AWS" | "Google" | "Azure"  // ✅ NEW: pass provider in
): Promise<string> {
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY || "";

  // Strip leading emoji
  const cleanHeadline = headline
    .replace(/^[\uD83C-\uDBFF][\uDC00-\uDFFF]/, "")
    .replace(/^[\u2600-\u27FF]\s*/, "")
    .trim();

  // ✅ IMPROVED: smarter keyword extraction
  // Keep words 3+ chars (was >3, so 4+), remove only stopwords not all short words
  const STOPWORDS = new Set([
    "the", "and", "for", "with", "that", "this", "its", "from", "has", "are",
    "will", "new", "how", "via", "into", "over", "than", "more", "now", "can",
    "all", "our", "you", "not", "but", "they", "their", "been", "have", "was",
  ]);

  const keywords = cleanHeadline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))  // ✅ 3+ chars, skip stopwords
    .slice(0, 4)                                          // ✅ up to 4 keywords (was 3)
    .join(" ");

  const searchQuery = keywords || cleanHeadline.split(" ").slice(0, 3).join(" "); // fallback

  // ── Try Unsplash ──
  if (unsplashKey) {
    try {
      const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(
        searchQuery
      )}&orientation=landscape&client_id=${unsplashKey}`;
      const response = await fetch(url, { headers: { "Accept-Version": "v1" } });

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

  // ✅ IMPROVED: Pollinations prompt now includes provider-specific context
  const providerContext: Record<string, string> = {
    AWS:    "Amazon Web Services data center, orange AWS branding, server infrastructure",
    Google: "Google Cloud Platform data center, Google blue branding, tech infrastructure",
    Azure:  "Microsoft Azure data center, blue Azure branding, enterprise cloud infrastructure",
  };

  const providerHint = cloudProvider ? providerContext[cloudProvider] : "cloud computing infrastructure, data center, technology";

  const imagePrompt = `Photorealistic editorial photograph: ${cleanHeadline}. ${providerHint}. Professional lighting, sharp focus, no text overlays, no logos, high resolution, wide angle`;

  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    imagePrompt
  )}?width=800&height=350&nologo=true&seed=${index + 7}&model=flux`;

  console.log(`[IMAGE] Pollinations fallback for: "${cleanHeadline}" (provider: ${cloudProvider ?? "generic"})`);
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
    const htmlBody = buildEmailHtml(formattedDate, articles, articleImages, newsletter);

          const textBody = `
      Navjivan — Daily Cloud Intelligence Briefing
      ${formattedDate}
      Companies: ${newsletter.companies}

      ${articles
        .map(
          (article, index) => `
      ${index + 1}. ${article.headline}

      ${article.summary}

      Source: ${article.sourceName || "Unknown"}
      Read more: ${article.sourceUrl || ""}
      `
        )
        .join("\n---------------------------------\n")}

      © ${new Date().getFullYear()} Navjivan
      `;
     
    // ── Build SES Command ──
    const command = new SendEmailCommand({
      Source: process.env.SES_FROM_ADDRESS!,
      Destination: {
        ToAddresses: [recipientEmail],
      },
      Message: {
        Subject: {
          Data: `Navjivan — Your Cloud Briefing · ${formattedDate}`,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: "UTF-8",
          },
          Text: {
            Data: textBody,
            Charset: "UTF-8",
          },
        },
      },
    });
 
    if (USE_REAL_EMAIL) {
      const response = await sesClient.send(command);
      console.log(`Email sent to ${recipientEmail}: MessageId=${response.MessageId}`);
    } else {
      console.log(`[MOCK] Email would be sent to: ${recipientEmail}`);
      console.log(`Subject: Navjivan — Your Cloud Briefing · ${formattedDate}`);
      console.log(`Articles: ${articles.length}`);
    }
 
    await storage.markNewsletterSent(newsletterId);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}