"use client";

import { useEffect, useRef } from "react";

interface TerminalProps {
  lines: string[];
  /**
   * Altura fixa em px. Se omitido → modo **flex** (ocupa o espaço do container
   * pai que deve ser `display:flex flexDirection:column`).
   */
  height?: number;
}

export function Terminal({ lines, height }: TerminalProps) {
  const isFlex = height === undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);

  useEffect(() => {
    let term: import("@xterm/xterm").Terminal;
    let fitAddon: import("@xterm/addon-fit").FitAddon;

    async function init() {
      const { Terminal: XTerm } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      // CSS loaded via global stylesheet (globals.css imports xterm styles)

      if (!containerRef.current) return;

      term = new XTerm({
        theme: {
          background: "#080b14",
          foreground: "#00d4ff",
          cursor: "#00d4ff",
          selectionBackground: "#1e2a3a",
          black: "#080b14",
          brightBlack: "#1e2a3a",
        },
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 12,
        lineHeight: 1.5,
        cursorBlink: false,
        disableStdin: true,
        scrollback: 5000,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();

      termRef.current = term;
      fitRef.current = fitAddon;

      for (const line of lines) {
        term.writeln(line);
      }
    }

    void init();

    const observer = new ResizeObserver(() => {
      fitRef.current?.fit();
    });
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      termRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term || lines.length === 0) return;
    const last = lines[lines.length - 1];
    if (last) term.writeln(last);
  }, [lines]);

  return (
    <div
      ref={containerRef}
      style={{
        height: isFlex ? undefined : height,
        flex: isFlex ? 1 : undefined,
        minHeight: 0,
        backgroundColor: "#080b14",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    />
  );
}
