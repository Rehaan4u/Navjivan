// scraper.ts

import axios from "axios";
import * as cheerio from "cheerio";

export async function scrapeArticleContent(url: string): Promise<string> {
  try {
    console.log(`[SCRAPER] Fetching: ${url}`);

    const { data } = await axios.get(url, {
      timeout: 8000,
      headers: {
        // Pretend to be a browser so websites don't block us
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const $ = cheerio.load(data);

    // Remove all noise elements that are not article content
    $(
      "script, style, nav, footer, header, aside, .ad, .advertisement, .cookie-banner, .popup, iframe"
    ).remove();

    // Try common article content selectors in priority order
    const selectors = [
      "article",
      "[role='main']",
      ".article-body",
      ".article-content",
      ".post-content",
      ".entry-content",
      ".story-body",
      ".content-body",
      "main",
    ];

    for (const selector of selectors) {
      const text = $(selector).text().replace(/\s+/g, " ").trim();
      if (text.length > 200) {
        console.log(
          `[SCRAPER] ✅ Got ${text.length} chars from "${url}" using selector: ${selector}`
        );
        return text.slice(0, 3000); // cap at 3000 chars to avoid token limits
      }
    }

    // Fallback — grab all paragraphs if no article selector worked
    const fallback = $("p").text().replace(/\s+/g, " ").trim();
    if (fallback.length > 100) {
      console.log(
        `[SCRAPER] ⚠️  Used paragraph fallback for "${url}" — ${fallback.length} chars`
      );
      return fallback.slice(0, 3000);
    }

    console.log(`[SCRAPER] ❌ No content found for "${url}"`);
    return "";
  } catch (error: any) {
    console.log(`[SCRAPER] ❌ Failed to scrape "${url}": ${error?.message}`);
    return ""; // always return empty string on failure, never crash
  }
}