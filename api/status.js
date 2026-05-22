import { getStatus } from "../backend/services/chroma.js";

export default function handler(req, res) {
  const geminiConfigured =
    !!process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY";

  res.status(200).json({
    gemini: {
      configured: geminiConfigured,
      status: geminiConfigured ? "Online" : "Missing API Key"
    },
    chroma: getStatus()
  });
}
