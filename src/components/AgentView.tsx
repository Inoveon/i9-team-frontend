"use client";

import { useState } from "react";
import { RefreshCw, FileText } from "lucide-react";
import { Terminal, type TerminalSendExtras } from "./TerminalWS";
import { StatusBadge } from "./StatusBadge";
import { AgentContextDialog } from "./AgentContextDialog";
import type { AgentStatus } from "@/types";

/**
 * AgentView — Card auto-suficiente do agente: header (nome + role + status +
 * ações) + terminal real-time + input bar.
 *
 * Cadeia de altura (Task `portal-fix-layout-altura`):
 *   pai (flex column 100%) → AgentView (`.agent-frame` flex column)
 *     → header (flex-shrink:0)
 *     → terminal (flex:1 + min-height:0)  ← preenche espaço restante
 *     → input bar (flex-shrink:0, dentro do TerminalWS)
 *
 * Header (Task `portal-ux-scroll-headers-context-lucide`):
 *   - nome + role + StatusBadge
 *   - botão ⟳ Refresh: força re-mount do <Terminal> (via `reconnectKey` na
 *     `key` prop) — fecha WS e reconecta sem F5.
 *   - botão 📄 Context: abre `AgentContextDialog` carregando o agent-context.md
 *     do agente via REST.
 */

interface AgentViewProps {
  session: string;
  /**
   * Altura fixa em px. Se omitido → modo **flex** (ocupa o espaço disponível
   * do container pai, que precisa ser `display:flex flexDirection:column`).
   */
  height?: number;
  showInput?: boolean;
  onSendMessage?: (
    message: string,
    opts?: TerminalSendExtras
  ) => void | Promise<void>;
  /** Team ID — necessário para uploads de anexo + carregar contexto via REST. */
  teamId?: string;

  // ── Header opcional ──────────────────────────────────────────────────
  /** Nome do agente exibido no header. Quando omitido, header é ocultado. */
  agentName?: string;
  /** "orchestrator" | "worker" — controla cor do nome no header */
  agentRole?: "orchestrator" | "worker";
  /** Status do agente — exibe StatusBadge no header */
  agentStatus?: AgentStatus;
  /** Liga estilo glass card no wrapper (`.agent-frame`). Default: true */
  framed?: boolean;
}

export function AgentView({
  session,
  height,
  showInput = false,
  onSendMessage,
  teamId,
  agentName,
  agentRole,
  agentStatus,
  framed = true,
}: AgentViewProps) {
  const isFlex = height === undefined;
  const showHeader = !!agentName;

  // Reconnect: incrementar essa key força React a desmontar+remontar o
  // <Terminal>, o que fecha o WS e reabre conexão limpa.
  const [reconnectKey, setReconnectKey] = useState(0);
  const [contextOpen, setContextOpen] = useState(false);

  const wrapperClass = framed ? "agent-frame" : undefined;
  const wrapperStyle: React.CSSProperties = framed
    ? {
        padding: 12,
        gap: 10,
      }
    : {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 0,
        flex: isFlex ? 1 : undefined,
        height: isFlex ? "100%" : height,
        overflow: "hidden",
      };

  const canShowContext = !!teamId && !!agentName;

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      {showHeader && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color:
                agentRole === "orchestrator" ? "#a78bfa" : "var(--accent)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
              flex: 1,
            }}
            title={agentName}
          >
            {agentName}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            {agentRole && (
              <span
                style={{
                  fontSize: 9,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {agentRole === "orchestrator" ? "ORQ" : "WORKER"}
              </span>
            )}
            {agentStatus && <StatusBadge status={agentStatus} size="sm" />}
            <button
              type="button"
              className="agent-frame__btn"
              onClick={() => setReconnectKey((k) => k + 1)}
              title="Reconectar terminal"
              aria-label="Reconectar terminal"
            >
              <RefreshCw size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="agent-frame__btn"
              onClick={() => setContextOpen(true)}
              disabled={!canShowContext}
              title={
                canShowContext
                  ? "Ver contexto do agente"
                  : "Contexto indisponível (sem teamId)"
              }
              aria-label="Ver contexto do agente"
            >
              <FileText size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Terminal
          key={reconnectKey}
          session={session}
          height={height}
          showInput={showInput}
          onSendMessage={onSendMessage}
          teamId={teamId}
        />
      </div>

      {canShowContext && (
        <AgentContextDialog
          open={contextOpen}
          onClose={() => setContextOpen(false)}
          teamId={teamId!}
          agentName={agentName!}
        />
      )}
    </div>
  );
}
