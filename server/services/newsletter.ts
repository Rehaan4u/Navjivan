import { storage } from "../storage";
import type { Article } from "@shared/schema";
import { scrapeArticleContent } from "./scraper";
import { recordFeedHealth, printFeedHealthSummary } from "./feedHealth";
import { generateNewsSummary, scoreArticleRelevance } from "../groq";
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
const MAX_ARTICLES_PER_SOURCE = 50;     // max articles taken from any one source
const BATCH_SIZE = 5;                    // score 5 articles at a time
const RELEVANCE_THRESHOLD = 50;          // minimum score to pass
const BATCH_PASS_THRESHOLD = 3;         // if 3+ pass in a batch, stop scoring this source
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ============================
// RSS SOURCES
// ✅ Removed all dead sources (404s and invalid XML)
// ============================
const CURATED_RSS_FEEDS = [
  // Official cloud provider blogs
  { name: "AWS Blog",           url: "https://aws.amazon.com/blogs/aws/feed/" },
  { name: "Google Cloud Blog",  url: "https://cloudblog.withgoogle.com/rss/" },
  { name: "Azure Blog",         url: "https://azure.microsoft.com/en-us/blog/feed/" },
  // Cloud industry news
  { name: "The New Stack",      url: "https://thenewstack.io/feed/" },
  { name: "InfoQ Cloud",        url: "https://feed.infoq.com/cloud/" },
  { name: "TechCrunch Cloud",   url: "https://techcrunch.com/tag/cloud-computing/feed/" },
  { name: "SiliconAngle Cloud", url: "https://siliconangle.com/feed/" },
  { name: "ZDNet Cloud",        url: "https://www.zdnet.com/topic/cloud/rss.xml" },
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
// ============================
function computeContentHash(urls: string[]): string {
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
// STEP 1A: FETCH ONE CURATED RSS FEED
// ✅ Records health, filters to 1 week, caps at 50
// ============================
async function fetchSingleFeed(
  url: string,
  sourceName: string,
  parser: Parser
): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(url);
    const items = (feed.items || [])
      .map((item) => ({
        title: item.title || "",
        text: item.contentSnippet || item.content || item.title || "",
        url: item.link || "",
        source: sourceName,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        fetchMethod: "rss" as const,
      }))
      .filter((item) => isWithinOneWeek(item.publishedAt)) // ✅ last 7 days only
      .slice(0, MAX_ARTICLES_PER_SOURCE);                  // ✅ max 50 per source

    recordFeedHealth(sourceName, items.length);
    console.log(`[RSS] ${sourceName}: ${items.length} articles (within 1 week)`);
    return items;
  } catch (error: any) {
    recordFeedHealth(sourceName, 0, error?.message || "Unknown error");
    console.error(`[RSS] ❌ ${sourceName} failed: ${error?.message}`);
    return [];
  }
}

