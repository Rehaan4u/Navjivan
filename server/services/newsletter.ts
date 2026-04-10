import { storage } from "../storage";
// So that in the log we could see which source is providing content 
import { recordFeedHealth, printFeedHealthSummary } from "./feedHealth";

//Replaced openai with groq
import { generateNewsSummary, scoreArticleRelevance } from "../groq";
import Parser from "rss-parser";
import pLimit from "p-limit";
import { createHash } from "crypto";

interface NewsItem {
  title: string;
  text: string;
  url: string;
  source: string;
  publishedAt: Date;
}

const CURATED_RSS_FEEDS = [
  { name: "Finextra Payments",        url: "https://www.finextra.com/rss/channel.aspx?channel=payments" },
  { name: "Finextra Regulation",      url: "https://www.finextra.com/rss/channel.aspx?channel=regulation" },
  { name: "Finextra Crypto",          url: "https://www.finextra.com/rss/channel.aspx?channel=crypto" },
  { name: "Finextra Security",        url: "https://www.finextra.com/rss/channel.aspx?channel=security" },
  { name: "PaymentsJournal Podcast",  url: "https://www.paymentsjournal.com/category/the-paymentsjournal-podcast/feed/" },
  { name: "The Finanser",             url: "https://thefinanser.com/feed" },
  { name: "Fintech Brainfood",        url: "https://www.fintechbrainfood.com/feed" },
  { name: "Glenbrook Payments on Fire", url: "https://glenbrook.com/payments_on_fire/feed/" },
  { name: "Tearsheet Podcast",        url: "https://tearsheet.co/podcasts/feed/" },
  { name: "11:FS Podcast",            url: "https://www.11fs.com/feed/podcast/" },
  { name: "Visa News",                url: "https://usa.visa.com/about-visa/newsroom.rss" },
  { name: "Mastercard Newsroom",      url: "https://newsroom.mastercard.com/feed/" },
  { name: "Stripe Blog",              url: "https://stripe.com/blog/feed.rss" },
  { name: "Adyen Blog",               url: "https://www.adyen.com/knowledge-hub/rss.xml" },
  { name: "PayPal Newsroom",          url: "https://newsroom.paypal-corp.com/feed" },
  { name: "Nacha Payments",           url: "https://www.nacha.org/news-feed.xml" },
];

async function fetchRSSArticles(company: string): Promise<NewsItem[]> {
  const parser = new Parser({ timeout: 10000 });
  const limit = pLimit(5);

  // const fetchFeed = async (url: string, sourceName: string): Promise<NewsItem[]> => {
  //   try {
  //     const feed = await parser.parseURL(url);
  //     return (feed.items || []).map((item) => ({
  //       title: item.title || "",
  //       text: item.contentSnippet || item.content || item.title || "",
  //       url: item.link || "",
  //       source: sourceName,
  //       publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
  //     }));
  //   } catch (error) {
  //     console.error(`Error fetching RSS from ${sourceName}:`, error);
  //     return [];
  //   }
  // };

  //UPDATED THE fetchFeed function so that in logs we could see the health of sorces too
  const fetchFeed = async (url: string, sourceName: string): Promise<NewsItem[]> => {
  try {
    const feed = await parser.parseURL(url);
    const items = (feed.items || []).map((item) => ({
      title: item.title || "",
      text: item.contentSnippet || item.content || item.title || "",
      url: item.link || "",
      source: sourceName,
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
    }));

    // ✅ Record health after successful fetch
    recordFeedHealth(sourceName, items.length);
    return items;
  } catch (error: any) {
    // ✅ Record health on error
    recordFeedHealth(sourceName, 0, error?.message || "Unknown error");
    console.error(`Error fetching RSS from ${sourceName}:`, error);
    return [];
  }
};

  const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(company + " payments")}`;

  const allFeeds = [
    { name: "Google News", url: googleNewsUrl },
    ...CURATED_RSS_FEEDS,
  ];

  const results = await Promise.all(
    allFeeds.map(({ url, name }) => limit(() => fetchFeed(url, name))),
  );

  // return results.flat();
  //Generates the summary of working resources
  const allArticles = results.flat();
  printFeedHealthSummary(); // ✅ prints full summary after all feeds attempted
  return allArticles;
}

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

function removeDuplicates(articles: NewsItem[]): NewsItem[] {
  const urlSet = new Set<string>();
  const fingerprintSet = new Set<string>();
  const unique: NewsItem[] = [];

  for (const article of articles) {
    const fp = titleFingerprint(article.title);
    if (urlSet.has(article.url) || fingerprintSet.has(fp)) {
      console.log(`Duplicate removed: "${article.title}"`);
      continue;
    }
    urlSet.add(article.url);
    fingerprintSet.add(fp);
    unique.push(article);
  }

  console.log(`Removed ${articles.length - unique.length} duplicate articles`);
  return unique;
}

function filterRelevantArticles(
  articles: NewsItem[],
  company: string,
): NewsItem[] {
  const PAYMENTS_KEYWORDS = [
    "payment", "payments", "fintech", "financial", "transaction",
    "banking", "merchant", "checkout", "credit card", "debit",
    "mobile wallet", "digital wallet", "pos", "point of sale",
    "ecommerce", "e-commerce", "processor", "gateway", "acquiring",
    "issuing", "settlement", "compliance", "regulation", "fraud",
    "security", "authentication", "tokenization", "cryptocurrency",
    "blockchain", "revenue", "earnings", "partnership", "acquisition",
    "growth", "expansion",
  ];

  return articles.filter((article) => {
    const combinedText = `${article.title} ${article.text}`.toLowerCase();
    const companyLower = company.toLowerCase();
    const mentionsCompany = combinedText.includes(companyLower);
    const hasPaymentsKeyword = PAYMENTS_KEYWORDS.some((keyword) =>
      combinedText.includes(keyword.toLowerCase()),
    );
    const isRelevant = mentionsCompany || hasPaymentsKeyword;
    if (!isRelevant) {
      console.log(`Filtered out irrelevant article: "${article.title}"`);
    }
    return isRelevant;
  });
}

async function scoreArticlesWithAI(
  articles: NewsItem[],
  company: string,
): Promise<Array<NewsItem & { relevanceScore: number }>> {
  const RELEVANCE_THRESHOLD = 60;
  const limit = pLimit(3);

  const scoredArticles = await Promise.all(
    articles.map((article) =>
      limit(async () => {
        const score = await scoreArticleRelevance(
          article.title,
          article.text,
          company,
        );
        console.log(
          `AI scored "${article.title.substring(0, 50)}..." → ${score}/100`,
        );
        return { ...article, relevanceScore: score };
      }),
    ),
  );

  const filtered = scoredArticles
    .filter((article) => article.relevanceScore >= RELEVANCE_THRESHOLD)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  console.log(
    `${filtered.length}/${scoredArticles.length} articles passed AI relevance threshold (≥${RELEVANCE_THRESHOLD})`,
  );

  return filtered;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

function computeContentHash(urls: string[]): string {
  const sorted = [...urls].sort().join("|");
  return createHash("md5").update(sorted).digest("hex");
}

async function fetchNewsForCompany(company: string): Promise<NewsItem[]> {
  console.log(`Fetching RSS articles for ${company}...`);

  const rawArticles = await fetchRSSArticles(company);

  if (rawArticles.length === 0) {
    console.log(`No articles found for ${company}, using fallback`);
    return [
      {
        title: `${company} in the Payments Industry`,
        text: `Recent developments and news about ${company} in the payments and financial technology sector. The company continues to be a significant player in the evolving digital payments landscape.`,
        url: `https://www.google.com/search?q=${encodeURIComponent(company + " payments news")}`,
        source: "Industry News",
        publishedAt: new Date(),
      },
    ];
  }

  console.log(`Found ${rawArticles.length} raw articles for ${company}`);

  const keywordFiltered = filterRelevantArticles(rawArticles, company);
  console.log(`${keywordFiltered.length} articles after keyword filtering`);

  const deduplicated = removeDuplicates(keywordFiltered);
  console.log(`${deduplicated.length} unique articles after deduplication`);

  const aiScored = await scoreArticlesWithAI(deduplicated, company);
  console.log(`${aiScored.length} articles after AI relevance scoring`);

  return aiScored.slice(0, 5);
}

