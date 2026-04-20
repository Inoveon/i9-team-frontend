"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { NoteFull } from "@/hooks/useNotes";

interface NoteViewerProps {
  note: NoteFull;
  onEdit: () => void;
  onDelete: () => void;
}

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NoteViewer({ note, onEdit, onDelete }: NoteViewerProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingBottom: 12,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 18 }}>📄</span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                fontFamily: '"JetBrains Mono", monospace',
                color: "var(--neon-blue)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {note.name}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              atualizado em {formatAbsolute(note.updatedAt)} · {note.size} bytes
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={onDelete}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid rgba(255,56,100,0.25)",
              background: "transparent",
              color: "rgba(255,56,100,0.7)",
              fontSize: 11,
              fontFamily: '"JetBrains Mono", monospace',
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,56,100,0.08)";
              e.currentTarget.style.color = "var(--neon-red)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(255,56,100,0.7)";
            }}
          >
            Deletar
          </button>
          <button
            onClick={onEdit}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid rgba(0,212,255,0.4)",
              background: "rgba(0,212,255,0.06)",
              color: "var(--neon-blue)",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: '"JetBrains Mono", monospace',
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 0 14px rgba(0,212,255,0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Editar
          </button>
        </div>
      </div>

      {/* Conteúdo markdown */}
      <div
        className="notes-markdown"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 4px 24px 4px",
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--text)",
          minHeight: 0,
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {note.content || "_(nota vazia)_"}
        </ReactMarkdown>
      </div>
    </div>
  );
}
