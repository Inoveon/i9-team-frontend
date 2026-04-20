"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import { Terminal } from "./TerminalWS";
import { ChatTimeline } from "./chat/ChatTimeline";
import { useMessageStream } from "@/hooks/useMessageStream";

interface AgentViewProps {
  session: string;
  height?: number;
  showInput?: boolean;
  onSendMessage?: (message: string) => void | Promise<void>;
}

type Tab = "terminal" | "chat";

export function AgentView({ session, height = 440, showInput = false, onSendMessage }: AgentViewProps) {
  const [tab, setTab] = useState<Tab>("terminal");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const { events, clear, appendLocal } = useMessageStream(session);

  const hasNewChat = events.length > 0;

  const handleSend = useCallback(async () => {
    const msg = draft.trim();
    if (!msg || sending) return;
    if (!onSendMessage) {
      console.warn("[AgentView] onSendMessage ausente — mensagem ignorada", { session, msg });
      return;
    }
    console.log("[AgentView] enviando mensagem", { session, msg });
    setSending(true);
    // Feedback otimista: já adiciona o user_input na timeline
    appendLocal("user_input", msg);
    // Limpa o input imediatamente para UX fluida
    setDraft("");
    try {
      await onSendMessage(msg);
      console.log("[AgentView] mensagem enviada com sucesso", { session, msg });
    } catch (err) {
      console.error("[AgentView] falha ao enviar mensagem", { session, msg, err });
      appendLocal("system", `Falha ao enviar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }, [draft, sending, onSendMessage, session, appendLocal]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter envia; Shift+Enter reservado para futuras multiline (hoje input simples ignora)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

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
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "8px 12px",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "0 0 8px 8px",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "rgba(0,255,136,0.5)", fontFamily: "monospace", fontSize: 13, lineHeight: "32px" }}>❯</span>
                <input
                  type="text"
                  inputMode="text"
                  enterKeyHint="send"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  placeholder={sending ? "enviando..." : "Enviar mensagem ao agente..."}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#00ff88",
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 14, // iOS não faz zoom quando >=14px
                    caretColor: "#00d4ff",
                    minWidth: 0,
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || !draft.trim()}
                  aria-label="Enviar mensagem"
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1px solid rgba(0,255,136,0.4)",
                    background: sending ? "rgba(0,255,136,0.05)" : "transparent",
                    color: !draft.trim() ? "rgba(0,255,136,0.25)" : "#00ff88",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: sending || !draft.trim() ? "not-allowed" : "pointer",
                    fontFamily: "monospace",
                    letterSpacing: "0.05em",
                    flexShrink: 0,
                  }}
                >
                  {sending ? "..." : "Send"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
