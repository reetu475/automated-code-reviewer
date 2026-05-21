import React from "react";
import { Code, History, BarChart2, Cpu, Database } from "lucide-react";

export default function Sidebar({ currentView, setView, status }) {
  return (
    <div className="sidebar">
      <div className="logo-section">
        <div className="logo-icon">
          <Code size={22} />
        </div>
        <span className="logo-text">Reviewer.AI</span>
      </div>

      <ul className="nav-links">
        <li 
          className={`nav-item ${currentView === "reviewer" ? "active" : ""}`}
          onClick={() => setView("reviewer")}
        >
          <Code />
          <span>Code Reviewer</span>
        </li>
        <li 
          className={`nav-item ${currentView === "history" ? "active" : ""}`}
          onClick={() => setView("history")}
        >
          <History />
          <span>Review History</span>
        </li>
        <li 
          className={`nav-item ${currentView === "insights" ? "active" : ""}`}
          onClick={() => setView("insights")}
        >
          <BarChart2 />
          <span>Insights & Stats</span>
        </li>
      </ul>

      <div className="status-panel">
        <div className="status-title">System Status</div>
        
        <div className="status-row">
          <span className="status-label">Gemini API</span>
          <span className="status-value">
            <span className={`status-dot ${status?.gemini?.configured ? "online" : "offline"}`}></span>
            {status?.gemini?.configured ? "Connected" : "Offline"}
          </span>
        </div>

        <div className="status-row">
          <span className="status-label">ChromaDB Cloud</span>
          <span className="status-value">
            <span className={`status-dot ${status?.chroma?.chromaConnected ? "online" : status?.chroma?.isMock ? "warning" : "offline"}`}></span>
            {status?.chroma?.chromaConnected ? "Connected" : status?.chroma?.isMock ? "Mock Mode" : "Offline"}
          </span>
        </div>
      </div>
    </div>
  );
}
