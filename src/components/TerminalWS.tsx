"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import TextareaAutosize from "react-textarea-autosize";
import { getAuthToken } from "@/lib/api";
import { getWsBase } from "@/lib/runtime-config";
import { useAttachment } from "@/hooks/useAttachment";
import { AttachmentChip } from "./chat/AttachmentChip";
import { MenuDialog } from "./MenuDialog";
import {
  ALLOWED_MIMES,
  MAX_ATTACHMENTS,
  extractFilesFromClipboard,
  type EventAttachment,
} from "@/lib/chat-attachments";

interface MenuOption {
  index: number;
  label: string;
}

export interface InteractiveMenu {
  options: MenuOption[];
  currentIndex: number;
}

type WSState = "connecting" | "open" | "closing" | "closed";

export interface TerminalSendExtras {
  attachmentIds?: string[];
  attachments?: EventAttachment[];
}

interface TerminalProps {
  session: string;
  height?: number;
  showInput?: boolean;
  initialMenu?: InteractiveMenu | null;
  onMenuChange?: (session: string, menu: InteractiveMenu | null) => void;
  /**
   * Callback de envio de mensagem. Quando presente, o input bar usa este
   * callback (POST REST `/teams/:id/message`) ao invés de enviar `keys`
   * pelo WebSocket — permite anexar `attachmentIds[]` na mesma chamada.
   *
   * Se ausente, o input bar cai no fallback WS `{type:"input"}`.
   */
  onSendMessage?: (
    message: string,
    extras?: TerminalSendExtras
  ) => void | Promise<void>;
  /** Team ID — habilita uploads de anexo (POST /upload/image?teamId=...) */
  teamId?: string;
  /** Callback opcional pra exibir toast de validação de anexo */
  onValidationError?: (message: string) => void;
}

