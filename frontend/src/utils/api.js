const API_BASE = "/api";

export async function fetchStatus() {
  try {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error("Server status check failed");
    return await res.json();
  } catch (error) {
    console.error("API Error (fetchStatus):", error);
    return {
      gemini: { configured: false, status: "Offline" },
      chroma: { chromaConnected: false, isMock: true, database: "Offline", tenant: "N/A", host: "N/A" }
    };
  }
}

export async function reviewCode(code, language) {
  const res = await fetch(`${API_BASE}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to analyze code");
  }
  return await res.json();
}

export async function sendChatRefactor(code, language, messages) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language, messages })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to get chat response");
  }
  return await res.json();
}

export async function fetchHistory(query = "", mode = "keyword") {
  const params = new URLSearchParams();
  if (query) params.append("query", query);
  params.append("mode", mode);
  
  const res = await fetch(`${API_BASE}/history?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return await res.json();
}

export async function detectLanguage(code) {
  const res = await fetch(`${API_BASE}/detect-language`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to detect language");
  }
  return await res.json();
}

export async function fetchInsights() {
  const res = await fetch(`${API_BASE}/insights`);
  if (!res.ok) throw new Error("Failed to fetch insights dashboard");
  return await res.json();
}
