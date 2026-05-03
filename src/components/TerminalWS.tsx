"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { getAuthToken, uploadScreenshot } from "@/lib/api";
import { getWsBase } from "@/lib/runtime-config";

interface MenuOption {
  index: number;
  label: string;
}

export interface InteractiveMenu {
  options: MenuOption[];
  currentIndex: number;
}

interface TerminalProps {
  session: string;
  height?: number;
  showInput?: boolean;
  initialMenu?: InteractiveMenu | null;
  onMenuChange?: (session: string, menu: InteractiveMenu | null) => void;
  /** Se fornecido, enviar mensagens pelo bridge em vez do WS direto */
  onSendMessage?: (msg: string, opts?: { attachmentIds?: string[] }) => void | Promise<void>;
}

interface Attachment {
  id: string;
  dataUrl: string;
  comment: string;
  /** Path no servidor após upload — preenchido antes do envio */
  serverPath?: string;
}

function AttachmentPreview({ att, onRemove, onCommentChange }: {
  att: Attachment;
  onRemove: (id: string) => void;
  onCommentChange: (id: string, comment: string) => void;
}) {
  return (
    <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <div style={{ position: "relative" }}>
        <img
          src={att.dataUrl}
          alt="attachment"
          style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 6, display: "block", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
        />
        <button
          type="button"
          onClick={() => onRemove(att.id)}
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: 16,
            height: 16,
            fontSize: 10,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>
      <input
        type="text"
        placeholder="Comentário..."
        value={att.comment}
        onChange={(e) => onCommentChange(att.id, e.target.value)}
        style={{
          fontSize: 11,
          background: "transparent",
          border: "none",
          borderBottom: "1px solid rgba(255,255,255,0.15)",
          color: "var(--text-secondary, rgba(255,255,255,0.5))",
          width: 80,
          outline: "none",
          padding: "1px 0",
        }}
      />
    </div>
  );
}

