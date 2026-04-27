"use client";

import { Terminal, type TerminalSendExtras } from "./TerminalWS";

/**
 * AgentView — Wrapper minimalista do Terminal real-time.
 *
 * Foi simplificado na Task 15 (Portal Real-Time): a aba "Chat" foi
 * eliminada porque o Terminal já entrega o output do tmux com fluidez
 * total via WebSocket. Anexos (paste/clip) e status bar agora vivem
 * dentro do próprio Terminal.
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
  /** Team ID necessário para uploads de anexo (POST /upload/image?teamId=...) */
  teamId?: string;
}

export function AgentView({
  session,
  height,
  showInput = false,
  onSendMessage,
  teamId,
}: AgentViewProps) {
  const isFlex = height === undefined;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: isFlex ? 1 : undefined,
        height: isFlex ? "100%" : undefined,
      }}
    >
      <Terminal
        session={session}
        height={height}
        showInput={showInput}
        onSendMessage={onSendMessage}
        teamId={teamId}
      />
    </div>
  );
}
