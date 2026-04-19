"use client";

import { useState } from "react";
import { Terminal } from "./TerminalWS";
import { ChatTimeline } from "./chat/ChatTimeline";
import { useMessageStream } from "@/hooks/useMessageStream";

interface AgentViewProps {
  session: string;
  height?: number;
  showInput?: boolean;
  onSendMessage?: (message: string) => void;
}

type Tab = "terminal" | "chat";

export function AgentView({ session, height = 440, showInput = false, onSendMessage }: AgentViewProps) {
  const [tab, setTab] = useState<Tab>("terminal");
  const { events, clear } = useMessageStream(session);

  const hasNewChat = events.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Tab bar */}
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        marginBottom: 0,
      }}>
        {(["terminal", "chat"] as Tab[]).map((t) => {
          const isActive = tab === t;
          const label = t === "terminal" ? "Terminal" : `Chat${hasNewChat && t === "chat" ? ` (${events.length})` : ""}`;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 16px",
                fontSize: 11,
                fontWeight: isActive ? 700 : 400,
                fontFamily: '"JetBrains Mono", monospace',
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: isActive ? "rgba(0,212,255,0.06)" : "transparent",
                border: "none",
                borderBottom: isActive ? "2px solid var(--neon-blue, #00d4ff)" : "2px solid transparent",
                color: isActive ? "var(--neon-blue, #00d4ff)" : "rgba(255,255,255,0.3)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}

        {/* Botão limpar chat */}
        {tab === "chat" && events.length > 0 && (
          <button
            onClick={clear}
            style={{
              marginLeft: "auto",
              padding: "4px 10px",
              fontSize: 10,
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.2)",
              cursor: "pointer",
              fontFamily: "monospace",
            }}
          >
            limpar
          </button>
        )}
      </div>

      {/* Conteúdo da aba */}
      <div style={{ position: "relative", minHeight: 0 }}>
        {/* Terminal — sempre montado, apenas escondido quando na aba chat */}
        <div style={{ display: tab === "terminal" ? "block" : "none" }}>
          <Terminal
            session={session}
            height={height}
            showInput={showInput && tab === "terminal"}
          />
        </div>

        {/* Chat timeline */}
        {tab === "chat" && (
          <div style={{
            background: "rgba(8,11,20,0.95)",
            border: "1px solid rgba(0,255,136,0.1)",
            borderRadius: "0 0 8px 8px",
          }}>
            <ChatTimeline events={events} height={height} />

            {/* Input de mensagem no chat (se habilitado) */}
            {showInput && onSendMessage && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const msg = (fd.get("message") as string)?.trim();
                  if (msg) {
                    onSendMessage(msg);
                    e.currentTarget.reset();
                  }
                }}
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "8px 12px",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "0 0 8px 8px",
                }}
              >
                <span style={{ color: "rgba(0,255,136,0.5)", fontFamily: "monospace", fontSize: 13, lineHeight: "32px" }}>❯</span>
                <input
                  name="message"
                  placeholder="Enviar mensagem ao agente..."
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#00ff88",
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 13,
                    caretColor: "#00d4ff",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "4px 16px",
                    borderRadius: 6,
                    border: "1px solid rgba(0,255,136,0.4)",
                    background: "transparent",
                    color: "#00ff88",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "monospace",
                  }}
                >
                  Enter
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
