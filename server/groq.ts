import Groq from "groq-sdk";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const SUMMARY_MODEL = "llama-3.3-70b-versatile";
const SCORING_MODEL = "llama-3.1-8b-instant";

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

  // ✅ CORRECT PLACE for both prompts — inside generateNewsSummary
  const systemPrompt = `You are a master financial storyteller — part Bloomberg analyst, part Hemingway. You write payment industry news in a narrative style that draws readers in like a novel. Your writing is precise but never dry, insightful but never verbose. Every summary should feel like a mini-story with a beginning (what happened), a middle (why it matters), and an end (what comes next). Use vivid but professional language. Never use bullet points. Never sound like a press release.`;

  const userPrompt = `Write a deep narrative news brief about ${company} for payments industry professionals based on this article:

${newsText}

You are writing for senior payments executives who want to be fully informed — not just what happened, but WHY it happened, WHAT forces led to it, and WHAT it means for the future.

Rules:
- Write 6-8 sentences as one flowing, immersive paragraph
- Opening: Hook the reader — set the scene, create context, make them feel the significance. Never start with "${company} announced" or "${company} said"
- Middle: Explain WHY this happened — what market forces, competitive pressures, or strategic logic drove this decision. Make the reader feel like an insider
- Industry impact: Weave in naturally what this means for payments professionals, merchants, banks, or consumers
- Closing: A forward-looking insight — what should the reader watch for? What does this signal about where the industry is heading?
- Tone: Authoritative, warm, slightly literary — like a brilliant FT Weekend long-read condensed into one perfect paragraph
- Word count: 150-200 words for the summary — substantial enough to fully inform, tight enough to read in 60 seconds
- Start with one relevant emoji that captures the story's essence
- NO bullet points, NO headers, NO "In conclusion", NO clichés like "game-changer" or "revolutionary"
- Write in a way that makes the reader feel genuinely wiser after reading it

Return ONLY this JSON, nothing else before or after it:
{"headline": "your headline here max 10 words", "summary": "your full narrative paragraph here starting with emoji"}`;

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
            // ✅ No response_format — parse manually to handle long narratives
            max_tokens: 800,
          });

          const content = completion.choices[0]?.message?.content || "";

          // ✅ Robust extraction — handles cases where model forgets JSON quotes
          const headlineMatch = content.match(/"headline"\s*:\s*"([^"]+)"/);
          const summaryMatch = content.match(/"summary"\s*:\s*"([\s\S]+?)"\s*\n?\s*\}/);

          // Fallback: grab everything after "summary":
          const summaryFallback = content
            .replace(/[\s\S]*"summary"\s*:\s*/, "")
            .replace(/^"/, "")
            .replace(/"?\s*\}?\s*$/, "")
            .trim();

          return {
            headline: headlineMatch?.[1] || "Payments Industry Update",
            summary: summaryMatch?.[1] || summaryFallback || content.slice(0, 500),
          };
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error;
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
    return {
      headline: "Update from " + company,
      summary: newsText.slice(0, 200) + "...",
    };
  }
}

export async function batchGenerateSummaries(
  newsItems: Array<{ text: string; company: string }>
): Promise<Array<{ headline: string; summary: string }>> {
  const limit = pLimit(2);
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
  const maxTextLength = 1000;
  const truncatedText =
    text.length > maxTextLength
      ? text.substring(0, maxTextLength) + "..."
      : text;

  // ✅ scoring prompt stays here, separate from summary prompt
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
            max_tokens: 50,
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