export function Terminal({
  session,
  height,
  showInput = false,
  initialMenu = null,
  onMenuChange,
  onSendMessage,
  teamId,
  onValidationError,
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<InteractiveMenu | null>(initialMenu);
  const menuRef = useRef<InteractiveMenu | null>(null);
  const noMenuCountRef = useRef(0);

  // ── Input bar state ──────────────────────────────────────────────────
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [wsState, setWsState] = useState<WSState>("connecting");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const lastOutputAtRef = useRef<number>(0);

  // ── Attachments ──────────────────────────────────────────────────────
  const {
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    hasUploading,
    uploadedCount,
    hasAttachments,
    collectUploaded,
  } = useAttachment(teamId, { onValidationError });

  const canAttach = !!teamId && !sending;
  const canSend =
    !sending &&
    !hasUploading &&
    wsState === "open" &&
    (!!draft.trim() || uploadedCount > 0);

  // Sync menuRef whenever menu state changes (accessible inside WS closures)
  useEffect(() => {
    menuRef.current = menu;
  }, [menu]);

  useEffect(() => {
    let cleanupObserver: (() => void) | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let pingSentAt = 0;

    async function init() {
      const { Terminal: XTerm } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      // CSS loaded via global stylesheet

      if (!containerRef.current) return;

      // Liquid Glass xterm theme — Apple dark Sonoma
      const term = new XTerm({
        theme: {
          background: "#0a0e17", // var(--bg-deep)
          foreground: "rgba(255,255,255,0.92)", // var(--text-primary)
          cursor: "#5ac8fa", // var(--accent)
          cursorAccent: "#0a0e17",
          selectionBackground: "rgba(90,200,250,0.25)",
          black: "#0a0e17",
          brightBlack: "#1a2230",
          // ANSI cyan/green/etc — paleta Apple dark
          cyan: "#5ac8fa",
          brightCyan: "#7dd9fc",
          green: "#22c55e",
          brightGreen: "#4ade80",
          red: "#ef4444",
          brightRed: "#f87171",
          yellow: "#eab308",
          brightYellow: "#facc15",
          blue: "#5ac8fa",
          brightBlue: "#7dd9fc",
          magenta: "#a78bfa",
          brightMagenta: "#c4b5fd",
          white: "rgba(255,255,255,0.85)",
          brightWhite: "rgba(255,255,255,0.95)",
        },
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 12,
        lineHeight: 1.5,
        cursorBlink: true,
        disableStdin: true,
        scrollback: 10000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();
      termRef.current = term;

      const observer = new ResizeObserver(() => fitAddon.fit());
      observer.observe(containerRef.current);
      cleanupObserver = () => observer.disconnect();

      // WebSocket — token via query param (browser não suporta headers em WS)
      let token = "";
      try {
        token = await getAuthToken();
      } catch {
        /* sem token */
      }
      const WS_URL = getWsBase();
      const wsUrl = token
        ? `${WS_URL}/ws?token=${encodeURIComponent(token)}`
        : `${WS_URL}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setWsState("connecting");

      ws.onopen = () => {
        console.log("[TerminalWS] WS OPEN — sessão:", session);
        setWsState("open");
        ws.send(JSON.stringify({ type: "subscribe", session }));
        term.writeln(`\x1b[36m[i9-team] Conectado — sessão: ${session}\x1b[0m`);
        // Latência: ping a cada 10s — backend pode não responder, mas
        // medimos ack do subscribe (primeira mensagem) como proxy inicial
        pingSentAt = Date.now();
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            pingSentAt = Date.now();
            try {
              ws.send(JSON.stringify({ type: "ping" }));
            } catch {
              /* socket pode ter fechado entre o check e o send */
            }
          }
        }, 10_000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            data?: string;
            options?: MenuOption[];
            menuType?: string;
            currentIndex?: number;
            hasMenu?: boolean;
          };
          // Latência aproximada: qualquer ack após ping
          if (msg.type === "pong" || msg.type === "subscribed") {
            const delta = Date.now() - pingSentAt;
            if (delta > 0 && delta < 60_000) setLatencyMs(delta);
          }
          switch (msg.type) {
            case "output":
              lastOutputAtRef.current = Date.now();
              if (msg.hasMenu) {
                noMenuCountRef.current = 0;
                // Não re-renderiza enquanto há menu — evita conflito visual
              } else {
                noMenuCountRef.current++;
                if (msg.data) {
                  const normalized = msg.data.replace(/\r?\n/g, "\r\n");
                  term.write("\x1b[2J\x1b[H" + normalized);
                }
                if (noMenuCountRef.current >= 2) {
                  setMenu(null);
                  onMenuChange?.(session, null);
                }
              }
              break;
            case "interactive_menu":
              noMenuCountRef.current = 0;
              if (msg.options?.length) {
                const m = {
                  options: msg.options,
                  currentIndex: msg.currentIndex ?? 1,
                };
                setMenu(m);
                onMenuChange?.(session, m);
              }
              break;
          }
        } catch {
          term.write(event.data as string);
        }
      };

      ws.onclose = () => {
        console.log("[TerminalWS] WS CLOSED — sessão:", session);
        setWsState("closed");
        term.writeln("\x1b[33m[i9-team] Conexão encerrada\x1b[0m");
      };

      ws.onerror = () => {
        setWsState("closed");
        term.writeln("\x1b[31m[i9-team] Erro de conexão WebSocket\x1b[0m");
      };
    }

    void init();

    return () => {
      if (pingTimer) clearInterval(pingTimer);
      cleanupObserver?.();
      wsRef.current?.close();
      termRef.current?.dispose();
    };
  }, [session, onMenuChange]);

  function sendInputViaWS(text: string) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !text.trim()) return;
    ws.send(JSON.stringify({ type: "input", keys: text }));
  }

  function selectOption(index: number) {
    const ws = wsRef.current;
    const state = ws?.readyState;
    const stateLabel = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][state ?? 3];
    console.log("[TerminalWS] selectOption clicked", {
      index,
      session,
      state: stateLabel,
      wsExists: !!ws,
    });
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(
        "[TerminalWS] WS não está OPEN — descartando select_option. State:",
        stateLabel
      );
      return;
    }
    const payload = JSON.stringify({
      type: "select_option",
      session,
      value: String(index),
      currentIndex: menuRef.current?.currentIndex ?? 1,
    });
    console.log("[TerminalWS] enviando →", payload);
    ws.send(payload);
    setMenu(null);
    onMenuChange?.(session, null);
  }

  // ── Send handler (usa onSendMessage REST se disponível) ──────────────
  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const msg = draft;
    const { attachmentIds, eventAttachments } = collectUploaded();

    setSending(true);
    setDraft("");

    try {
      if (onSendMessage) {
        await onSendMessage(
          msg,
          attachmentIds.length > 0
            ? { attachmentIds, attachments: eventAttachments }
            : undefined
        );
      } else {
        // Fallback: input cru via WS (sem suporte a anexos nesse caminho)
        sendInputViaWS(msg);
      }
      clearAttachments();
    } catch (err) {
      console.error("[TerminalWS] falha ao enviar mensagem", { session, err });
      // Restaura o draft pra usuário tentar novamente
      setDraft(msg);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [
    canSend,
    draft,
    collectUploaded,
    onSendMessage,
    clearAttachments,
    session,
  ]);

  // ── Attachments handlers ────────────────────────────────────────────
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!canAttach) return;
    const files = extractFilesFromClipboard(e.clipboardData);
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const onFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) addFiles(files);
    e.target.value = "";
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    // Enter envia; Shift+Enter quebra linha
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // ── Status bar derived values ───────────────────────────────────────
  const wsDot = wsState === "open" ? "🟢" : wsState === "connecting" ? "🟡" : "🔴";
  const wsLabel = wsState.toUpperCase();
  const latencyLabel =
    latencyMs == null
      ? "—"
      : latencyMs < 1000
        ? `${latencyMs}ms`
        : `${(latencyMs / 1000).toFixed(1)}s`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: height ? undefined : 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Terminal + overlay wrapper */}
      <div
        style={{
          position: "relative",
          flex: height ? undefined : 1,
          height: height ?? undefined,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div
          ref={containerRef}
          style={{
            height: "100%",
            backgroundColor: "var(--bg-deep)",
            borderRadius: showInput
              ? "var(--radius-md) var(--radius-md) 0 0"
              : "var(--radius-md)",
            overflow: "hidden",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderBottom: showInput
              ? "none"
              : "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
            position: "relative",
            zIndex: 0,
          }}
        />

      </div>

      {/* Modal Liquid Glass de menu interativo (Task 16). Renderizado via Portal,
          fora do flow do terminal — backdrop cobre tudo e desfoca a UI atrás. */}
      <MenuDialog
        open={!!menu}
        options={menu?.options ?? []}
        currentIndex={menu?.currentIndex ?? 1}
        onSelect={(idx) => selectOption(idx)}
        onClose={() => {
          setMenu(null);
          onMenuChange?.(session, null);
        }}
      />

      {showInput && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "rgba(20, 22, 28, 0.55)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderTop: "none",
            borderRadius: "0 0 var(--radius-md) var(--radius-md)",
            flexShrink: 0,
          }}
        >
          {/* Faixa de anexos */}
          {hasAttachments && (
            <div
              role="list"
              aria-label="Anexos pendentes"
              style={{
                display: "flex",
                gap: 8,
                padding: "8px 12px 0",
                overflowX: "auto",
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(90, 200, 250, 0.2) transparent",
              }}
            >
              {attachments.map((a) => (
                <AttachmentChip
                  key={a.id}
                  attachment={a}
                  onRemove={removeAttachment}
                  disabled={sending}
                />
              ))}
              {attachments.length < MAX_ATTACHMENTS && (
                <span
                  aria-hidden="true"
                  style={{
                    alignSelf: "center",
                    fontSize: 10,
                    color: "var(--text-muted)",
                    fontFamily: "monospace",
                    padding: "0 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {attachments.length}/{MAX_ATTACHMENTS}
                </span>
              )}
            </div>
          )}

          {/* Input bar (textarea + clip + send) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            style={{
              display: "flex",
              gap: 8,
              padding: "8px 12px",
              alignItems: "flex-end",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: "var(--accent)",
                opacity: 0.7,
                fontFamily: "monospace",
                fontSize: 13,
                lineHeight: "32px",
                flexShrink: 0,
              }}
            >
              ❯
            </span>

            <TextareaAutosize
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={sending}
              placeholder={
                sending ? "enviando..." : "Enviar mensagem ao agente..."
              }
              aria-label="Mensagem para o agente"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              minRows={1}
              maxRows={8}
              title="Enter: enviar · Shift+Enter: nova linha · Ctrl+V: colar imagem"
              style={{
                flex: 1,
                resize: "none",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: 13,
                lineHeight: "1.4",
                caretColor: "var(--accent)",
                padding: "6px 0",
                minWidth: 0,
              }}
            />

            {/* File input invisível */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_MIMES.join(",")}
              multiple
              hidden
              onChange={onFilePick}
            />

            {/* Botão attach 📎 */}
            <button
              type="button"
              onClick={openFilePicker}
              disabled={!canAttach}
              aria-label="Anexar imagem"
              title="Anexar imagem (PNG, JPEG, WebP, GIF)"
              style={{
                width: 32,
                height: 32,
                padding: 0,
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(255, 255, 255, 0.02)",
                color: canAttach
                  ? "var(--accent)"
                  : "var(--text-disabled)",
                cursor: canAttach ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                alignSelf: "flex-end",
                marginBottom: 2,
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!canAttach) return;
                e.currentTarget.style.background = "var(--accent-soft)";
                e.currentTarget.style.borderColor =
                  "rgba(90, 200, 250, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                e.currentTarget.style.borderColor =
                  "rgba(255, 255, 255, 0.08)";
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.49" />
              </svg>
            </button>

            {/* Botão Send */}
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Enviar mensagem"
              title={
                hasUploading
                  ? "Aguardando uploads…"
                  : wsState !== "open"
                    ? "WebSocket desconectado"
                    : "Enviar (Enter)"
              }
              style={{
                padding: "6px 16px",
                borderRadius: "var(--radius-sm)",
                border: canSend
                  ? "1px solid rgba(90, 200, 250, 0.45)"
                  : "1px solid rgba(255, 255, 255, 0.06)",
                background: sending
                  ? "var(--accent-soft)"
                  : canSend
                    ? "var(--accent-soft)"
                    : "rgba(255, 255, 255, 0.02)",
                color: canSend ? "var(--accent)" : "var(--text-disabled)",
                fontSize: 12,
                fontWeight: 700,
                cursor: canSend ? "pointer" : "not-allowed",
                fontFamily: "monospace",
                letterSpacing: "0.05em",
                flexShrink: 0,
                alignSelf: "flex-end",
                marginBottom: 2,
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              {sending ? "..." : "Send"}
            </button>
          </form>

          {/* Status bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "4px 12px 6px",
              fontSize: 10,
              fontFamily: '"JetBrains Mono", monospace',
              color: "var(--text-tertiary)",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              flexWrap: "wrap",
              background: "rgba(255, 255, 255, 0.015)",
            }}
          >
            <span
              title={`WebSocket ${wsLabel}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span aria-hidden="true">{wsDot}</span>
              <span>{wsLabel}</span>
            </span>
            <span aria-hidden="true" style={{ opacity: 0.4 }}>
              ·
            </span>
            <span title="Latência do último ack">⟂ {latencyLabel}</span>
            <span aria-hidden="true" style={{ opacity: 0.4 }}>
              ·
            </span>
            <span
              title={`Sessão tmux: ${session}`}
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "60%",
              }}
            >
              {session}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