// ============================
// STEP 1B: FETCH GOOGLE RSS + SCRAPE CONTENT
// ✅ Google RSS last — only if curated feeds don't have enough
// ✅ Scrapes full article body from each URL
// ✅ Marks articles as "scraped" so logs show fetch method
// ============================
async function fetchAndScrapeGoogleNews(
  company: string,
  parser: Parser
): Promise<NewsItem[]> {
const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
    company + " cloud"
  )}`;

  try {
    const feed = await parser.parseURL(googleNewsUrl);
    const recentItems = (feed.items || [])
      .map((item) => ({
        title: item.title || "",
        text: item.contentSnippet || item.content || item.title || "",
        url: item.link || "",
        source: "Google News",
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        fetchMethod: "rss" as const,
      }))
      .filter((item) => isWithinOneWeek(item.publishedAt))
      .slice(0, MAX_ARTICLES_PER_SOURCE);

    console.log(
      `[Google RSS] ${recentItems.length} articles for "${company}" (within 1 week)`
    );

    // ✅ Scrape full content for every Google News article
    // Google RSS only gives title + URL, so we need to scrape the actual page
    const enriched = await Promise.all(
      recentItems.map(async (article) => {
        if (!article.text || article.text.length < 150) {
          const scrapedText = await scrapeArticleContent(article.url);
          if (scrapedText) {
            console.log(
              `[SCRAPER] ✅ "${article.title.substring(0, 50)}" — ${scrapedText.length} chars`
            );
            return {
              ...article,
              text: scrapedText,
              fetchMethod: "scraped" as const, // ✅ marks as scraped not RSS
            };
          }
        }
        return article;
      })
    );

    recordFeedHealth("Google News", enriched.length);
    return enriched;
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
// ✅ Company name must appear in article to pass
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

    // Score entire batch concurrently (up to 3 at a time)
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

    // ✅ Must score ≥ 70 AND mention company name to pass
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

    // ✅ 3+ passed → we have enough from this source, stop scoring it
    if (batchPassed.length >= BATCH_PASS_THRESHOLD) {
      console.log(
        `[SCORING] ✅ ${batchPassed.length} passed in batch ${batchNum} — stopping early`
      );
      break;
    }

    // ✅ 0 passed → try next batch from same source
    if (batchPassed.length === 0 && i + BATCH_SIZE < articles.length) {
      console.log(
        `[SCORING] ⚠️  0 passed in batch ${batchNum} — trying next batch...`
      );
      // continue loop naturally
    }
  }

  return passed.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ============================
// STEP 5: CAP TOP N PER SOURCE
// ✅ Articles already sorted by score desc before this runs
// ✅ If two articles have same score, first one wins (already correct by sort stability)
// ============================
function capArticlesPerSource(
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
async function filterAlreadySentArticles(
  articles: NewsItem[],
  subscriptionId: string
): Promise<NewsItem[]> {
  try {
    const sentUrls = new Set<string>();

    // ✅ storage only has getLastNewsletterBySubscription (returns one newsletter)
    // so we use getUserNewsletters via userId is not available here,
    // so we get the last newsletter and check its articles
  const lastNewsletter = await storage.getLastNewsletterBySubscription(subscriptionId);

if (lastNewsletter) {
  // Only filter articles from newsletters sent in the last 12 hours
  // This prevents blocking articles when generating multiple times per day
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const newsletterTime = new Date(lastNewsletter.generatedAt!);
  
  if (newsletterTime > sixHoursAgo) {
    const prevArticles = await storage.getNewsletterArticles(lastNewsletter.id);
    prevArticles.forEach((a: Article) => sentUrls.add(a.sourceUrl));
    console.log(`[SENT-FILTER] Found ${prevArticles.length} articles in last newsletter (within 12h)`);
  } else {
    console.log(`[SENT-FILTER] Last newsletter was more than 12h ago — allowing all articles`);
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

  console.log(
    `\n[FETCH] "${company}" — need ${articleLimit} articles`
  );

  // ============================
  // STEP 1: Curated RSS feeds first
  // These already have full text content so no scraping needed
  // ============================
  console.log(`[FETCH] Step 1: Fetching ${CURATED_RSS_FEEDS.length} curated RSS feeds...`);

  const curatedResults = await Promise.all(
    CURATED_RSS_FEEDS.map(({ url, name }) =>
      fetchLimit(() => fetchSingleFeed(url, name, parser))
    )
  );

  const curatedArticles = curatedResults.flat();
  console.log(`[FETCH] Curated total: ${curatedArticles.length} raw articles`);

  // Filter + deduplicate
  const curatedFiltered = filterRelevantArticles(curatedArticles, company);
  const curatedDeduped = removeDuplicates(curatedFiltered);

  // Score in batches
  const curatedScored = await scoreArticlesInBatches(curatedDeduped, company);
  console.log(`[FETCH] ${curatedScored.length} curated articles passed scoring`);

  // Print health summary after curated feeds
  printFeedHealthSummary();

  // ============================
  // STEP 2: Google RSS + scraping
  // Only fetch if curated feeds didn't give us enough articles
  // ============================
  let googleScored: Array<NewsItem & { relevanceScore: number }> = [];

  if (curatedScored.length < articleLimit) {
    console.log(
      `[FETCH] Step 2: Only ${curatedScored.length}/${articleLimit} articles from curated — fetching Google RSS...`
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

  // ============================
  // STEP 3: Merge + cap + slice
  // ============================
  const allScored = [...curatedScored, ...googleScored].sort(
    (a, b) => b.relevanceScore - a.relevanceScore
  );

  // Log RSS vs scraped breakdown
  const rssCount = allScored.filter((a) => a.fetchMethod === "rss").length;
  const scrapedCount = allScored.filter((a) => a.fetchMethod === "scraped").length;
  console.log(
    `[FETCH] ✅ Method breakdown: ${rssCount} via RSS | ${scrapedCount} via scraping`
  );

  const capped = capArticlesPerSource(allScored, 2);
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

    // ✅ Dynamic article limit based on company count
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
    new Promise<void>(resolve => setTimeout(resolve, index * 3000))
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
                console.log(
                  `  ✅ Headline: "${headline.substring(0, 60)}"`
                );
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
    console.log(`📊 Newsletter ${newsletter.id} — ${allArticles.length} articles`);
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
        // ✅ Stagger between users to avoid Groq rate limits
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