import React, { useState, useEffect } from "react";
import { fetchHistory } from "../utils/api";
import { Search, Calendar, Code, ChevronRight, CornerDownRight } from "lucide-react";

export default function HistoryList({ onSelectReview, refreshKey = 0 }) {
  const [reviews, setReviews] = useState([]);
  const [query, setQuery] = useState("");
  const [semanticMode, setSemanticMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  async function loadHistory() {
    try {
      setLoading(true);
      setLoadError("");
      const mode = semanticMode ? "semantic" : "keyword";
      const data = await fetchHistory(query, mode);
      setReviews(data.reviews || []);
    } catch (error) {
      console.error("Failed to load review history:", error);
      setLoadError("Could not load history. Is the backend running on port 5000?");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [semanticMode, refreshKey]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadHistory();
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="history-layout">
      <div className="view-header">
        <h1 className="view-title">Review Repository</h1>
        <p className="view-subtitle">Browse and search historical code reviews. Search semantically or by keywords.</p>
      </div>

      <form onSubmit={handleSearchSubmit} className="search-bar">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              semanticMode 
                ? "Search past reviews semantically (e.g. 'SQL injections in login', 'unclosed connections')..." 
                : "Search by language, keywords..."
            }
          />
        </div>
        
        <div className="toggle-container">
          <span>Semantic Search</span>
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={semanticMode}
              onChange={(e) => setSemanticMode(e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

        <button type="submit" className="btn" disabled={loading}>
          <Search size={18} />
          <span>Search</span>
        </button>
      </form>

      {loading ? (
        <div className="loader-container" style={{ height: "200px" }}>
          <div className="spinner"></div>
          <span>Querying {semanticMode ? "ChromaDB memory..." : "review history..."}</span>
        </div>
      ) : loadError ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--color-danger)", background: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "16px" }}>
          <p>{loadError}</p>
        </div>
      ) : reviews.length === 0 ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: "16px" }}>
          <Search size={32} style={{ color: "var(--text-muted)", marginBottom: "12px" }} />
          <p>No reviews yet. Run a code review first, then return here.</p>
          <p style={{ fontSize: "0.85rem", marginTop: "8px", color: "var(--text-muted)" }}>History updates automatically after each successful Review.</p>
        </div>
      ) : (
        <div className="history-list">
          {reviews.map((rev) => (
            <div 
              key={rev.id} 
              className="history-item-card"
              onClick={() => onSelectReview(rev)}
            >
              <div className="history-item-details">
                <div className="history-item-meta">
                  <span className="badge performance" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {rev.language}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Calendar size={12} />
                    {formatDate(rev.timestamp)}
                  </span>
                  <span style={{ color: rev.analysis.score >= 80 ? "var(--color-success)" : rev.analysis.score >= 50 ? "var(--color-warning)" : "var(--color-danger)", fontWeight: 600 }}>
                    Score: {rev.analysis.score}/100
                  </span>
                </div>
                <h3 className="history-item-title">
                  Review ID: {rev.id.substring(0, 8)}...
                </h3>
                <p className="history-item-summary">
                  {rev.analysis.summary}
                </p>
                {rev.analysis.suggestions && rev.analysis.suggestions.length > 0 && (
                  <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {rev.analysis.suggestions.map((s, idx) => (
                      <span key={idx} className={`badge ${s.type}`} style={{ fontSize: "0.65rem" }}>
                        L{s.lineStart}: {s.type}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <ChevronRight size={20} style={{ color: "var(--text-muted)" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
