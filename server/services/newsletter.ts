import { storage } from "../storage";
import { generateNewsSummary, scoreArticleRelevance } from "./openai";
import axios from "axios";
import * as cheerio from "cheerio";
import pLimit from "p-limit";

interface NewsItem {
  title: string;
  text: string;
  url: string;
  source: string;
  publishedAt: Date;
}

const NEWS_SOURCES = [
  {
    name: "PaymentsJournal",
    url: "https://www.paymentsjournal.com/",
    scraper: scrapePaymentsJournal,
  },
  {
    name: "PaymentsDive",
    url: "https://www.paymentsdive.com/",
    scraper: scrapePaymentsDive,
  },
  {
    name: "The Paypers",
    url: "https://thepaypers.com/",
    scraper: scrapeThePaypers,
  },
];

async function scrapePaymentsJournal(company: string): Promise<NewsItem[]> {
  try {
    const searchUrl = `https://www.paymentsjournal.com/?s=${encodeURIComponent(company)}`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const articles: NewsItem[] = [];
    
    $('article').slice(0, 3).each((_, element) => {
      const $article = $(element);
      const title = $article.find('h2 a, h3 a').first().text().trim();
      const url = $article.find('h2 a, h3 a').first().attr('href') || '';
      const excerpt = $article.find('.entry-content, .excerpt, p').first().text().trim();
      const dateStr = $article.find('time').attr('datetime') || $article.find('.published').text();
      
      if (title && url && excerpt) {
        articles.push({
          title,
          text: excerpt || title,
          url,
          source: "PaymentsJournal",
          publishedAt: dateStr ? new Date(dateStr) : new Date(),
        });
      }
    });
    
    return articles;
  } catch (error) {
    console.error('Error scraping PaymentsJournal:', error);
    return [];
  }
}

async function scrapePaymentsDive(company: string): Promise<NewsItem[]> {
  try {
    const searchUrl = `https://www.paymentsdive.com/search/?q=${encodeURIComponent(company)}`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const articles: NewsItem[] = [];
    
    $('.feed__item, .search-result, article').slice(0, 3).each((_, element) => {
      const $article = $(element);
      const title = $article.find('h3, h2, .feed__title').text().trim();
      const url = $article.find('a').first().attr('href') || '';
      const excerpt = $article.find('.feed__description, .search-result__description, p').text().trim();
      
      if (title && url) {
        const fullUrl = url.startsWith('http') ? url : `https://www.paymentsdive.com${url}`;
        articles.push({
          title,
          text: excerpt || title,
          url: fullUrl,
          source: "PaymentsDive",
          publishedAt: new Date(),
        });
      }
    });
    
    return articles;
  } catch (error) {
    console.error('Error scraping PaymentsDive:', error);
    return [];
  }
}

async function scrapeThePaypers(company: string): Promise<NewsItem[]> {
  try {
    const searchUrl = `https://thepaypers.com/search?keyword=${encodeURIComponent(company)}`;
    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const articles: NewsItem[] = [];
    
    $('.news-item, .search-result, article').slice(0, 3).each((_, element) => {
      const $article = $(element);
      const title = $article.find('h2, h3, .title').text().trim();
      const url = $article.find('a').first().attr('href') || '';
      const excerpt = $article.find('.description, .excerpt, p').text().trim();
      
      if (title && url) {
        const fullUrl = url.startsWith('http') ? url : `https://thepaypers.com${url}`;
        articles.push({
          title,
          text: excerpt || title,
          url: fullUrl,
          source: "The Paypers",
          publishedAt: new Date(),
        });
      }
    });
    
    return articles;
  } catch (error) {
    console.error('Error scraping The Paypers:', error);
    return [];
  }
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLen;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str1.length][str2.length];
}

function removeDuplicates(articles: NewsItem[]): NewsItem[] {
  const unique: NewsItem[] = [];
  const SIMILARITY_THRESHOLD = 0.75;
  
  for (const article of articles) {
    let isDuplicate = false;
    
    for (const existing of unique) {
      const titleSimilarity = calculateSimilarity(article.title, existing.title);
      
      if (titleSimilarity > SIMILARITY_THRESHOLD) {
        isDuplicate = true;
        console.log(`Duplicate found: "${article.title}" similar to "${existing.title}" (${(titleSimilarity * 100).toFixed(1)}%)`);
        break;
      }
      
      if (article.url === existing.url) {
        isDuplicate = true;
        console.log(`Duplicate URL found: ${article.url}`);
        break;
      }
    }
    
    if (!isDuplicate) {
      unique.push(article);
    }
  }
  
  console.log(`Removed ${articles.length - unique.length} duplicate articles`);
  return unique;
}

