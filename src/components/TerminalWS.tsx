"use client";

import { useEffect, useRef, useState } from "react";
import { getAuthToken } from "@/lib/api";

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
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4020";

export function Terminal({ session, height, showInput = false, initialMenu = null, onMenuChange }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<InteractiveMenu | null>(initialMenu);
  const menuRef = useRef<InteractiveMenu | null>(null);
  const noMenuCountRef = useRef(0);

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

      const observer = new ResizeObserver(() => fitAddon.fit());
      observer.observe(containerRef.current);
      cleanupObserver = () => observer.disconnect();

      // WebSocket — token via query param (browser não suporta headers em WS)
      let token = "";
      try { token = await getAuthToken(); } catch { /* sem token */ }
      const wsUrl = token ? `${WS_URL}/ws?token=${encodeURIComponent(token)}` : `${WS_URL}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[TerminalWS] WS OPEN — sessão:", session);
        ws.send(JSON.stringify({ type: "subscribe", session }));
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

  function sendInput(text: string) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !text.trim()) return;
    ws.send(JSON.stringify({ type: "input", keys: text }));
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
    <div style={{ display: "flex", flexDirection: "column", flex: height ? undefined : 1, minHeight: 0, overflow: "hidden" }}>
      {/* Terminal + overlay wrapper */}
      <div style={{ position: "relative", flex: height ? undefined : 1, height: height ?? undefined, minHeight: 0, overflow: "hidden" }}>
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
            // xterm canvas fica neste container — overlay precisa ficar acima
            position: "relative",
            zIndex: 0,
          }}
        />

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
          onSubmit={(e) => {
            e.preventDefault();
            const val = inputRef.current?.value ?? "";
            if (!val.trim()) return;
            sendInput(val);
            if (inputRef.current) inputRef.current.value = "";
          }}
          style={{
            display: "flex",
            gap: 8,
            background: "#0a0a0a",
            border: "1px solid rgba(0, 255, 136, 0.2)",
            borderRadius: "0 0 8px 8px",
            padding: "8px 12px",
          }}
        >
          <span style={{ color: "rgba(0,255,136,0.5)", fontFamily: "monospace", fontSize: 13, lineHeight: "32px" }}>
            ❯
          </span>
          <input
            ref={inputRef}
            placeholder="Enviar mensagem ao agente..."
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#00ff88",
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
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
  );
}