export async function generateNewsletterForSubscription(
  subscriptionId: string,
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

    console.log(
      `✅ Active subscription found for user: ${subscription.userId}`,
    );
    const companies = subscription.companies
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    console.log(`📋 Companies: ${companies.join(", ")}`);

    console.log(`\n🔍 Fetching news for all companies in parallel...`);
    const companyNewsResults = await Promise.allSettled(
      companies.map((company) =>
        fetchNewsForCompany(company).then((items) => ({ company, items })),
      ),
    );

    const companyNewsMap: Array<{ company: string; items: NewsItem[] }> = [];
    for (const result of companyNewsResults) {
      if (result.status === "fulfilled") {
        companyNewsMap.push(result.value);
      }
    }

    const allFetchedUrls = companyNewsMap.flatMap(({ items }) =>
      items.map((i) => i.url),
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

    console.log(`\n🤖 Starting AI summarization (parallel, concurrency 3)...`);
    const limit = pLimit(3);

    const allArticles = (
      await Promise.all(
        companyNewsMap.flatMap(({ company, items }) =>
          items.map((newsItem, j) =>
            limit(async () => {
              console.log(
                `  Article ${j + 1} for ${company}: "${newsItem.title.substring(0, 60)}..."`,
              );
              try {
                const { headline, summary } = await generateNewsSummary(
                  newsItem.text,
                  company,
                );
                console.log(
                  `  ✅ AI headline: "${headline.substring(0, 60)}..."`,
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
                  `  ❌ Error generating summary for "${newsItem.title}":`,
                  error,
                );
                return null;
              }
            }),
          ),
        ),
      )
    ).filter(Boolean);

    console.log(`\n========== NEWSLETTER GENERATION COMPLETE ==========`);
    console.log(
      `📊 Newsletter ${newsletter.id} — ${allArticles.length} articles`,
    );
    console.log(`✉️  Ready for delivery to user ${subscription.userId}`);

    return newsletter;
  } catch (error) {
    console.error("Newsletter generation error:", error);
    throw error;
  }
}

export async function generateNewslettersForAllSubscriptions() {
  try {
    const subscriptions = await storage.getAllActiveSubscriptions();
    console.log(`Found ${subscriptions.length} active subscriptions`);

    for (const subscription of subscriptions) {
      try {
        await generateNewsletterForSubscription(subscription.id);
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
