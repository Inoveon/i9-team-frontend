"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ClaudeBubbleProps {
  text: string;
}

export function ClaudeBubble({ text }: ClaudeBubbleProps) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 8 }}>
      <div
        style={{
          maxWidth: "90%",
          padding: "10px 14px",
          borderRadius: "4px 16px 16px 16px",
          background: "rgba(13,17,23,0.8)",
          border: "1px solid rgba(0,255,136,0.12)",
          color: "#e2e8f0",
          fontSize: 13,
          lineHeight: 1.65,
          fontFamily: "system-ui, sans-serif",
          wordBreak: "break-word",
          boxShadow: "0 0 12px rgba(0,255,136,0.04)",
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ children, className }) {
              const isBlock = className?.includes("language-");
              if (isBlock) {
                return (
                  <pre style={{
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(0,212,255,0.15)",
                    borderRadius: 6,
                    padding: "10px 14px",
                    overflowX: "auto",
                    fontSize: 12,
                    lineHeight: 1.5,
                    margin: "8px 0",
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    color: "#00ff88",
                  }}>
                    <code>{children}</code>
                  </pre>
                );
              }
              return (
                <code style={{
                  background: "rgba(0,212,255,0.08)",
                  border: "1px solid rgba(0,212,255,0.15)",
                  borderRadius: 4,
                  padding: "1px 5px",
                  fontSize: 12,
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  color: "#00d4ff",
                }}>
                  {children}
                </code>
              );
            },
            p({ children }) {
              return <p style={{ margin: "4px 0" }}>{children}</p>;
            },
            ul({ children }) {
              return <ul style={{ paddingLeft: 20, margin: "4px 0" }}>{children}</ul>;
            },
            ol({ children }) {
              return <ol style={{ paddingLeft: 20, margin: "4px 0" }}>{children}</ol>;
            },
            li({ children }) {
              return <li style={{ marginBottom: 2 }}>{children}</li>;
            },
            table({ children }) {
              return (
                <div style={{ overflowX: "auto", margin: "8px 0" }}>
                  <table style={{
                    borderCollapse: "collapse",
                    fontSize: 12,
                    width: "100%",
                  }}>
                    {children}
                  </table>
                </div>
              );
            },
            th({ children }) {
              return (
                <th style={{
                  border: "1px solid rgba(0,212,255,0.2)",
                  padding: "4px 10px",
                  background: "rgba(0,212,255,0.06)",
                  color: "#00d4ff",
                  fontWeight: 600,
                  textAlign: "left",
                }}>
                  {children}
                </th>
              );
            },
            td({ children }) {
              return (
                <td style={{
                  border: "1px solid rgba(255,255,255,0.07)",
                  padding: "4px 10px",
                }}>
                  {children}
                </td>
              );
            },
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    </div>
  );
}
