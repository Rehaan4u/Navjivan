// From javascript_openai_ai_integrations integration
import OpenAI from "openai";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// Helper function to check if error is rate limit or quota violation
function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

export async function generateNewsSummary(
  newsText: string,
  company: string
): Promise<{ headline: string; summary: string }> {
  const prompt = `You are a professional financial journalist writing for payment industry executives.

TASK: Create a Finshots-style news summary for the following news article about ${company}:

${newsText}

REQUIREMENTS:
1. Headline: Create an engaging, concise headline (max 100 characters)
2. Summary: Write a clear, witty paragraph summary in Finshots style (150-200 words)
   - Use simple, accessible language
   - Include key facts and implications
   - Make it engaging and slightly conversational
   - Focus on "what it means" not just "what happened"

Return your response in JSON format with "headline" and "summary" fields.`;

  try {
    const response = await pRetry(
      async () => {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_completion_tokens: 8192,
          });
          
          const content = completion.choices[0]?.message?.content || "{}";
          return JSON.parse(content);
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error; // Rethrow to trigger p-retry
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 7,
        minTimeout: 2000,
        maxTimeout: 128000,
        factor: 2,
      }
    );

    return response;
  } catch (error) {
    console.error("Error generating summary:", error);
    // Return fallback
    return {
      headline: "Update from " + company,
      summary: newsText.slice(0, 200) + "...",
    };
  }
}

export async function batchGenerateSummaries(
  newsItems: Array<{ text: string; company: string }>
): Promise<Array<{ headline: string; summary: string }>> {
  const limit = pLimit(2); // Process up to 2 requests concurrently

  const promises = newsItems.map((item) =>
    limit(() => generateNewsSummary(item.text, item.company))
  );

  return await Promise.all(promises);
}

export async function scoreArticleRelevance(
  title: string,
  text: string,
  company: string
): Promise<number> {
  const prompt = `You are an AI analyst for the payments industry. Evaluate whether this news article is relevant to "${company}" and the payments/fintech industry.

Article Title: ${title}

Article Text: ${text}

Score the relevance from 0 to 100 where:
- 0-30: Not relevant (unrelated to payments industry or company)
- 31-60: Somewhat relevant (mentions payments but not substantive)
- 61-85: Relevant (good payments industry content about the company)
- 86-100: Highly relevant (important payments news directly about the company)

Return ONLY a JSON object with a single "score" field containing an integer from 0-100.`;

  try {
    const response = await pRetry(
      async () => {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_completion_tokens: 100,
          });
          
          const content = completion.choices[0]?.message?.content || '{"score": 50}';
          const parsed = JSON.parse(content);
          return parsed.score || 50;
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
          }
          throw new AbortError(error);
        }
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 10000,
        factor: 2,
      }
    );

    return Math.max(0, Math.min(100, response));
  } catch (error) {
    console.error("Error scoring article relevance:", error);
    return 50;
  }
}
