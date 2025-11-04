import { storage } from "../storage";
import { generateNewsSummary } from "./openai";
import axios from "axios";
import * as cheerio from "cheerio";

// Mock news data for MVP - in production, this would scrape from real sources
const MOCK_NEWS_SOURCES = [
  {
    name: "PaymentsJournal",
    url: "https://www.paymentsjournal.com/",
  },
  {
    name: "Bloomberg",
    url: "https://www.bloomberg.com/",
  },
  {
    name: "CNBC",
    url: "https://www.cnbc.com/",
  },
  {
    name: "American Banker",
    url: "https://www.americanbanker.com/payments",
  },
];

// Generate mock news for demonstration
function generateMockNews(company: string): Array<{
  title: string;
  text: string;
  url: string;
  source: string;
  publishedAt: Date;
}> {
  const newsTemplates = [
    {
      title: `${company} Announces New Partnership`,
      text: `${company} has announced a strategic partnership aimed at expanding its payment processing capabilities in emerging markets. The collaboration is expected to enhance the company's global reach and provide customers with more flexible payment options. Industry analysts view this as a significant move in the competitive payments landscape.`,
    },
    {
      title: `Regulatory Update Affects ${company} Operations`,
      text: `New financial regulations announced this week will impact ${company}'s operations in several key markets. The company has stated it is well-prepared for the changes and has already begun implementing necessary compliance measures. Experts suggest this could reshape the competitive dynamics in the payments sector.`,
    },
    {
      title: `${company} Reports Strong Quarter Performance`,
      text: `${company} has released its quarterly earnings, showing robust growth in transaction volumes and revenue. The company attributed the strong performance to increased adoption of digital payments and expansion into new market segments. Market observers note this continues the company's upward trajectory in the evolving payments ecosystem.`,
    },
  ];

  const selectedNews = newsTemplates.slice(0, Math.min(2, newsTemplates.length));
  
  return selectedNews.map((template, index) => ({
    title: template.title,
    text: template.text,
    url: `https://example.com/news/${company.toLowerCase().replace(/\s+/g, '-')}-${index}`,
    source: MOCK_NEWS_SOURCES[index % MOCK_NEWS_SOURCES.length].name,
    publishedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Random time within last 24 hours
  }));
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
      
      // For MVP: Use mock news data
      // In production: Implement real web scraping here
      const newsItems = generateMockNews(company);

      // Generate AI summaries
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
