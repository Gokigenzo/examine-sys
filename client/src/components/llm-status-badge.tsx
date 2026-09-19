"use client";
import { useEffect, useState } from "react";
import { api, LlmStatus } from "@/lib/api";
import { Bot, Cloud, Monitor, RefreshCw } from "lucide-react";

export default function LlmStatusBadge() {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [switching, setSwitching] = useState(false);

  const loadStatus = () => {
    api.getLlmStatus().then(setStatus).catch(console.error);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSwitch = async () => {
    if (!status || switching) return;
    const newProvider = status.provider === "ollama" ? "gemini" : "ollama";
    setSwitching(true);
    try {
      await api.switchLlmProvider(newProvider as "gemini" | "ollama");
      loadStatus();
    } catch (e) {
      console.error(e);
    }
    setSwitching(false);
  };

  if (!status) return null;

  const isOllama = status.provider === "ollama";
  const isOnline = isOllama
    ? status.ollama.status === "online" && status.ollama.model_available
    : status.gemini_configured;

  return (
    <div className="flex items-center gap-2">
      {/* Status indicator */}
      <button
        onClick={handleSwitch}
        disabled={switching}
        title={`Đang dùng: ${isOllama ? `Ollama (${status.ollama.active_model})` : `Gemini (${status.gemini_model})`}. Nhấn để chuyển.`}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 border"
        style={{
          backgroundColor: isOnline ? (isOllama ? "#f0fdf4" : "#eff6ff") : "#fef2f2",
          borderColor: isOnline ? (isOllama ? "#86efac" : "#93c5fd") : "#fca5a5",
          color: isOnline ? (isOllama ? "#166534" : "#1e40af") : "#991b1b",
        }}
      >
        {switching ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : isOllama ? (
          <Monitor className="w-3 h-3" />
        ) : (
          <Cloud className="w-3 h-3" />
        )}
        <span className="hidden sm:inline">
          {isOllama
            ? status.ollama.active_model
            : status.gemini_model}
        </span>
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: isOnline ? "#22c55e" : "#ef4444",
          }}
        />
      </button>
    </div>
  );
}
