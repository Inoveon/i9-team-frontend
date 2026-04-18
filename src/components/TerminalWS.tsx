"use client";

import { useEffect, useRef } from "react";
import { getAuthToken } from "@/lib/api";

interface TerminalProps {
  /** tmux session name to subscribe via WebSocket */
  session: string;
  /** Altura fixa em px. Se omitido, expande com flex para preencher o pai */
  height?: number;
  /** Mostrar campo de input para envio de mensagens */
  showInput?: boolean;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4020";

export function Terminal({ session, height, showInput = false }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        ws.send(JSON.stringify({ type: "subscribe", session }));
        term.writeln(`\x1b[36m[i9-team] Conectado — sessão: ${session}\x1b[0m`);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            data?: string;
          };
          if (msg.type === "output" && msg.data) {
            // \x1b[H = cursor home sem limpar — sobrescreve no lugar, sem flash
            const normalized = msg.data.replace(/\r?\n/g, "\r\n");
            term.write("\x1b[H" + normalized);
          }
        } catch {
          term.write(event.data as string);
        }
      };

      ws.onclose = () => {
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

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: height ? undefined : 1, minHeight: 0 }}>
      <div
        ref={containerRef}
        style={{
          flex: height ? undefined : 1,
          height: height ?? undefined,
          minHeight: 0,
          backgroundColor: "#0a0a0a",
          borderRadius: showInput ? "8px 8px 0 0" : 8,
          overflow: "hidden",
          border: "1px solid rgba(0, 255, 136, 0.2)",
          borderBottom: showInput ? "none" : "1px solid rgba(0, 255, 136, 0.2)",
          boxShadow: "0 0 20px rgba(0, 255, 136, 0.05)",
        }}
      />

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
