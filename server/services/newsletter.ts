import { storage } from "../storage";
import type { Article } from "@shared/schema";
import { scrapeArticleContent, extractRealUrlFromGoogleDescription } from "./scraper";
import { recordFeedHealth, printFeedHealthSummary } from "./feedHealth";
import { generateNewsSummary, scoreArticleRelevance } from "../bedrock";
import Parser from "rss-parser";
import pLimit from "p-limit";
import { createHash } from "crypto";

// ============================
// INTERFACE
// ============================
interface NewsItem {
  title: string;
  text: string;
  url: string;
  source: string;
  publishedAt: Date;
  fetchMethod: "rss" | "scraped"; // ✅ track how content was obtained
}

// ============================
// CONSTANTS
// ============================
const MAX_ARTICLES_PER_SOURCE = 50;    // max articles taken from any one source
const BATCH_SIZE = 5;                   // score 5 articles at a time
const RELEVANCE_THRESHOLD = 60;         // minimum score to pass
// BATCH_PASS_THRESHOLD removed — early stopping caused too few articles (see scoreArticlesInBatches)
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Minimum word count for an article to be worth summarizing.
// A 3-paragraph AI summary needs real content to work from.
// 80 words ≈ ~500 chars — catches teaser snippets (which are ~15-25 words)
// while allowing shorter-but-complete articles through.
const MIN_WORD_COUNT = 150; // raised from 80 — filters thin whitepapers/press releases

// ============================
// RSS SOURCES
// ✅ Official + practitioner-focused feeds for cloud engineers
// ============================
const CURATED_RSS_FEEDS = [
  // Official cloud provider engineering blogs
  { name: "AWS Blog",              url: "https://aws.amazon.com/blogs/aws/feed/" },
  { name: "AWS Architecture Blog", url: "https://aws.amazon.com/blogs/architecture/feed/" },
  { name: "Google Cloud Blog",     url: "https://cloudblog.withgoogle.com/rss/" },
  { name: "Azure Blog",            url: "https://azure.microsoft.com/en-us/blog/feed/" },
  // Engineering practices & techniques
  { name: "The New Stack",         url: "https://thenewstack.io/feed/" },
  { name: "InfoQ Cloud",           url: "https://feed.infoq.com/cloud/" },
  { name: "Last Week in AWS",      url: "https://www.lastweekinaws.com/feed/" },
  { name: "Cloud Native Now",      url: "https://cloudnativenow.com/feed/" },
  // Community / practitioner focused
  { name: "CNCF Blog",             url: "https://www.cncf.io/blog/feed/" },
  { name: "Kubernetes Blog",       url: "https://kubernetes.io/feed.xml" },
];

// ============================
// UTILITY: ONE WEEK FILTER
// ✅ Only keep articles published in the last 7 days
// ============================
function isWithinOneWeek(date: Date): boolean {
  return new Date().getTime() - date.getTime() <= ONE_WEEK_MS;
}

// ============================
// UTILITY: CONTENT HASH
// ✅ MD5 fingerprint of all article URLs — used to detect duplicate batches
// ✅ Sorted before hashing so order doesn't affect the result
// ============================
export function computeContentHash(urls: string[]): string {
  const sorted = [...urls].sort().join("|");
  return createHash("md5").update(sorted).digest("hex");
}

// ============================
// UTILITY: STOP WORDS + FINGERPRINT
// ============================
const STOP_WORDS = new Set([
  "the", "a", "an", "in", "of", "for", "to", "is",
  "and", "or", "with", "on", "at", "by",
]);

function titleFingerprint(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w));
  return words
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
    .sort()
    .join("-");
}

// ============================
// UTILITY: WORD COUNT FILTER
// ✅ More reliable than char count — a 150-char snippet is only ~20 words,
//    not enough for the LLM to write 3 meaningful paragraphs
// ============================
function isArticleSubstantial(item: { title: string; text: string }): boolean {
  const wordCount = item.text.trim().split(/\s+/).length;
  const ok = wordCount >= MIN_WORD_COUNT;
  if (!ok) {
    console.log(
      `[FILTER] ⚠️  Skipped stub: "${item.title.substring(0, 50)}" — only ${wordCount} words (need ${MIN_WORD_COUNT})`
    );
  }
  return ok;
}

