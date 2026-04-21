"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "./TerminalWS";
import { ChatTimeline, type ChatTimelineHandle } from "./chat/ChatTimeline";
import { ChatInput, type ChatInputSendExtras } from "./chat/ChatInput";
import { NewMessagesPill } from "./chat/NewMessagesPill";
import { ToastStack } from "./notes/NotesToast";
import { useMessageStream } from "@/hooks/useMessageStream";
import { useToasts } from "@/hooks/useToasts";

interface AgentViewProps {
  session: string;
  /**
   * Altura fixa em px. Se omitido → modo **flex** (ocupa o espaço disponível
   * do container pai, que precisa ser `display:flex flexDirection:column`).
   * Padrão: modo flex.
   */
  height?: number;
  showInput?: boolean;
  onSendMessage?: (
    message: string,
    opts?: { attachmentIds?: string[] }
  ) => void | Promise<void>;
  /** Team ID necessário para uploads de anexo (POST /upload/image?teamId=...) */
  teamId?: string;
}

type Tab = "terminal" | "chat";

export function AgentView({
  session,
  height,
  showInput = false,
  onSendMessage,
  teamId,
}: AgentViewProps) {
  const isFlex = height === undefined;
  const [tab, setTab] = useState<Tab>("terminal");
  const { events, clear, appendLocal } = useMessageStream(session);
  const { toasts, pushToast, dismissToast } = useToasts();

  const hasNewCount = events.length > 0;

  // ── Sticky-bottom / pill (Onda 2) ────────────────────────────────────
  const timelineRef = useRef<ChatTimelineHandle | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNew, setHasNew] = useState(false);

  // Toda vez que chega evento novo e o usuário NÃO está no fim → sinaliza pill.
  // Quando o usuário volta ao fim → limpa o sinal.
  const prevLenRef = useRef(0);
  useEffect(() => {
    const grew = events.length > prevLenRef.current;
    prevLenRef.current = events.length;
    if (isAtBottom) {
      setHasNew(false);
    } else if (grew) {
      setHasNew(true);
    }
  }, [events.length, isAtBottom]);

  const onBottomChange = useCallback((atBottom: boolean) => {
    setIsAtBottom(atBottom);
    if (atBottom) setHasNew(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    timelineRef.current?.scrollToBottom("smooth");
    setHasNew(false);
  }, []);

  // ── Envio de mensagem (Ondas 1 + 5 — otimista + anexos) ─────────────
  const handleSend = useCallback(
    async (msg: string, extras?: ChatInputSendExtras) => {
      if (!onSendMessage) {
        console.warn("[AgentView] onSendMessage ausente — mensagem ignorada", { session, msg });
        return;
      }
      const attachmentIds = extras?.attachmentIds;
      const attachments = extras?.attachments;
      console.log("[AgentView] enviando mensagem", {
        session,
        bytes: msg.length,
        attachments: attachmentIds?.length ?? 0,
      });
      // Feedback otimista: empurra user_input localmente com anexos (será reconciliado com eco)
      appendLocal("user_input", msg, { attachments });
      try {
        await onSendMessage(msg, attachmentIds ? { attachmentIds } : undefined);
        console.log("[AgentView] mensagem enviada com sucesso", { session });
      } catch (err) {
        console.error("[AgentView] falha ao enviar mensagem", { session, err });
        appendLocal("system", `Falha ao enviar: ${err instanceof Error ? err.message : String(err)}`);
        throw err; // propaga para ChatInput não travar UI
      }
    },
    [onSendMessage, session, appendLocal]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        // modo flex: herda altura do pai; modo fixo: altura natural
        flex: isFlex ? 1 : undefined,
        height: isFlex ? "100%" : undefined,
      }}
    >
      {/* Tab bar */}
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        marginBottom: 0,
        flexShrink: 0,
      }}>
        {(["terminal", "chat"] as Tab[]).map((t) => {
          const isActive = tab === t;
          const label = t === "terminal" ? "Terminal" : `Chat${hasNewCount && t === "chat" ? ` (${events.length})` : ""}`;
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
      <div
        style={{
          position: "relative",
          minHeight: 0,
          flex: isFlex ? 1 : undefined,
          display: isFlex ? "flex" : "block",
          flexDirection: isFlex ? "column" : undefined,
          overflow: isFlex ? "hidden" : undefined,
        }}
      >
        {/* Terminal — sempre montado, apenas escondido quando na aba chat */}
        <div
          style={{
            display: tab === "terminal" ? (isFlex ? "flex" : "block") : "none",
            flex: isFlex ? 1 : undefined,
            flexDirection: isFlex ? "column" : undefined,
            minHeight: 0,
          }}
        >
          <Terminal
            session={session}
            height={height}
            showInput={showInput && tab === "terminal"}
          />
        </div>

        {/* Chat timeline */}
        {tab === "chat" && (
          <div
            style={{
              background: "rgba(8,11,20,0.95)",
              border: "1px solid rgba(0,255,136,0.1)",
              borderRadius: "0 0 8px 8px",
              display: "flex",
              flexDirection: "column",
              flex: isFlex ? 1 : undefined,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <ChatTimeline
              ref={timelineRef}
              events={events}
              height={height}
              onBottomChange={onBottomChange}
            />

            {/* Wrapper relativo: ancora a pill acima do input (bottom: 100%) */}
            {showInput && onSendMessage && (
              <div style={{ position: "relative", flexShrink: 0 }}>
                <NewMessagesPill
                  visible={hasNew && !isAtBottom}
                  onClick={scrollToBottom}
                />
                <ChatInput
                  onSend={handleSend}
                  teamId={teamId}
                  onValidationError={(message) =>
                    pushToast("warning", message, { title: "Anexo rejeitado" })
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toasts (validação de anexos, etc) */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
