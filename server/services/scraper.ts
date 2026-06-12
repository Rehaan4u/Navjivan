import axios from "axios";
import * as cheerio from "cheerio";

// ============================
// EXTRACT REAL URL FROM GOOGLE NEWS DESCRIPTION
// ──────────────────────────────────────────────
// Google News RSS items look like this in raw XML:
//
//   <item>
//     <title>AWS launches new service</title>
//     <link>https://news.google.com/rss/articles/CBMi...  ← opaque redirect token
//     <description>
//       <a href="https://techcrunch.com/2026/06/article">TechCrunch</a>
//     </description>                ↑ REAL URL is here, in the description href
//   </item>
//
// The token in <link> is a server-side opaque blob — the real URL is NOT
// encoded inside it (Google changed this). The real URL is in <description>.
//
// rss-parser gives us item.description which contains that HTML string.
// We just extract the href from it.
// ============================
export function extractRealUrlFromGoogleDescription(description: string | undefined): string | null {
  if (!description) return null;

  // description HTML looks like: <a href="https://techcrunch.com/...">Source Name</a>
  const match = description.match(/href=["']([^"']+)["']/);
  if (match?.[1] && !match[1].includes("google.com")) {
    return match[1];
  }
  return null;
}

// ============================
// SCRAPE ARTICLE CONTENT
// ✅ Works for server-rendered HTML (most blogs, news sites)
// ✅ Does NOT work for JS-rendered SPAs — for those, paragraph fallback is best we can do
// ============================
export async function scrapeArticleContent(url: string): Promise<string> {
  try {
    // Reject Google News redirect URLs outright — they can't be scraped directly.
    // The caller (fetchAndScrapeGoogleNews) should have already resolved these
    // to real article URLs using extractRealUrlFromGoogleDescription().
    // If we still get a Google URL here, it means resolution failed — skip it.
    if (url.includes("news.google.com")) {
      console.log(`[SCRAPER] ❌ Skipping unresolved Google URL: ${url.slice(0, 60)}`);
      return "";
    }

    console.log(`[SCRAPER] Fetching: ${url.slice(0, 80)}`);

    const { data } = await axios.get(url, {
      timeout: 8000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        // Some sites check Referer — without it they serve a paywall or redirect
        "Referer": "https://www.google.com/",
      },
    });

    const $ = cheerio.load(data);

    // Remove all noise — nav, ads, footers, sidebars, cookie banners
    $(
      "script, style, nav, footer, header, aside, " +
      ".ad, .advertisement, .cookie-banner, .popup, iframe, " +
      ".sidebar, .related-articles, .comments, .social-share, " +
      ".newsletter-signup, .subscription-wall, .paywall"
    ).remove();

    // Try specific article selectors first (most reliable)
    const selectors = [
      "article",
      "[role='main']",
      ".article-body",
      ".article-content",
      ".post-content",
      ".entry-content",
      ".story-body",
      ".content-body",
      ".article__body",
      ".post__content",
      ".blog-post-content",
      ".prose",
      "main",
    ];

    for (const selector of selectors) {
      const text = $(selector).text().replace(/\s+/g, " ").trim();
      if (text.length > 200) {
        const wordCount = text.split(/\s+/).length;
        console.log(
          `[SCRAPER] ✅ ${wordCount} words via "${selector}": ${url.slice(0, 60)}`
        );
        return text.slice(0, 3000);
      }
    }

    // Fallback: grab individual paragraphs, filter out short UI strings
    // (nav labels, button text, etc. are usually < 40 chars)
    const fallback = $("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 40)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (fallback.length > 200) {
      const wordCount = fallback.split(/\s+/).length;
      console.log(
        `[SCRAPER] ⚠️  Paragraph fallback: ${wordCount} words from ${url.slice(0, 60)}`
      );
      return fallback.slice(0, 3000);
    }

    console.log(`[SCRAPER] ❌ No content found for "${url.slice(0, 60)}"`);
    return "";
  } catch (error: any) {
    console.log(`[SCRAPER] ❌ Failed "${url.slice(0, 60)}": ${error?.message}`);
    return "";
  }
}