function filterRelevantArticles(articles: NewsItem[], company: string): NewsItem[] {
  const PAYMENTS_KEYWORDS = [
    'payment', 'payments', 'fintech', 'financial', 'transaction', 'banking',
    'merchant', 'checkout', 'credit card', 'debit', 'mobile wallet', 'digital wallet',
    'pos', 'point of sale', 'ecommerce', 'e-commerce', 'processor', 'gateway',
    'acquiring', 'issuing', 'settlement', 'compliance', 'regulation', 'fraud',
    'security', 'authentication', 'tokenization', 'cryptocurrency', 'blockchain',
    'revenue', 'earnings', 'partnership', 'acquisition', 'growth', 'expansion'
  ];
  
  return articles.filter(article => {
    const combinedText = `${article.title} ${article.text}`.toLowerCase();
    const companyLower = company.toLowerCase();
    
    const mentionsCompany = combinedText.includes(companyLower);
    
    const hasPaymentsKeyword = PAYMENTS_KEYWORDS.some(keyword => 
      combinedText.includes(keyword.toLowerCase())
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
  company: string
): Promise<Array<NewsItem & { relevanceScore: number }>> {
  const RELEVANCE_THRESHOLD = 60;
  const limit = pLimit(3);
  
  const scoredArticles = await Promise.all(
    articles.map(article =>
      limit(async () => {
        const score = await scoreArticleRelevance(article.title, article.text, company);
        console.log(`AI scored "${article.title.substring(0, 50)}..." → ${score}/100`);
        return { ...article, relevanceScore: score };
      })
    )
  );
  
  const filtered = scoredArticles
    .filter(article => article.relevanceScore >= RELEVANCE_THRESHOLD)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  console.log(`${filtered.length}/${scoredArticles.length} articles passed AI relevance threshold (≥${RELEVANCE_THRESHOLD})`);
  
  return filtered;
}

async function fetchNewsForCompany(company: string): Promise<NewsItem[]> {
  const allArticles: NewsItem[] = [];
  
  for (const source of NEWS_SOURCES) {
    try {
      console.log(`Scraping ${source.name} for ${company}...`);
      const articles = await source.scraper(company);
      allArticles.push(...articles);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error with ${source.name}:`, error);
    }
  }
  
  if (allArticles.length === 0) {
    console.log(`No articles found for ${company}, using fallback`);
    return [{
      title: `${company} in the Payments Industry`,
      text: `Recent developments and news about ${company} in the payments and financial technology sector. The company continues to be a significant player in the evolving digital payments landscape.`,
      url: `https://www.google.com/search?q=${encodeURIComponent(company + ' payments news')}`,
      source: "Industry News",
      publishedAt: new Date(),
    }];
  }
  
  console.log(`Found ${allArticles.length} raw articles for ${company}`);
  
  const keywordFiltered = filterRelevantArticles(allArticles, company);
  console.log(`${keywordFiltered.length} articles after keyword filtering`);
  
  const deduplicated = removeDuplicates(keywordFiltered);
  console.log(`${deduplicated.length} unique articles after deduplication`);
  
  const aiScored = await scoreArticlesWithAI(deduplicated, company);
  console.log(`${aiScored.length} articles after AI relevance scoring`);
  
  return aiScored.slice(0, 5);
}

export async function generateNewsletterForSubscription(subscriptionId: string) {
  console.log(`\n========== STARTING NEWSLETTER GENERATION ==========`);
  console.log(`Subscription ID: ${subscriptionId}`);
  
  try {
    // Get subscription details
    console.log(`Fetching subscription details...`);
    const subscription = await storage.getSubscriptionById(subscriptionId);
    if (!subscription) {
      console.error(`❌ Subscription ${subscriptionId} not found`);
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }
    
    if (!subscription.isActive) {
      console.log(`⏸️  Subscription ${subscriptionId} is inactive, skipping`);
      return null;
    }

    console.log(`✅ Found active subscription for user: ${subscription.userId}`);
    const companies = subscription.companies.split(',').map(c => c.trim()).filter(c => c.length > 0);
    console.log(`📋 Companies to track: ${companies.join(', ')} (${companies.length} total)`);

    // Create newsletter record
    console.log(`\n📰 Creating newsletter record...`);
    const newsletter = await storage.createNewsletter({
      subscriptionId: subscription.id,
      userId: subscription.userId,
      companies: subscription.companies,
    });
    console.log(`✅ Created newsletter ${newsletter.id}`);

    // Fetch and summarize news for each company
    const allArticles = [];
    console.log(`\n🔍 Starting news collection and AI summarization...`);

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      console.log(`\n--- Processing Company ${i + 1}/${companies.length}: ${company} ---`);
      
      try {
        const newsItems = await fetchNewsForCompany(company);
        console.log(`Found ${newsItems.length} relevant articles for ${company}`);

        for (let j = 0; j < newsItems.length; j++) {
          const newsItem = newsItems[j];
          console.log(`\n  Article ${j + 1}/${newsItems.length}: "${newsItem.title.substring(0, 60)}..."`);
          
          try {
            console.log(`  🤖 Calling OpenAI GPT-5 to generate summary...`);
            const { headline, summary } = await generateNewsSummary(
              newsItem.text,
              company
            );
            console.log(`  ✅ AI generated headline: "${headline.substring(0, 60)}..."`);

            const article = await storage.createArticle({
              newsletterId: newsletter.id,
              headline,
              summary,
              sourceUrl: newsItem.url,
              sourceName: newsItem.source,
              publishedAt: newsItem.publishedAt,
            });

            allArticles.push(article);
            console.log(`  💾 Saved article ${article.id}`);
          } catch (error) {
            console.error(`  ❌ Error generating summary for article:`, error);
            // Continue with other articles even if one fails
          }
        }
      } catch (error) {
        console.error(`❌ Error processing company ${company}:`, error);
        // Continue with other companies even if one fails
      }
    }

    console.log(`\n========== NEWSLETTER GENERATION COMPLETE ==========`);
    console.log(`📊 Newsletter ${newsletter.id} contains ${allArticles.length} articles`);
    console.log(`✉️  Ready for email delivery to user ${subscription.userId}`);
    
    return newsletter;
  } catch (error) {
    console.error(`\n❌ FATAL ERROR in newsletter generation:`, error);
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
        console.error(`Error generating newsletter for subscription ${subscription.id}:`, error);
        // Continue with other subscriptions even if one fails
      }
    }

    console.log("Completed newsletter generation for all subscriptions");
  } catch (error) {
    console.error("Error in batch newsletter generation:", error);
    throw error;
  }
}
