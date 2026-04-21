"use client";

import { useCallback, useEffect } from "react";
import { Terminal } from "./Terminal";
import { StatusBadge } from "./StatusBadge";
import { ChatInput } from "./chat/ChatInput";
import { useTeamStore } from "@/lib/store";
import { createWebSocket } from "@/lib/ws";
import type { Agent } from "@/types";

interface AgentPanelProps {
  agent: Agent;
  /**
   * Altura fixa em px. Se omitido → modo **flex** (ocupa espaço do pai).
   */
  height?: number;
  onSendMessage?: (message: string) => void | Promise<void>;
  showInput?: boolean;
}

export function AgentPanel({
  agent,
  height,
  onSendMessage,
  showInput = false,
}: AgentPanelProps) {
  const isFlex = height === undefined;
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

  const handleSend = useCallback(
    async (msg: string) => {
      if (!onSendMessage) return;
      console.log("[AgentPanel] enviando mensagem", { agent: agent.name, bytes: msg.length });
      try {
        await onSendMessage(msg);
        console.log("[AgentPanel] mensagem enviada com sucesso", { agent: agent.name });
      } catch (err) {
        console.error("[AgentPanel] falha ao enviar mensagem", { agent: agent.name, err });
        throw err; // propaga pro ChatInput manter o estado de sending consistente
      }
    },
    [onSendMessage, agent.name]
  );

  return (
    <div
      className="card"
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        flex: isFlex ? 1 : undefined,
        minHeight: 0,
        height: isFlex ? "100%" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
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
        <ChatInput
          onSend={handleSend}
          placeholder={
            agent.role === "orchestrator"
              ? "Enviar mensagem ao orquestrador..."
              : "Enviar mensagem ao agente..."
          }
        />
      )}
    </div>
  );
}