// ============================
// STEP 1A: FETCH ONE CURATED RSS FEED
// ✅ Records health, filters to 1 week
// ✅ RSS feeds send short teasers (30-70 words) — scrapes the full article
//    for any item that doesn't pass the word count gate
// ============================
async function fetchSingleFeed(
  url: string,
  sourceName: string,
  parser: Parser
): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(url);

    // Build raw items from the RSS feed — text here is usually a short teaser
    const rawItems = (feed.items || [])
      .map((item) => ({
        title: item.title || "",
        text: item.contentSnippet || item.content || item.title || "",
        url: item.link || "",
        source: sourceName,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        fetchMethod: "rss" as const,
      }))
      .filter((item) => isWithinOneWeek(item.publishedAt))
      .slice(0, MAX_ARTICLES_PER_SOURCE);

    console.log(`[RSS] ${sourceName}: ${rawItems.length} raw items (within 1 week)`);

    // ✅ For every item that doesn't pass the word count gate, scrape the full article.
    // Most RSS feeds (AWS Blog, New Stack, CNCF etc.) intentionally truncate their feeds
    // to short teasers to drive traffic to their site. We need to follow the link.
    const scrapeLimit = pLimit(3); // don't hammer sites — max 3 concurrent scrapes per feed
    const enriched = await Promise.all(
      rawItems.map((article) =>
        scrapeLimit(async () => {
          if (isArticleSubstantial(article)) {
            // RSS gave us enough content — no scrape needed
            return article;
          }

          // RSS teaser is too short — fetch the full article page
          console.log(
            `[RSS] 🔍 Scraping stub from ${sourceName}: "${article.title.substring(0, 50)}"`
          );
          const scrapedText = await scrapeArticleContent(article.url);

          if (scrapedText && scrapedText.trim().split(/\s+/).length >= MIN_WORD_COUNT) {
            console.log(
              `[RSS] ✅ Scraped "${article.title.substring(0, 50)}" — ${scrapedText.trim().split(/\s+/).length} words`
            );
            return { ...article, text: scrapedText, fetchMethod: "scraped" as const };
          }

          // Scrape also failed or returned too little — return original for final filter
          return article;
        })
      )
    );

    // Final word count gate — drop anything still too short after scraping
    const items = enriched.filter(isArticleSubstantial);

    recordFeedHealth(sourceName, items.length);
    console.log(
      `[RSS] ${sourceName}: ${items.length} articles passed (≥${MIN_WORD_COUNT} words)`
    );
    return items;
  } catch (error: any) {
    recordFeedHealth(sourceName, 0, error?.message || "Unknown error");
    console.error(`[RSS] ❌ ${sourceName} failed: ${error?.message}`);
    return [];
  }
}

