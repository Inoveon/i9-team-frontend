"use client";

import { useState } from "react";

interface ToolCallCollapsibleProps {
  name: string;
  args?: string;
  result?: string;
}

export function ToolCallCollapsible({ name, args, result }: ToolCallCollapsibleProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        margin: "4px 0",
        borderRadius: 8,
        border: "1px solid rgba(0,212,255,0.15)",
        overflow: "hidden",
        background: "rgba(0,0,0,0.2)",
        fontSize: 12,
        maxWidth: "90%",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "6px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#00d4ff",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 12,
          textAlign: "left",
        }}
      >
        <span style={{ opacity: 0.7 }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontWeight: 600 }}>{name}</span>
        {result && (
          <span style={{ marginLeft: "auto", color: "rgba(0,255,136,0.5)", fontSize: 10 }}>
            ✓
          </span>
        )}
      </button>

      {open && (
        <div style={{ borderTop: "1px solid rgba(0,212,255,0.1)" }}>
          {args && (
            <div style={{ padding: "8px 12px" }}>
              <div style={{ color: "rgba(0,212,255,0.5)", fontSize: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Args
              </div>
              <pre style={{
                margin: 0,
                color: "#a0aec0",
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}>
                {args}
              </pre>
            </div>
          )}
          {result && (
            <div style={{ padding: "8px 12px", borderTop: args ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
              <div style={{ color: "rgba(0,255,136,0.5)", fontSize: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Result
              </div>
              <pre style={{
                margin: 0,
                color: "#718096",
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxHeight: 200,
                overflowY: "auto",
              }}>
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
