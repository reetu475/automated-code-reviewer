import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
export const ai = new GoogleGenAI({ apiKey });

/** Prefer stable models first when 2.5-flash is overloaded */
export const GENERATION_MODELS = (
  process.env.GEMINI_MODELS ||
  "gemini-2.0-flash,gemini-2.5-flash,gemini-1.5-flash"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const MAX_RETRIES_PER_MODEL = 3;
const INITIAL_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableGeminiError(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  const code = err?.status || err?.code || err?.error?.code;
  return (
    code === 503 ||
    code === 429 ||
    code === "UNAVAILABLE" ||
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("high demand") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("resource exhausted") ||
    msg.includes("try again")
  );
}

export function formatGeminiError(err) {
  if (isRetryableGeminiError(err)) {
    return "Gemini AI is busy right now (high demand). Please wait 30 seconds and click Review again — the app will retry automatically.";
  }
  return err?.message || String(err);
}

/**
 * Calls generateContent with retries and model fallbacks.
 */
export async function generateWithFallback({ contents, config, label = "request" }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API Key is missing. Please set GEMINI_API_KEY in your .env file.");
  }

  let lastError = null;

  for (const model of GENERATION_MODELS) {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        if (attempt > 0 || model !== GENERATION_MODELS[0]) {
          console.log(`[Gemini] ${label}: trying ${model} (attempt ${attempt + 1})...`);
        }
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });
        if (!response.text) {
          throw new Error("No response text from Gemini API.");
        }
        return { response, model };
      } catch (err) {
        lastError = err;
        const retryable = isRetryableGeminiError(err);
        console.warn(
          `[Gemini] ${label} failed on ${model} (attempt ${attempt + 1}):`,
          err?.message || err
        );
        if (!retryable) break;
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw new Error(formatGeminiError(lastError));
}

export async function embedWithRetry(text) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API Key is missing. Please set GEMINI_API_KEY in your .env file.");
  }

  const models = ["gemini-embedding-001", "text-embedding-004"];
  let lastError = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await ai.models.embedContent({ model, contents: text });
        const values =
          response.embeddings?.[0]?.values ??
          response.embedding?.values;
        if (values?.length) return values;
        throw new Error("Failed to generate embedding from Gemini API.");
      } catch (err) {
        lastError = err;
        if (!isRetryableGeminiError(err)) throw err;
        await sleep(INITIAL_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }
  throw new Error(formatGeminiError(lastError));
}
