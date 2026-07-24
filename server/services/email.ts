import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { storage } from "storage";   // was "../storage"
import { buildEmailHtml } from "./email-template";

// ── SES Client Setup ──
const sesClient = new SESClient({
  region: "ap-south-1", // hardcoded since AWS_REGION is reserved in Lambda
});

const USE_REAL_EMAIL = !!process.env.SES_FROM_ADDRESS;

if (USE_REAL_EMAIL) {
  console.log(`Email service: Using AWS SES`);
} else {
  console.log(
    "Email service: Using mock mode (emails will be logged, not sent)"
  );
}

// ============================
// FETCH ARTICLE IMAGE
// ✅ Tries Unsplash first with smarter keyword extraction
// ✅ Falls back to Pollinations with provider-specific context
// ============================
async function fetchArticleImage(
  headline: string,
  index: number,
  cloudProvider?: "AWS" | "Google" | "Azure"
): Promise<string> {
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY || "";

  // Strip leading emoji from AI-generated headlines
  const cleanHeadline = headline
    .replace(/^[\uD83C-\uDBFF][\uDC00-\uDFFF]/, "")
    .replace(/^[\u2600-\u27FF]\s*/, "")
    .trim();

  // ✅ Smarter keyword extraction — 3+ chars, skip stopwords, take up to 4 words
  const STOPWORDS = new Set([
    "the", "and", "for", "with", "that", "this", "its", "from", "has", "are",
    "will", "new", "how", "via", "into", "over", "than", "more", "now", "can",
    "all", "our", "you", "not", "but", "they", "their", "been", "have", "was",
  ]);

  const keywords = cleanHeadline
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .slice(0, 4)
    .join(" ");

  // Fallback to first 3 raw words if no keywords extracted
  const searchQuery =
    keywords || cleanHeadline.split(" ").slice(0, 3).join(" ");

  // ── Try Unsplash first ──
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
          console.log(
            `[IMAGE] Unsplash: "${searchQuery}" → ${imageUrl.slice(0, 60)}...`
          );
          return imageUrl;
        }
      } else {
        console.warn(
          `[IMAGE] Unsplash returned ${response.status} for "${searchQuery}"`
        );
      }
    } catch (err) {
      console.warn(`[IMAGE] Unsplash fetch failed:`, err);
    }
  }

  // ── Fallback: Picsum Photos (free, no API key, seeded = deterministic) ──
  // Pollinations.ai started returning HTTP 402 (payment required) on free tier.
  // Picsum gives beautiful random photography, seeded so the same headline
  // always gets the same image (consistent across retries/re-renders).
  //
  // Seed strategy: combine provider + first 3 keywords for topic-appropriate images
  // e.g. "aws-ec2-graviton5" → always same photo, different from "azure-storage-blob"
  const providerPrefix = cloudProvider?.toLowerCase() ?? "cloud";
  const keywordSeed = keywords.replace(/\s+/g, "-").slice(0, 30) || "technology";
  const picsumSeed = `${providerPrefix}-${keywordSeed}-${index}`;

  const picsumUrl = `https://picsum.photos/seed/${encodeURIComponent(picsumSeed)}/800/350`;

  console.log(
    `[IMAGE] Picsum fallback: seed="${picsumSeed}" (provider: ${cloudProvider ?? "generic"})`
  );
  return picsumUrl;
}

// ============================
// EMBED IMAGE AS BASE64
// ✅ Fetches raw image bytes and converts to data URI
// ✅ This prevents Gmail spam-filtering external image URLs
// ✅ Returns empty string on failure — email still sends, just no image
// ============================
async function fetchAndEmbedImage(imageUrl: string): Promise<string> {
  // Skip embedding if no URL (e.g. image fetch already failed upstream)
  if (!imageUrl) return "";

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      console.warn(`[IMAGE] Embed failed — HTTP ${response.status} for ${imageUrl.slice(0, 60)}`);
      return "";
    }

    // Read the raw bytes of the image (jpeg/png/webp/etc.)
    // arrayBuffer = raw bytes as a binary buffer, not yet readable as text
    const arrayBuffer = await response.arrayBuffer();

    // Convert raw bytes → base64 string so it can live inside an HTML attribute
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // content-type tells us if it's image/jpeg, image/png, image/webp, etc.
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Final format: data:<type>;base64,<bytes>
    // This is a self-contained image — no external URL needed
    const dataUri = `data:${contentType};base64,${base64}`;

    console.log(
      `[IMAGE] ✅ Embedded ${Math.round(arrayBuffer.byteLength / 1024)}KB as base64 (${contentType})`
    );
    return dataUri;
  } catch (err) {
    console.warn(`[IMAGE] Embed fetch failed:`, err);
    return ""; // graceful fallback — never crash email sending
  }
}

// ============================
// SEND NEWSLETTER EMAIL
// ============================
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

    // ── Determine the cloud provider from the newsletter companies field ──
    // Used to give Pollinations provider-specific image context
    const companiesRaw = (newsletter.companies || "").toLowerCase();
    let cloudProvider: "AWS" | "Google" | "Azure" | undefined;
    if (companiesRaw.includes("aws") || companiesRaw.includes("amazon")) {
      cloudProvider = "AWS";
    } else if (companiesRaw.includes("google")) {
      cloudProvider = "Google";
    } else if (companiesRaw.includes("azure") || companiesRaw.includes("microsoft")) {
      cloudProvider = "Azure";
    }

    // ── Step 1: Fetch raw image URLs ──
    console.log(`[IMAGE] Fetching images for ${articles.length} articles...`);
    const rawImageUrls: string[] = await Promise.all(
      articles.map((article, index) =>
        fetchArticleImage(article.headline, index, cloudProvider)
      )
    );

    // ── Step 2: Embed each image as base64 ──
    // This is what keeps emails out of spam — no external domains in the HTML
    console.log(`[IMAGE] Embedding ${rawImageUrls.length} images as base64...`);
    const articleImages: string[] = await Promise.all(
      rawImageUrls.map((url) => fetchAndEmbedImage(url))
    );
    console.log(`[IMAGE] All images embedded ✅`);

    // ── Step 3: Build HTML with embedded images ──
    const htmlBody = buildEmailHtml(
      formattedDate,
      articles,
      articleImages,
      newsletter
    );

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
      console.log(
        `Email sent to ${recipientEmail}: MessageId=${response.MessageId}`
      );
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