export function Terminal({ session, height, showInput = false, initialMenu = null, onMenuChange, onSendMessage }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<InteractiveMenu | null>(initialMenu);
  const menuRef = useRef<InteractiveMenu | null>(null);
  const noMenuCountRef = useRef(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Sync menuRef whenever menu state changes (accessible inside WS closures)
  useEffect(() => { menuRef.current = menu; }, [menu]);

  useEffect(() => {
    let cleanupObserver: (() => void) | undefined;

    async function init() {
      const { Terminal: XTerm } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      // CSS loaded via global stylesheet

      if (!containerRef.current) return;

      const term = new XTerm({
        theme: {
          background: "#0a0a0a",
          foreground: "#00ff88",
          cursor: "#00d4ff",
          cursorAccent: "#0a0a0a",
          selectionBackground: "#1a2a1a",
          black: "#0a0a0a",
          brightBlack: "#1a2a1a",
          cyan: "#00d4ff",
          brightCyan: "#00eeff",
          green: "#00ff88",
          brightGreen: "#39ff99",
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

      const sendResize = () => {
        fitAddon.fit();
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      };
      const observer = new ResizeObserver(sendResize);
      observer.observe(containerRef.current);
      if (scrollWrapperRef.current) observer.observe(scrollWrapperRef.current);
      cleanupObserver = () => observer.disconnect();

      // Rastrear posição de scroll do xterm para mostrar botão flutuante
      term.onScroll(() => {
        const buf = term.buffer.active;
        const atBottom = buf.viewportY >= buf.length - term.rows;
        setShowScrollBtn(!atBottom);
      });

      // WebSocket — token via query param (browser não suporta headers em WS)
      let token = "";
      try { token = await getAuthToken(); } catch { /* sem token */ }
      const WS_URL = getWsBase();
      const wsUrl = token ? `${WS_URL}/ws?token=${encodeURIComponent(token)}` : `${WS_URL}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[TerminalWS] WS OPEN — sessão:", session);
        ws.send(JSON.stringify({ type: "subscribe", session }));
        setTimeout(() => {
          fitAddon.fit();
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }, 100);
        term.writeln(`\x1b[36m[i9-team] Conectado — sessão: ${session}\x1b[0m`);
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
          switch (msg.type) {
            case "output":
              if (msg.hasMenu) {
                noMenuCountRef.current = 0;
                // Não re-renderiza enquanto há menu — evita conflito visual
              } else {
                noMenuCountRef.current++;
                if (msg.data) {
                  const normalized = msg.data.replace(/\r?\n/g, "\r\n");
                  term.write("\x1b[2J\x1b[H" + normalized);
                }
                if (noMenuCountRef.current >= 2) { setMenu(null); onMenuChange?.(session, null); }
              }
              break;
            case "interactive_menu":
              noMenuCountRef.current = 0;
              if (msg.options?.length) {
                const m = { options: msg.options, currentIndex: msg.currentIndex ?? 1 };
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
        term.writeln("\x1b[33m[i9-team] Conexão encerrada\x1b[0m");
      };

      ws.onerror = () => {
        term.writeln("\x1b[31m[i9-team] Erro de conexão WebSocket\x1b[0m");
      };
    }

    void init();

    return () => {
      cleanupObserver?.();
      wsRef.current?.close();
      termRef.current?.dispose();
    };
  }, [session]);

  const scrollToBottom = useCallback(() => {
    termRef.current?.scrollToBottom();
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImageFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAttachments(prev => [...prev, { id: Date.now().toString(), dataUrl, comment: "" }]);
      // Refoca textarea para permitir nova colagem imediatamente
      setTimeout(() => textareaRef.current?.focus(), 50);
    };
    reader.readAsDataURL(file);
  }, []);

  const inputAreaRef = useRef<HTMLFormElement>(null);

  // Paste global — só processa se o foco estiver dentro deste terminal
  useEffect(() => {
    if (!showInput) return;
    const onDocPaste = (e: ClipboardEvent) => {
      // Ignorar se o foco não está dentro desta área de input
      if (!inputAreaRef.current?.contains(document.activeElement)) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItems = items.filter(i => i.type.startsWith("image/"));
      if (imageItems.length === 0) return;
      e.preventDefault();
      imageItems.forEach(item => {
        const file = item.getAsFile();
        if (file) addImageFile(file);
      });
    };
    document.addEventListener("paste", onDocPaste);
    return () => document.removeEventListener("paste", onDocPaste);
  }, [showInput, addImageFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const hasImage = items.some(i => i.type.startsWith("image/"));
    // Imagens já tratadas pelo listener global — só previne default aqui
    if (hasImage) e.preventDefault();
  }, []);

  const buildMessage = useCallback((text: string, atts: Attachment[]) => {
    let msg = text.trim();
    if (atts.length > 0) {
      atts.forEach((att, i) => {
        const path = att.serverPath ?? `screenshot-${att.id}.png`;
        msg += `\n\n[Imagem ${i + 1}: ${path}]`;
        if (att.comment.trim()) msg += `\nComentário: ${att.comment.trim()}`;
      });
    }
    return msg;
  }, []);

  async function sendInputWithAttachments(text: string, atts: Attachment[]) {
    // Fazer upload das imagens que ainda não têm serverPath
    const uploaded = await Promise.all(
      atts.map(async (att) => {
        if (att.serverPath) return att;
        try {
          const { path } = await uploadScreenshot(att.dataUrl);
          console.log('[upload] OK:', path);
          return { ...att, serverPath: path };
        } catch (err) {
          console.error('[upload] ERRO:', err);
          return att;
        }
      })
    );
    const msg = buildMessage(text, uploaded);
    if (!msg.trim()) return;
    if (onSendMessage) {
      try { await onSendMessage(msg); } catch { /* ignore */ }
      return;
    }
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "input", keys: msg }));
  }

  function selectOption(index: number) {
    const ws = wsRef.current;
    const state = ws?.readyState;
    const stateLabel = ["CONNECTING","OPEN","CLOSING","CLOSED"][state ?? 3];
    console.log("[TerminalWS] selectOption clicked", { index, session, state: stateLabel, wsExists: !!ws });
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[TerminalWS] WS não está OPEN — descartando select_option. State:", stateLabel);
      return;
    }
    const payload = JSON.stringify({ type: "select_option", session, value: String(index), currentIndex: menuRef.current?.currentIndex ?? 1 });
    console.log("[TerminalWS] enviando →", payload);
    ws.send(payload);
    setMenu(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: height ? undefined : 1, minHeight: 0, height: height ? undefined : 0, overflow: "hidden" }}>
      {/* Terminal + overlay wrapper */}
      <div
        ref={scrollWrapperRef}
        onWheel={(e) => {
          e.stopPropagation();
          const lines = Math.round(e.deltaY / 20);
          termRef.current?.scrollLines(lines);
        }}
        style={{ position: "relative", flex: height ? undefined : 1, height: height ?? undefined, minHeight: 0, overflow: "hidden" }}
      >
        {/* Melhoria 5 — pointer-events none no container do xterm: view-only */}
        <div
          ref={containerRef}
          style={{
            height: "100%",
            backgroundColor: "#0a0a0a",
            borderRadius: showInput ? "8px 8px 0 0" : 8,
            overflow: "hidden",
            border: "1px solid rgba(0, 255, 136, 0.2)",
            borderBottom: showInput ? "none" : "1px solid rgba(0, 255, 136, 0.2)",
            boxShadow: "0 0 20px rgba(0, 255, 136, 0.05)",
            position: "relative",
            zIndex: 0,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        {/* Melhoria 1 — botão flutuante "ir ao fim" */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            title="Ir ao fim"
            style={{
              position: "absolute",
              bottom: 40,
              right: 12,
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "50%",
              cursor: "pointer",
              color: "rgba(255,255,255,0.7)",
              zIndex: 10000,
              pointerEvents: "auto",
            }}
          >
            <ChevronDown size={14} strokeWidth={1.2} />
          </button>
        )}

        {/* Overlay de menu interativo — zIndex alto para ficar sobre canvas do xterm */}
        {menu && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              right: 16,
              zIndex: 9999,
              pointerEvents: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              background: "rgba(0, 0, 0, 0.85)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(0, 212, 255, 0.3)",
              borderRadius: 10,
              padding: "12px 12px 8px",
              boxShadow: "0 0 32px rgba(0, 212, 255, 0.1)",
            }}
          >
            <p style={{
              fontSize: 11,
              color: "#00d4ff",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 6,
            }}>
              Selecione uma opção:
            </p>
            {menu.options.map((opt) => (
              <button
                key={opt.index}
                onClick={() => selectOption(opt.index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid transparent",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "#e2e8f0",
                  fontSize: 13,
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  transition: "background 0.12s, border-color 0.12s",
                  pointerEvents: "auto",
                  position: "relative",
                  zIndex: 9999,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(0, 212, 255, 0.12)";
                  e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <span style={{
                  color: "#00d4ff",
                  fontWeight: 700,
                  minWidth: 20,
                  fontFamily: "monospace",
                }}>
                  {opt.index}.
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {showInput && (
        <form
          ref={inputAreaRef}
          onSubmit={(e) => {
            e.preventDefault();
            const val = textareaRef.current?.value ?? "";
            if (!val.trim() && attachments.length === 0) return;
            const atts = attachments;
            setAttachments([]);
            if (textareaRef.current) {
              textareaRef.current.value = "";
              textareaRef.current.style.height = "auto";
            }
            void sendInputWithAttachments(val, atts);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            background: "#0a0a0a",
            border: "1px solid rgba(0, 255, 136, 0.2)",
            borderRadius: "0 0 8px 8px",
            flexShrink: 0,
          }}
        >
          {/* Área de miniaturas */}
          {attachments.length > 0 && (
            <div style={{ display: "flex", gap: 8, padding: "8px 12px 0", flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {attachments.map(att => (
                <AttachmentPreview
                  key={att.id}
                  att={att}
                  onRemove={(id) => setAttachments(prev => prev.filter(a => a.id !== id))}
                  onCommentChange={(id, comment) => setAttachments(prev => prev.map(a => a.id === id ? { ...a, comment } : a))}
                />
              ))}
            </div>
          )}

          {/* File input oculto para adicionar imagens */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              Array.from(e.target.files ?? []).forEach(addImageFile);
              e.target.value = "";
              setTimeout(() => textareaRef.current?.focus(), 50);
            }}
          />

          {/* Input row */}
          <div style={{ display: "flex", gap: 8, padding: "8px 12px", alignItems: "flex-end" }}>
            {/* Botão adicionar imagem */}
            <button
              type="button"
              title="Adicionar imagem"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "1px solid rgba(0,255,136,0.2)",
                borderRadius: 5,
                color: "rgba(0,255,136,0.4)",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
                flexShrink: 0,
                paddingBottom: 1,
              }}
            >
              +
            </button>
            <span style={{ color: "rgba(0,255,136,0.5)", fontFamily: "monospace", fontSize: 13, lineHeight: "24px", paddingBottom: 2 }}>
              ❯
            </span>
            {/* Melhoria 6 — textarea auto-expansível */}
            {/* Melhoria 7 — Cmd+Enter ou Ctrl+Enter envia; Enter puro = nova linha */}
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Enviar mensagem ao agente... (Cmd+Enter para enviar)"
              autoComplete="off"
              spellCheck={false}
              onPaste={handlePaste}
              onChange={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 132) + "px";
                if (e.target.scrollHeight > 132) {
                  e.target.style.overflowY = "auto";
                } else {
                  e.target.style.overflowY = "hidden";
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  const val = textareaRef.current?.value ?? "";
                  if (!val.trim() && attachments.length === 0) return;
                  const atts = attachments;
                  setAttachments([]);
                  if (textareaRef.current) {
                    textareaRef.current.value = "";
                    textareaRef.current.style.height = "auto";
                  }
                  void sendInputWithAttachments(val, atts);
                }
              }}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#00ff88",
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: 13,
                caretColor: "#00d4ff",
                resize: "none",
                overflowY: "hidden",
                lineHeight: "1.5",
                maxHeight: 132,
                paddingTop: 2,
                paddingBottom: 2,
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
                flexShrink: 0,
              }}
            >
              Enter
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
