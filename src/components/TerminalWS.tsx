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
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Circle,
  CornerDownLeft,
  Keyboard,
  Paperclip,
  X as XIcon,
} from "lucide-react";
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

/**
 * Mapeia `KeyboardEvent` do browser pra notação `tmux send-keys`.
 *
 * Formato tmux:
 *   - Modificadores: `C-` (Ctrl), `M-` (Alt/Meta), `S-` (Shift) — combinam.
 *   - Keys nomeadas: Up, Down, Left, Right, Enter, Escape, Tab, BSpace,
 *     Delete, Home, End, PageUp, PageDown, Space.
 *   - Letras simples: lowercase ('a', 'b', 'A' vira 'a' com S-? não — tmux
 *     trata maiúscula como literal).
 *
 * Retorna `null` quando não dá pra mapear (Shift/Ctrl/Alt sozinhos, etc).
 */
// Alias pro KeyboardEvent nativo do DOM (`KeyboardEvent` de cima é o do React).
type DOMKeyboardEvent = globalThis.KeyboardEvent;

function mapEventToTmuxKey(e: DOMKeyboardEvent): string | null {
  const k = e.key;

  // Ignora modificadores sozinhos (apenas Shift, Ctrl, Alt, Meta apertados)
  if (
    k === "Shift" ||
    k === "Control" ||
    k === "Alt" ||
    k === "Meta"
  ) {
    return null;
  }

  let prefix = "";
  if (e.ctrlKey) prefix += "C-";
  if (e.metaKey) prefix += "C-"; // Cmd no mac → trata como Ctrl
  if (e.altKey) prefix += "M-";
  // Shift só é prefixado pra teclas nomeadas (não-letras)
  if (e.shiftKey && k.length > 1) prefix += "S-";

  const namedMap: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Enter: "Enter",
    Escape: "Escape",
    Tab: "Tab",
    Backspace: "BSpace",
    Delete: "Delete",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    " ": "Space",
  };

  if (namedMap[k]) return prefix + namedMap[k];

  // Letra/número/símbolo simples (1 caractere)
  if (k.length === 1) {
    if (prefix) return prefix + k.toLowerCase();
    return k; // sem mods: manda literal (preserva caso)
  }

  return null;
}

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

  // ── Scroll-to-bottom FAB (Issue #12) ────────────────────────────────
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollTerminalToBottom = useCallback(() => {
    termRef.current?.scrollToBottom();
    setShowScrollBottom(false);
  }, []);

  // ── Terminal Mode (Task `nav-buttons-terminal-mode`) ────────────────
  // Quando ativo, captura todas as teclas no xterm e envia ao tmux como
  // `key_event` via WS (em vez de processar localmente). Persiste por
  // sessão no localStorage.
  const tmKey = `portal-terminal-mode-${session}`;
  const [terminalMode, setTerminalMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(tmKey) === "true";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(tmKey, String(terminalMode));
  }, [terminalMode, tmKey]);

  // Envia tecla nomeada (Up/Down/Enter/Escape/etc) via key_event.
  // Backend traduz pra `tmux send-keys SESSION <key>`.
  const sendKeyEvent = useCallback((key: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[TerminalWS] sendKeyEvent: WS não OPEN", { key });
      return;
    }
    ws.send(JSON.stringify({ type: "key_event", key }));
  }, []);

  // Toggle stdin do xterm conforme Terminal Mode.
  // Quando ativo, instala custom key handler que intercepta keydown e manda
  // `key_event` via WS (em vez de deixar xterm processar localmente).
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    if (terminalMode) {
      // Permite stdin no xterm (default era disableStdin: true)
      try {
        term.options.disableStdin = false;
      } catch {
        /* algumas versões do xterm são read-only no options */
      }
      term.attachCustomKeyEventHandler((event) => {
        if (event.type !== "keydown") return false;
        const key = mapEventToTmuxKey(event);
        if (key) sendKeyEvent(key);
        return false; // xterm NÃO processa — já mandamos via WS
      });
      // Foco no xterm pra capturar teclas
      try {
        term.focus();
      } catch {
        /* noop */
      }
    } else {
      // Restaura comportamento padrão (xterm processa tudo)
      try {
        term.options.disableStdin = true;
      } catch {
        /* noop */
      }
      term.attachCustomKeyEventHandler(() => true);
    }
  }, [terminalMode, sendKeyEvent]);

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

      // Issue #12: detecta scroll-up e mostra FAB pra voltar ao fim.
      // Threshold 80px — distância do bottom pra considerar "lá em cima".
      const viewport = term.element?.querySelector(
        ".xterm-viewport"
      ) as HTMLDivElement | null;
      let scrollListener: (() => void) | undefined;
      if (viewport) {
        scrollListener = () => {
          const distance =
            viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
          setShowScrollBottom(distance > 80);
        };
        viewport.addEventListener("scroll", scrollListener, { passive: true });
        const prevCleanup = cleanupObserver;
        cleanupObserver = () => {
          prevCleanup?.();
          if (scrollListener) {
            viewport.removeEventListener("scroll", scrollListener);
          }
        };
      }

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
              // Abertura automática do MenuDialog DESABILITADA por decisão
              // de UX (2026-04-27). User prefere usar botões nav (← ↑ ↓ →
              // ⏎ ✕) e Terminal Mode pra interagir manualmente. Mantemos o
              // componente MenuDialog importado/montado pra reuso futuro
              // (caso queira restaurar ou abrir manualmente).
              noMenuCountRef.current = 0;
              if (msg.options?.length) {
                console.debug("[TerminalWS] interactive_menu detectado", {
                  session,
                  options: msg.options.length,
                  currentIndex: msg.currentIndex,
                });
                // setMenu(m); onMenuChange?.(session, m);  // ← intencionalmente desativado
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
      // requestAnimationFrame: aguarda o React re-renderizar e remover
      // `disabled={sending}` do textarea — focus() em elemento disabled é
      // ignorado pelos browsers e o cursor "perdia" o foco.
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
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

        {/* FAB scroll-to-bottom (Issue #12) — aparece quando user rola pra cima */}
        <AnimatePresence>
          {showScrollBottom && (
            <motion.button
              type="button"
              key="scroll-bottom-fab"
              className="terminal-fab"
              onClick={scrollTerminalToBottom}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{
                type: "spring",
                stiffness: 380,
                damping: 28,
              }}
              title="Rolar para o fim"
              aria-label="Rolar para o fim do terminal"
            >
              <ArrowDown size={16} aria-hidden="true" />
            </motion.button>
          )}
        </AnimatePresence>
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
            className={
              terminalMode ? "input-bar disabled-by-terminal-mode" : "input-bar"
            }
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
                display: "inline-flex",
                alignItems: "center",
                lineHeight: "32px",
                flexShrink: 0,
              }}
            >
              <ChevronRight size={14} strokeWidth={2.5} />
            </span>

            <TextareaAutosize
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={sending || terminalMode}
              placeholder={
                terminalMode
                  ? "Terminal Mode ativo — teclas vão direto pro tmux"
                  : sending
                    ? "enviando..."
                    : "Enviar mensagem ao agente..."
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

            {/* Botão attach (Paperclip) */}
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
            className="terminal-statusbar"
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
                gap: 5,
              }}
            >
              <Circle
                size={8}
                fill="currentColor"
                strokeWidth={0}
                className={`status-dot status-dot--${wsState}`}
                aria-hidden="true"
              />
              <span>{wsLabel}</span>
            </span>
            <span aria-hidden="true" style={{ opacity: 0.4 }}>
              ·
            </span>
            <span title="Latência do último ack">{latencyLabel}</span>
            <span aria-hidden="true" style={{ opacity: 0.4 }}>
              ·
            </span>
            <span
              title={`Sessão tmux: ${session}`}
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "40%",
              }}
            >
              {session}
            </span>

            {/* Navegação rápida (sempre visível) — 6 botões: ← ↑ ↓ → ⏎ ✕ */}
            <div className="terminal-nav">
              <button
                type="button"
                className="nav-btn"
                onClick={() => sendKeyEvent("Left")}
                title="Navegar para esquerda"
                aria-label="Navegar para esquerda"
              >
                <ArrowLeft size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="nav-btn"
                onClick={() => sendKeyEvent("Up")}
                title="Navegar para cima"
                aria-label="Navegar para cima"
              >
                <ArrowUp size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="nav-btn"
                onClick={() => sendKeyEvent("Down")}
                title="Navegar para baixo"
                aria-label="Navegar para baixo"
              >
                <ArrowDown size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="nav-btn"
                onClick={() => sendKeyEvent("Right")}
                title="Navegar para direita"
                aria-label="Navegar para direita"
              >
                <ArrowRight size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="nav-btn"
                onClick={() => sendKeyEvent("Enter")}
                title="Confirmar (Enter)"
                aria-label="Enviar Enter"
              >
                <CornerDownLeft size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="nav-btn"
                onClick={() => sendKeyEvent("Escape")}
                title="Cancelar (Esc)"
                aria-label="Enviar Escape"
              >
                <XIcon size={13} aria-hidden="true" />
              </button>
            </div>

            {/* Terminal Mode toggle */}
            <button
              type="button"
              className={
                "terminal-mode-btn" + (terminalMode ? " active" : "")
              }
              aria-pressed={terminalMode}
              onClick={() => setTerminalMode((m) => !m)}
              title={
                terminalMode
                  ? "Desativar Terminal Mode (volta pro input bar)"
                  : "Ativar Terminal Mode (captura todas as teclas e envia ao tmux)"
              }
            >
              <Keyboard size={13} aria-hidden="true" />
              Terminal Mode
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
