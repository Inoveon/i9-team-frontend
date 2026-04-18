"use client";

import { useEffect } from "react";
import { Terminal } from "./Terminal";
import { StatusBadge } from "./StatusBadge";
import { useTeamStore } from "@/lib/store";
import { createWebSocket } from "@/lib/ws";
import type { Agent } from "@/types";

interface AgentPanelProps {
  agent: Agent;
  height?: number;
  onSendMessage?: (message: string) => void;
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

  useEffect(() => {
    if (!agent.sessionId) return;

    const ws = createWebSocket(agent.sessionId, (data) => {
      appendOutput(agent.id, data);
    });

    return () => {
      ws.close();
    };
  }, [agent.sessionId, agent.id, appendOutput]);

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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const msg = fd.get("message") as string;
            if (msg.trim()) {
              onSendMessage(msg.trim());
              e.currentTarget.reset();
            }
          }}
          style={{ display: "flex", gap: 8 }}
        >
          <input
            name="message"
            placeholder="Enviar mensagem ao orquestrador..."
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
              fontSize: 13,
              outline: "none",
            }}
            autoComplete="off"
          />
          <button
            type="submit"
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--neon-blue)",
              background: "transparent",
              color: "var(--neon-blue)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Enviar
          </button>
        </form>
      )}
    </div>
  );
}
