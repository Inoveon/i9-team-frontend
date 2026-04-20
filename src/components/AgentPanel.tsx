"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { Terminal } from "./Terminal";
import { StatusBadge } from "./StatusBadge";
import { useTeamStore } from "@/lib/store";
import { createWebSocket } from "@/lib/ws";
import type { Agent } from "@/types";

interface AgentPanelProps {
  agent: Agent;
  height?: number;
  onSendMessage?: (message: string) => void | Promise<void>;
  showInput?: boolean;
}

export function AgentPanel({
  agent,
  height = 280,
  onSendMessage,
  showInput = false,
}: AgentPanelProps) {
  const { appendOutput, agentOutputs } = useTeamStore();
  const lines = agentOutputs[agent.id] ?? [];

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!agent.sessionId) return;

    const ws = createWebSocket(agent.sessionId, (data) => {
      appendOutput(agent.id, data);
    });

    return () => {
      ws.close();
    };
  }, [agent.sessionId, agent.id, appendOutput]);

  const handleSend = useCallback(async () => {
    const msg = draft.trim();
    if (!msg || sending || !onSendMessage) return;
    console.log("[AgentPanel] enviando mensagem", { agent: agent.name, msg });
    setSending(true);
    setDraft("");
    try {
      await onSendMessage(msg);
      console.log("[AgentPanel] mensagem enviada com sucesso", { agent: agent.name });
    } catch (err) {
      console.error("[AgentPanel] falha ao enviar mensagem", { agent: agent.name, err });
    } finally {
      setSending(false);
    }
  }, [draft, sending, onSendMessage, agent.name]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div
      className="card"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: agent.role === "orchestrator" ? "var(--neon-purple)" : "var(--neon-blue)",
            }}
          >
            {agent.name}
          </span>
          <span
            style={{
              marginLeft: 8,
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {agent.role}
          </span>
        </div>
        <StatusBadge status={agent.status} size="sm" />
      </div>

      <Terminal lines={lines} height={height} />

      {showInput && onSendMessage && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            inputMode="text"
            enterKeyHint="send"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            placeholder={sending ? "enviando..." : "Enviar mensagem ao orquestrador..."}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
              fontSize: 14, // iOS zoom guard
              outline: "none",
              minWidth: 0,
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !draft.trim()}
            aria-label="Enviar mensagem"
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--neon-blue)",
              background: sending ? "rgba(0,212,255,0.05)" : "transparent",
              color: !draft.trim() ? "rgba(0,212,255,0.35)" : "var(--neon-blue)",
              fontSize: 12,
              fontWeight: 700,
              cursor: sending || !draft.trim() ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {sending ? "..." : "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}
