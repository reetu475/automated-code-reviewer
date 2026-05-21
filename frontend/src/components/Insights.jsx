import React, { useState, useEffect } from "react";
import { fetchInsights } from "../utils/api";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar 
} from "recharts";
import { Award, AlertTriangle, Shield, CheckCircle, HelpCircle } from "lucide-react";

export default function Insights({ refreshKey = 0 }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await fetchInsights();
        setInsights(data);
      } catch (err) {
        setError("Failed to fetch insights dashboard metrics.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner"></div>
        <span>Calculating quality statistics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px", color: "var(--color-danger)", textAlign: "center" }}>
        <AlertTriangle size={32} style={{ marginBottom: "12px" }} />
        <p>{error}</p>
      </div>
    );
  }

  if (!insights || insights.empty) {
    return (
      <div style={{ padding: "80px 40px", textAlign: "center", color: "var(--text-secondary)" }}>
        <Award size={48} style={{ color: "var(--accent-cyan)", marginBottom: "20px", opacity: 0.8 }} />
        <h2 style={{ color: "#fff", marginBottom: "8px" }}>No Insights Available Yet</h2>
        <p style={{ maxWidth: "450px", margin: "0 auto", fontSize: "0.95rem" }}>
          Run your first automated code review from the editor. Once reviews are logged, your dashboard metrics and graphs will populate here.
        </p>
      </div>
    );
  }

  const PIE_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"];

  return (
    <div className="history-layout">
      <div className="view-header">
        <h1 className="view-title">Insights Dashboard</h1>
        <p className="view-subtitle">Aggregate code health, vulnerability statistics, and development trends.</p>
      </div>

      {/* Metrics Row */}
      <div className="insights-grid">
        <div className="stat-card">
          <div className="stat-label">Total Code Files Analyzed</div>
          <div className="stat-val">{insights.totalReviews}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Average Quality Score</div>
          <div className="stat-val">{insights.averageScore}/100</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Security Rating</div>
          <div className="stat-val" style={{ color: "var(--color-success)" }}>
            {insights.averageMetrics?.security}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Readability Rating</div>
          <div className="stat-val" style={{ color: "var(--accent-cyan)" }}>
            {insights.averageMetrics?.readability}%
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="insights-charts-grid">
        {/* Historical score graph */}
        <div className="chart-card">
          <h3 className="chart-title">Quality Trend (Last 10 Runs)</h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={insights.recentScores}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="index" stroke="var(--text-muted)" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} />
                <Tooltip 
                  contentStyle={{ background: "var(--bg-dark)", border: "1px solid var(--border-color)", borderRadius: "8px" }}
                  labelStyle={{ color: "var(--text-muted)" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="var(--accent-cyan)" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: "var(--bg-dark)", stroke: "var(--accent-cyan)", strokeWidth: 2 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Issue categorization pie chart */}
        <div className="chart-card">
          <h3 className="chart-title">Code Issue Density by Classification</h3>
          <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={insights.vulnerabilitiesByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {insights.vulnerabilitiesByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: "var(--bg-dark)", border: "1px solid var(--border-color)", borderRadius: "8px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Development Activity Bar Chart */}
        <div className="chart-card" style={{ gridColumn: "span 2", height: "300px" }}>
          <h3 className="chart-title">Review Session Activity History</h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={insights.activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ background: "var(--bg-dark)", border: "1px solid var(--border-color)", borderRadius: "8px" }}
                />
                <Bar dataKey="count" fill="var(--accent-purple)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
