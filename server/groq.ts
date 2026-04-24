import Groq from "groq-sdk";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const SUMMARY_MODEL = "llama-3.3-70b-versatile";
const SCORING_MODEL = "llama-3.1-8b-instant";

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
const systemPrompt = `You are a master financial storyteller — part Bloomberg analyst, part Hemingway. You write payment industry news in a narrative style that draws readers in like a novel. Your writing is precise but never dry, insightful but never verbose. Every summary should feel like a mini-story with a beginning (what happened), a middle (why it matters), and an end (what comes next). Use vivid but professional language. Never use bullet points. Never sound like a press release.`;

const userPrompt = `Write a narrative news brief about ${company} for payments industry professionals based on this article:

${newsText}

Rules:
- Write 4-6 sentences as one flowing paragraph
- Start with a compelling opening that draws the reader in (not "Company X announced...")
- Weave in why this matters to payments professionals naturally within the story
- End with a forward-looking insight that gives the reader a new perspective
- Tone: confident, clear, slightly literary — like a great business journalist
- No bullet points, no headers, no clickbait

Return JSON with exactly two fields:
- "headline": max 10 words, sharp and intriguing like a newspaper front page
- "summary": the narrative paragraph described above`;
  try {
    const response = await pRetry(
      async () => {
        try {
          const completion = await groq.chat.completions.create({
            model: SUMMARY_MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            max_tokens: 300,
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
  // Truncate text to avoid token limits
  const maxTextLength = 1000;
  const truncatedText =
    text.length > maxTextLength
      ? text.substring(0, maxTextLength) + "..."
      : text;

  const prompt = `You are an AI analyst for the payments industry. Evaluate whether this news article is relevant to "${company}" and the payments/fintech industry.

Article Title: ${title}

Article Text: ${truncatedText}

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
          const completion = await groq.chat.completions.create({
            model: SCORING_MODEL,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_tokens: 150,
          });

          const content =
            completion.choices[0]?.message?.content || '{"score": 50}';
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