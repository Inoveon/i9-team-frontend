"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import type { NoteFull } from "@/hooks/useNotes";

interface NoteEditorProps {
  note: NoteFull;
  onSave: (content: string) => Promise<void> | void;
  onCancel: () => void;
  saving: boolean;
}

export function NoteEditor({ note, onSave, onCancel, saving }: NoteEditorProps) {
  const [content, setContent] = useState<string>(note.content);
  const initialRef = useRef(note.content);

  useEffect(() => {
    setContent(note.content);
    initialRef.current = note.content;
  }, [note.name, note.content, note.etag]);

  const dirty = content !== initialRef.current;

  const handleCancel = () => {
    if (dirty) {
      const ok = window.confirm(
        "Descartar alterações? Há mudanças não salvas."
      );
      if (!ok) return;
    }
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd+S para salvar
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (!saving && dirty) void onSave(content);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
      onKeyDown={handleKeyDown}
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
          <Pencil size={16} aria-hidden="true" style={{ color: "#a78bfa" }} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                fontFamily: '"JetBrains Mono", monospace',
                color: "var(--neon-purple)",
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
                color: dirty ? "var(--neon-yellow)" : "var(--text-muted)",
                marginTop: 2,
              }}
            >
              {dirty ? "● modificado — não salvo" : "sem alterações"}
              {" · "}
              <span style={{ opacity: 0.7 }}>
                Ctrl+S salva · Esc cancela
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleCancel}
            disabled={saving}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "var(--text-muted)",
              fontSize: 11,
              fontFamily: '"JetBrains Mono", monospace',
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.5 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => void onSave(content)}
            disabled={saving || !dirty}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: "1px solid rgba(34, 197, 94, 0.4)",
              background: dirty ? "rgba(34, 197, 94, 0.1)" : "transparent",
              color: dirty && !saving ? "var(--neon-green)" : "rgba(34, 197, 94, 0.3)",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: '"JetBrains Mono", monospace',
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              cursor: saving || !dirty ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              boxShadow:
                dirty && !saving ? "0 0 14px rgba(34, 197, 94, 0.2)" : "none",
            }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* CodeMirror */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <CodeMirror
          value={content}
          height="100%"
          theme={oneDark}
          extensions={[
            markdown({ base: markdownLanguage }),
            EditorView.lineWrapping,
          ]}
          onChange={(v) => setContent(v)}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            foldGutter: false,
          }}
          style={{
            height: "100%",
            fontSize: 13,
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          }}
        />
      </div>
    </div>
  );
}
