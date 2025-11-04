import { storage } from "../storage";
import { generateNewsSummary } from "./openai";
import axios from "axios";
import * as cheerio from "cheerio";

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
  
  return allArticles.slice(0, 5);
}

export async function generateNewsletterForSubscription(subscriptionId: string) {
  try {
    // Get subscription details
    const subscription = await storage.getSubscription(subscriptionId);
    if (!subscription || !subscription.isActive) {
      console.log(`Subscription ${subscriptionId} not found or inactive`);
      return;
    }

    const companies = subscription.companies.split(',').map(c => c.trim());
    console.log(`Generating newsletter for companies: ${companies.join(', ')}`);

    // Create newsletter record
    const newsletter = await storage.createNewsletter({
      subscriptionId: subscription.id,
      userId: subscription.userId,
      companies: subscription.companies,
    });

    // Fetch and summarize news for each company
    const allArticles = [];

    for (const company of companies) {
      console.log(`Fetching news for ${company}...`);
      
      const newsItems = await fetchNewsForCompany(company);

      for (const newsItem of newsItems) {
        try {
          const { headline, summary } = await generateNewsSummary(
            newsItem.text,
            company
          );

          const article = await storage.createArticle({
            newsletterId: newsletter.id,
            headline,
            summary,
            sourceUrl: newsItem.url,
            sourceName: newsItem.source,
            publishedAt: newsItem.publishedAt,
          });

          allArticles.push(article);
        } catch (error) {
          console.error(`Error generating summary for ${company}:`, error);
          // Continue with other articles even if one fails
        }
      }
    }

    console.log(`Generated newsletter ${newsletter.id} with ${allArticles.length} articles`);
    return newsletter;
  } catch (error) {
    console.error("Error generating newsletter:", error);
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
