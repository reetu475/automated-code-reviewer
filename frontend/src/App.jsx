import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Reviewer from "./components/Reviewer";
import HistoryList from "./components/History";
import Insights from "./components/Insights";
import { fetchStatus } from "./utils/api";
import "./App.css";

export default function App() {
  const [view, setView] = useState("reviewer");
  const [selectedReview, setSelectedReview] = useState(null);
  const [status, setStatus] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);

  const getSystemStatus = async () => {
    try {
      const currentStatus = await fetchStatus();
      setStatus(currentStatus);
    } catch (err) {
      console.error("Failed to load backend system status:", err);
    }
  };

  useEffect(() => {
    getSystemStatus();
  }, []);

  const handleSelectReview = (review) => {
    setSelectedReview(review);
    setView("reviewer");
  };

  const handleReviewSuccess = () => {
    getSystemStatus();
    setDataVersion((v) => v + 1);
  };

  return (
    <div className="app-container">
      <Sidebar 
        currentView={view} 
        setView={setView} 
        status={status} 
      />
      
      <main className="main-content">
        {view === "reviewer" && (
          <>
            <div className="view-header">
              <h1 className="view-title">Automated Code Reviewer</h1>
              <p className="view-subtitle">AI review with memory-augmented RAG, inline fixes, auto-detect language, and exportable reports.</p>
            </div>
            <Reviewer 
              selectedReview={selectedReview} 
              onReviewSuccess={handleReviewSuccess}
            />
          </>
        )}
        
        {view === "history" && (
          <HistoryList 
            onSelectReview={handleSelectReview}
            refreshKey={dataVersion}
          />
        )}
        
        {view === "insights" && (
          <Insights refreshKey={dataVersion} />
        )}
      </main>
    </div>
  );
}
