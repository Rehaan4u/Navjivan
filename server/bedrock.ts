import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";
 
// ── Helper: call Groq with Llama model ──
async function invokeClause(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 1200
): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
    }),
  });
 
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }
 
  const data = await response.json();
  return data.choices[0].message.content;
}
 
// ── Helper: check if error is throttling/rate limit ──
function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("ThrottlingException") ||
    errorMsg.toLowerCase().includes("too many requests") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}
 
// ── Generate headline + summary for a news article ──
export async function generateNewsSummary(
  newsText: string,
  company: string
): Promise<{ headline: string; summary: string }> {
 
  const systemPrompt = `You are a sharp, witty cloud industry journalist writing for engineers and cloud professionals. You blend deep technical insight with punchy, memorable writing. Your headlines make people stop scrolling. Your summaries make people feel genuinely smarter.`;
 
  const userPrompt = `Write a newsletter article about ${company} based on this news:
 
${newsText}
 
Return ONLY valid JSON, nothing else:
{
  "headline": "A question-style headline — witty, intriguing, under 12 words. Make it sound like something a smart friend would ask you at coffee. Example style: 'Is AWS Finally Killing the Last Reason to Stay On-Premise?'",
  "summary": "Write exactly 3 paragraphs separated by the delimiter ||PARA|| between them (no newlines, no line breaks between paragraphs)". Each paragraph 4-5 sentences.\\n\\nPara 1 — THE STORY: Start with one relevant emoji. Hook the reader immediately. What happened, why now, what forced this move. Make them feel the weight of it.\\n\\nPara 2 — THE RIPPLE EFFECT: What does this mean for the cloud industry? Who wins, who loses, what changes for engineers, architects, CTOs? Be specific, not vague.\\n\\nPara 3 — HOW IS THIS USEFUL TO YOU?: Speak directly to a cloud engineer or someone breaking into cloud (like a fresher or junior). What should they learn, watch, or do because of this news? Be practical, encouraging, and specific. End with one forward-looking sentence."
}`;
 
  try {
    const response = await pRetry(
      async () => {
        try {
          const content = await invokeClause(systemPrompt, userPrompt, 1200);
 
          // ── Robust JSON extraction ──
          const jsonMatch = content
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim()
            .match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.headline && parsed.summary) {
                return {
                  headline: parsed.headline,
                  summary: parsed.summary,
                };
              }
            } catch (e) {
              // fall through to regex extraction
            }
          }
 
          // ── Fallback regex extraction ──
          const headlineMatch = content.match(/"headline"\s*:\s*"([^"]+)"/);
          const summaryMatch = content.match(/"summary"\s*:\s*"([\s\S]+?)"\s*\}/);
 
          return {
            headline: headlineMatch?.[1] || `What's Next for ${company}?`,
            summary: summaryMatch?.[1] || newsText.slice(0, 300) + "...",
          };
        } catch (error: any) {
          if (isRateLimitError(error)) throw error;
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
      headline: `What's New at ${company}?`,
      summary: newsText.slice(0, 200) + "...",
    };
  }
}
 
// ── Score how relevant an article is to a company (0-100) ──
export async function scoreArticleRelevance(
  title: string,
  text: string,
  company: string
): Promise<number> {
  const truncatedText = text.length > 800
    ? text.substring(0, 800) + "..."
    : text;
 
  const systemPrompt = `You are a relevance scoring AI. Always respond with valid JSON only. No explanation.`;
 
  const userPrompt = `Score relevance of this article to "${company}" (0-100).
 
Rules:
- "${company}" not mentioned → 0-25 max
- Mentioned briefly → 26-50
- Substantially about "${company}" → 51-85  
- Primarily about "${company}" with major impact → 86-100
 
Title: ${title}
Text: ${truncatedText}
 
Return: {"score": <integer>}`;
 
  try {
    const response = await pRetry(
      async () => {
        try {
          const content = await invokeClause(systemPrompt, userPrompt, 50);
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          return parsed.score || 50;
        } catch (error: any) {
          if (isRateLimitError(error)) throw error;
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
 
// ── Batch process multiple articles with concurrency limit ──
export async function batchGenerateSummaries(
  newsItems: Array<{ text: string; company: string }>
): Promise<Array<{ headline: string; summary: string }>> {
  const limit = pLimit(2);
  const promises = newsItems.map((item) =>
    limit(() => generateNewsSummary(item.text, item.company))
  );
  return await Promise.all(promises);
}