// ============================
// STEP 1B: FETCH GOOGLE RSS + SCRAPE CONTENT
// ──────────────────────────────────────────────────────────────────────
// Google News RSS URL extraction — three strategies tried in order:
//
// Strategy 1: item.description contains <a href="https://real-url">Source</a>
//   Works for article cluster results (older/US Google News format)
//
// Strategy 2: item['source']?.['$']?.url gives the publisher domain
//   e.g. "https://techcrunch.com" — use with item.link as the full URL
//   Works when description is plain text (newer format)
//   NOTE: rss-parser needs customFields: { item: ['source'] } to expose this
//
// Strategy 3: Skip Google News entirely for this run if both fail
//   Better to have 0 Google articles than thin press releases
// ============================
async function fetchAndScrapeGoogleNews(
  company: string,
  parser: Parser
): Promise<NewsItem[]> {
  // More specific query reduces press releases and stock articles
  const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
    company + " cloud engineering"
  )}&hl=en-US&gl=US&ceid=US:en`;

  // ✅ Use a parser instance that captures the <source> XML attribute
  // rss-parser by default drops XML attributes — we need customFields to keep them
  const googleParser = new Parser({
    timeout: 10000,
    customFields: {
      item: [
        ["source", "source", { keepArray: false }],
      ],
    },
  });

  try {
    const feed = await googleParser.parseURL(googleNewsUrl);

    const recentItems = (feed.items || [])
      .map((item: any) => {
        // Strategy 1: extract from description href
        let realUrl = extractRealUrlFromGoogleDescription(item.description);

        // Strategy 2: use the <source url="..."> attribute as publisher domain
        // The source tag looks like: <source url="https://techcrunch.com">TechCrunch</source>
        // rss-parser parses this as: item.source = { $: { url: "https://..." }, _: "TechCrunch" }
        if (!realUrl && item.source) {
          const sourceUrl = item.source?.["$"]?.url || item.source?.url;
          if (sourceUrl && !sourceUrl.includes("google.com")) {
            // sourceUrl is the publisher DOMAIN (e.g. "https://techcrunch.com")
            // item.link is the Google redirect — we can't use it
            // But the title + domain tells us enough to log and skip gracefully
            console.log(`[Google RSS] ℹ️  Publisher domain only for: "${item.title?.substring(0, 50)}" → ${sourceUrl}`);
            // Don't set realUrl — we can't scrape without the full article URL
          }
        }

        return {
          title: item.title || "",
          text: item.contentSnippet || item.content || "",
          url: realUrl || item.link || "",
          source: "Google News",
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          fetchMethod: "rss" as const,
        };
      })
      .filter((item: any) => isWithinOneWeek(item.publishedAt))
      .filter((item: any) => {
        if (item.url.includes("news.google.com")) {
          console.log(`[Google RSS] ⚠️  No real URL extracted for: "${item.title.substring(0, 50)}"`);
          return false;
        }
        return true;
      })
      .slice(0, MAX_ARTICLES_PER_SOURCE);

    console.log(
      `[Google RSS] ${recentItems.length} articles with real URLs for "${company}"`
    );

    if (recentItems.length === 0) {
      console.log(`[Google RSS] ℹ️  No scrapable Google articles — Google may have changed description format`);
      recordFeedHealth("Google News", 0);
      return [];
    }

    // Scrape full content from real article URLs
    const scrapeLimit = pLimit(3);
    const enriched = await Promise.all(
      recentItems.map((article: any) =>
        scrapeLimit(async () => {
          const scrapedText = await scrapeArticleContent(article.url);
          if (scrapedText) {
            const wordCount = scrapedText.trim().split(/\s+/).length;
            console.log(`[SCRAPER] ✅ "${article.title.substring(0, 50)}" — ${wordCount} words`);
            return { ...article, text: scrapedText, fetchMethod: "scraped" as const };
          }
          console.log(`[SCRAPER] ❌ No content: "${article.title.substring(0, 50)}"`);
          return article;
        })
      )
    );

    const filtered = enriched.filter(isArticleSubstantial);
    console.log(`[Google RSS] ${filtered.length}/${recentItems.length} articles passed (≥${MIN_WORD_COUNT} words)`);

    recordFeedHealth("Google News", filtered.length);
    return filtered;
  } catch (error: any) {
    recordFeedHealth("Google News", 0, error?.message);
    console.error(`[Google RSS] ❌ Failed: ${error?.message}`);
    return [];
  }
}

// ============================
// STEP 2: REMOVE DUPLICATES
// ============================
function removeDuplicates(articles: NewsItem[]): NewsItem[] {
  const urlSet = new Set<string>();
  const fingerprintSet = new Set<string>();
  const unique: NewsItem[] = [];

  for (const article of articles) {
    const fp = titleFingerprint(article.title);
    if (urlSet.has(article.url) || fingerprintSet.has(fp)) {
      console.log(`[DEDUP] Removed: "${article.title}"`);
      continue;
    }
    urlSet.add(article.url);
    fingerprintSet.add(fp);
    unique.push(article);
  }

  console.log(
    `[DEDUP] ${unique.length} unique (removed ${articles.length - unique.length})`
  );
  return unique;
}

// ============================
// STEP 3: KEYWORD FILTER
// ============================
function filterRelevantArticles(
  articles: NewsItem[],
  company: string
): NewsItem[] {
  const CLOUD_KEYWORDS = [
    "cloud", "aws", "azure", "google cloud", "gcp", "kubernetes",
    "docker", "serverless", "lambda", "ec2", "s3", "azure",
    "devops", "infrastructure", "saas", "paas", "iaas",
    "data center", "migration", "hybrid cloud", "multi-cloud",
    "machine learning", "ai", "artificial intelligence", "llm",
    "compute", "storage", "networking", "security", "compliance",
    "microservices", "api", "ci/cd", "devsecops", "observability",
    "revenue", "earnings", "partnership", "acquisition", "growth",
    "outage", "downtime", "region", "availability zone", "latency",
  ];

  return articles.filter((article) => {
    const combinedText = `${article.title} ${article.text}`.toLowerCase();
    const mentionsCompany = combinedText.includes(company.toLowerCase());
    const hasKeyword = CLOUD_KEYWORDS.some((kw) =>
      combinedText.includes(kw.toLowerCase())
    );
    const isRelevant = mentionsCompany || hasKeyword;
    if (!isRelevant) {
      console.log(`[FILTER] Rejected: "${article.title}"`);
    }
    return isRelevant;
  });
}

// ============================
// STEP 4: BATCH SCORING
// ✅ Scores ALL articles but in batches of 5
// ✅ If 3+ pass in a batch → stop early for this source (enough found)
// ✅ If 0 pass in a batch → try next 5 from same source
// ============================
async function scoreArticlesInBatches(
  articles: NewsItem[],
  company: string
): Promise<Array<NewsItem & { relevanceScore: number }>> {
  const passed: Array<NewsItem & { relevanceScore: number }> = [];
  const limit = pLimit(3);

  console.log(
    `[SCORING] ${articles.length} articles to score in batches of ${BATCH_SIZE}`
  );

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(
      `[SCORING] Batch ${batchNum}: scoring ${batch.length} articles [${batch[0]?.source}...]`
    );

    const scoredBatch = await Promise.all(
      batch.map((article) =>
        limit(async () => {
          const score = await scoreArticleRelevance(
            article.title,
            article.text,
            company
          );
          console.log(
            `[SCORING] [${article.fetchMethod}] "${article.title.substring(0, 50)}" → ${score}/100`
          );
          return { ...article, relevanceScore: score };
        })
      )
    );

    const batchPassed = scoredBatch.filter((a) => {
      const passed = a.relevanceScore >= RELEVANCE_THRESHOLD;
      if (!passed) {
        console.log(
          `[SCORING] Rejected (score ${a.relevanceScore} < ${RELEVANCE_THRESHOLD}): "${a.title.substring(0, 50)}"`
        );
      }
      return passed;
    });

    console.log(
      `[SCORING] Batch ${batchNum} result: ${batchPassed.length}/${batch.length} passed`
    );

    passed.push(...batchPassed);

    // ✅ No early stopping — score ALL articles across ALL sources.
    // Early stopping caused: 4 AWS Blog articles pass in batch 1 → stop →
    // never score The New Stack or CNCF → get capped to 2 AWS articles → only 2 in email.
    // Now we score everything and let capArticlesPerSource handle diversity.
    if (batchPassed.length === 0 && i + BATCH_SIZE < articles.length) {
      console.log(`[SCORING] Batch ${batchNum}: 0 passed — continuing...`);
    }
  }

  return passed.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ============================
// STEP 5: CAP TOP N PER SOURCE
// ✅ Articles already sorted by score desc before this runs
// ============================
export function capArticlesPerSource(
  articles: Array<NewsItem & { relevanceScore: number }>,
  maxPerSource: number = 2
): Array<NewsItem & { relevanceScore: number }> {
  const sourceCount = new Map<string, number>();
  const result: Array<NewsItem & { relevanceScore: number }> = [];

  for (const article of articles) {
    const count = sourceCount.get(article.source) || 0;
    if (count < maxPerSource) {
      result.push(article);
      sourceCount.set(article.source, count + 1);
    } else {
      console.log(
        `[CAP] Skipped (source limit): "${article.title.substring(0, 50)}" from ${article.source}`
      );
    }
  }

  console.log(
    `[CAP] ${result.length} articles after capping ${maxPerSource} per source (was ${articles.length})`
  );
  return result;
}

// ============================
// DYNAMIC ARTICLE LIMIT
// ✅ Always 6 total articles regardless of company count
// ============================
function getArticlesPerCompany(companyCount: number): number {
  if (companyCount === 1) return 6;
  if (companyCount === 2) return 3;
  if (companyCount === 3) return 2;
  return Math.max(1, Math.floor(6 / companyCount));
}

// ============================
// FILTER ALREADY SENT ARTICLES
// ✅ Prevents same article appearing in multiple newsletters
// ============================
export async function filterAlreadySentArticles(
  articles: NewsItem[],
  subscriptionId: string
): Promise<NewsItem[]> {
  try {
    const sentUrls = new Set<string>();

    const lastNewsletter =
      await storage.getLastNewsletterBySubscription(subscriptionId);

    if (lastNewsletter) {
      // Only filter articles from newsletters sent in the last 6 hours
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const newsletterTime = new Date(lastNewsletter.generatedAt!);

      if (newsletterTime > sixHoursAgo) {
        const prevArticles = await storage.getNewsletterArticles(
          lastNewsletter.id
        );
        prevArticles.forEach((a: Article) => sentUrls.add(a.sourceUrl));
        console.log(
          `[SENT-FILTER] Found ${prevArticles.length} articles in last newsletter (within 6h)`
        );
      } else {
        console.log(
          `[SENT-FILTER] Last newsletter was more than 6h ago — allowing all articles`
        );
      }
    }

    console.log(`[SENT-FILTER] ${sentUrls.size} URLs already sent`);

    const fresh = articles.filter((article) => {
      if (sentUrls.has(article.url)) {
        console.log(
          `[SENT-FILTER] Skipping already-sent: "${article.title.substring(0, 50)}"`
        );
        return false;
      }
      return true;
    });

    console.log(
      `[SENT-FILTER] ${fresh.length}/${articles.length} articles are fresh`
    );
    return fresh;
  } catch (error) {
    console.error(`[SENT-FILTER] Error checking sent articles:`, error);
    return articles; // safe fallback — never crash newsletter generation
  }
}

// ============================
// MAIN FETCH FUNCTION PER COMPANY
// ✅ Curated RSS first → score → if not enough → Google RSS + scrape → score
// ============================
async function fetchNewsForCompany(
  company: string,
  articleLimit: number = 2
): Promise<NewsItem[]> {
  const parser = new Parser({ timeout: 10000 });
  const fetchLimit = pLimit(5);

  console.log(`\n[FETCH] "${company}" — need ${articleLimit} articles`);

  // ── Step 1: Curated RSS feeds ──
  console.log(
    `[FETCH] Step 1: Fetching ${CURATED_RSS_FEEDS.length} curated RSS feeds...`
  );

  const curatedResults = await Promise.all(
    CURATED_RSS_FEEDS.map(({ url, name }) =>
      fetchLimit(() => fetchSingleFeed(url, name, parser))
    )
  );

  const curatedArticles = curatedResults.flat();
  console.log(`[FETCH] Curated total: ${curatedArticles.length} raw articles`);

  const curatedFiltered = filterRelevantArticles(curatedArticles, company);
  const curatedDeduped = removeDuplicates(curatedFiltered);
  const curatedScored = await scoreArticlesInBatches(curatedDeduped, company);
  console.log(`[FETCH] ${curatedScored.length} curated articles passed scoring`);

  printFeedHealthSummary();

  // ── Step 2: Google RSS + scraping (only if curated not enough) ──
  let googleScored: Array<NewsItem & { relevanceScore: number }> = [];

  if (curatedScored.length < articleLimit) {
    console.log(
      `[FETCH] Step 2: Only ${curatedScored.length}/${articleLimit} from curated — fetching Google RSS...`
    );
    const googleArticles = await fetchAndScrapeGoogleNews(company, parser);
    const googleFiltered = filterRelevantArticles(googleArticles, company);
    const googleDeduped = removeDuplicates(googleFiltered);
    googleScored = await scoreArticlesInBatches(googleDeduped, company);
    console.log(`[FETCH] ${googleScored.length} Google articles passed scoring`);
  } else {
    console.log(
      `[FETCH] Step 2: Skipping Google RSS — curated feeds have enough (${curatedScored.length})`
    );
  }

  // ── Step 3: Merge + cap + slice ──
  const allScored = [...curatedScored, ...googleScored].sort(
    (a, b) => b.relevanceScore - a.relevanceScore
  );

  const rssCount = allScored.filter((a) => a.fetchMethod === "rss").length;
  const scrapedCount = allScored.filter(
    (a) => a.fetchMethod === "scraped"
  ).length;
  console.log(
    `[FETCH] ✅ Method breakdown: ${rssCount} via RSS | ${scrapedCount} via scraping`
  );

  // ✅ Cap raised from 2→3 per source.
  // With 2-3 working sources and cap=2, you can only ever get 4-6 articles max.
  // Cap=3 still prevents one source monopolising the newsletter.
  const capped = capArticlesPerSource(allScored, 3);
  const final = capped.slice(0, articleLimit);

  console.log(`[FETCH] Final: ${final.length} articles for "${company}"`);
  return final;
}

// ============================
// GENERATE NEWSLETTER FOR ONE SUBSCRIPTION
// ============================
export async function generateNewsletterForSubscription(
  subscriptionId: string
) {
  console.log(`\n========== STARTING NEWSLETTER GENERATION ==========`);
  console.log(`Subscription ID: ${subscriptionId}`);

  try {
    const subscription = await storage.getSubscriptionById(subscriptionId);
    if (!subscription) {
      console.error(`❌ Subscription ${subscriptionId} not found`);
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (!subscription.isActive) {
      console.log(`⏸️  Subscription ${subscriptionId} is inactive`);
      return null;
    }

    console.log(`✅ Active subscription for user: ${subscription.userId}`);

    const companies = subscription.companies
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    console.log(`📋 Companies (${companies.length}): ${companies.join(", ")}`);

    const articleLimit = getArticlesPerCompany(companies.length);
    console.log(
      `📊 ${companies.length} companies × ${articleLimit} articles = ${
        companies.length * articleLimit
      } total articles`
    );

    console.log(`\n🔍 Fetching news for all companies...`);

    // ✅ Staggered parallel — starts each company 3s apart but all run concurrently
    const companyNewsResults = await Promise.allSettled(
      companies.map((company, index) =>
        new Promise<void>((resolve) => setTimeout(resolve, index * 3000))
          .then(() => fetchNewsForCompany(company, articleLimit))
          .then((items) => ({ company, items }))
      )
    );

    const companyNewsMap: Array<{ company: string; items: NewsItem[] }> = [];
    for (const result of companyNewsResults) {
      if (result.status === "fulfilled") {
        companyNewsMap.push(result.value);
      }
    }

    // ✅ Filter out articles already sent to this subscription
    for (const companyNews of companyNewsMap) {
      companyNews.items = await filterAlreadySentArticles(
        companyNews.items,
        subscriptionId
      );
    }

    const allFetchedUrls = companyNewsMap.flatMap(({ items }) =>
      items.map((i) => i.url)
    );
    const contentHash = computeContentHash(allFetchedUrls);
    console.log(`📋 Content hash: ${contentHash}`);

    console.log(`\n📰 Creating newsletter record...`);
    const newsletter = await storage.createNewsletter({
      subscriptionId: subscription.id,
      userId: subscription.userId,
      companies: subscription.companies,
      contentHash,
    });
    console.log(`✅ Created newsletter ${newsletter.id}`);

    console.log(`\n🤖 Starting AI summarization (concurrency: 3)...`);
    const limit = pLimit(3);

    const allArticles = (
      await Promise.all(
        companyNewsMap.flatMap(({ company, items }) =>
          items.map((newsItem, j) =>
            limit(async () => {
              console.log(
                `  [${newsItem.fetchMethod}] Article ${j + 1} for ${company}: "${newsItem.title.substring(0, 60)}"`
              );
              try {
                const { headline, summary } = await generateNewsSummary(
                  newsItem.text,
                  company
                );
                console.log(`  ✅ Headline: "${headline.substring(0, 60)}"`);
                const article = await storage.createArticle({
                  newsletterId: newsletter.id,
                  headline,
                  summary,
                  sourceUrl: newsItem.url,
                  sourceName: newsItem.source,
                  publishedAt: newsItem.publishedAt,
                });
                return article;
              } catch (error) {
                console.error(
                  `  ❌ Summary failed for "${newsItem.title}":`,
                  error
                );
                return null;
              }
            })
          )
        )
      )
    ).filter(Boolean);

    console.log(`\n========== NEWSLETTER GENERATION COMPLETE ==========`);
    console.log(
      `📊 Newsletter ${newsletter.id} — ${allArticles.length} articles`
    );
    console.log(`✉️  Ready for delivery to user ${subscription.userId}`);

    return newsletter;
  } catch (error) {
    console.error("Newsletter generation error:", error);
    throw error;
  }
}

// ============================
// GENERATE FOR ALL SUBSCRIPTIONS
// ✅ 3 second delay between users to avoid rate limits
// ============================
export async function generateNewslettersForAllSubscriptions() {
  try {
    const subscriptions = await storage.getAllActiveSubscriptions();
    console.log(`Found ${subscriptions.length} active subscriptions`);

    for (const subscription of subscriptions) {
      try {
        await generateNewsletterForSubscription(subscription.id);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`Error for subscription ${subscription.id}:`, error);
      }
    }

    console.log("Completed newsletter generation for all subscriptions");
  } catch (error) {
    console.error("Error in batch newsletter generation:", error);
    throw error;
  }
}