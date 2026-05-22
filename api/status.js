export default function handler(req, res) {
  const geminiConfigured =
    !!process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY";

  res.status(200).json({
    gemini: {
      configured: geminiConfigured,
      status: geminiConfigured ? "Online" : "Missing API Key"
    },
    chroma: {
      chromaConnected: !!process.env.CHROMA_API_KEY,
      isMock: !process.env.CHROMA_API_KEY,
      database: process.env.CHROMA_DATABASE || "aii",
      tenant: process.env.CHROMA_TENANT || "N/A",
      host: process.env.CHROMA_HOST || "api.trychroma.com"
    }
  });
}
