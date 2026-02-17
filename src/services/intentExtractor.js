import OpenAI from "openai";
import config from "../config.js";

const openai = new OpenAI({ apiKey: config.openaiKey });

const SYSTEM_PROMPT = `You are an intent-extraction assistant for a Malaysian government portal automation system.
The user will send a natural-language message about updating their **income (pendapatan)** on the idMe portal.

Your ONLY job is to extract the numeric income value.

Reply with a JSON object – no markdown, no explanation:
{
  "intent": "update_income",
  "new_income": <number or null>
}

Rules:
- If the message clearly contains an income value, set new_income to that number.
- Accept values in Malay ("tetapkan pendapatan saya kepada 5000") or English ("set my income to 12000").
- If the user says something unrelated or you cannot extract a number, set new_income to null.
- Always return valid JSON, nothing else.`;

/**
 * Parse a user message and extract the income value.
 * @param {string} userMessage
 * @returns {Promise<{ intent: string, new_income: number | null }>}
 */
export async function extractIncome(userMessage) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 120,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const raw = res.choices[0]?.message?.content?.trim();

  try {
    return JSON.parse(raw);
  } catch {
    console.error("[gpt] failed to parse response:", raw);
    return { intent: "unknown", new_income: null };
  }
}
