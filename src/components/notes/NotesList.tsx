"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { NoteSummary } from "@/hooks/useNotes";

interface NotesListProps {
  notes: NoteSummary[];
  selectedName: string | null;
  loading: boolean;
  onSelect: (name: string) => void;
  onCreate: () => void;
  onRefresh: () => void;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `há ${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function NotesList({
  notes,
  selectedName,
  loading,
  onSelect,
  onCreate,
  onRefresh,
}: NotesListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.name.toLowerCase().includes(q));
  }, [notes, query]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 10,
      }}
    >
      {/* Header: Nova + Refresh */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onCreate}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(34, 197, 94, 0.4)",
            background: "rgba(34, 197, 94, 0.06)",
            color: "var(--neon-green)",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: "0.05em",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = "0 0 16px rgba(34, 197, 94, 0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          + Nova nota
        </button>
        <button
          onClick={onRefresh}
          aria-label="Recarregar"
          title="Recarregar lista"
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: 14,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          ↻
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar notas..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          padding: "7px 10px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.3)",
          color: "var(--text)",
          fontSize: 12,
          fontFamily: '"JetBrains Mono", monospace',
          outline: "none",
        }}
      />

      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 4,
        }}
      >
        {notes.length} {notes.length === 1 ? "nota" : "notas"}
        {query && ` · ${filtered.length} filtradas`}
      </div>

      {/* Lista */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minHeight: 0,
        }}
      >
        {loading && notes.length === 0 ? (
          // Skeleton
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  height: 56,
                  animation: "pulse 1.5s ease-in-out infinite",
                  opacity: 0.5 - i * 0.12,
                }}
              />
            ))}
          </>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {query
              ? `Nenhuma nota corresponde a "${query}"`
              : "Nenhuma nota ainda — crie a primeira"}
          </div>
        ) : (
          filtered.map((n) => {
            const isActive = n.name === selectedName;
            return (
              <motion.button
                key={n.name}
                onClick={() => onSelect(n.name)}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.12 }}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: isActive
                    ? "1px solid rgba(90, 200, 250, 0.5)"
                    : "1px solid rgba(255,255,255,0.04)",
                  background: isActive
                    ? "rgba(90, 200, 250, 0.08)"
                    : "rgba(255,255,255,0.02)",
                  color: isActive ? "var(--neon-blue)" : "var(--text)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  boxShadow: isActive ? "0 0 14px rgba(90, 200, 250, 0.15)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    fontFamily: '"JetBrains Mono", monospace',
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {n.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    fontSize: 10,
                    color: "var(--text-muted)",
                  }}
                >
                  <span>{formatDate(n.updatedAt)}</span>
                  <span>·</span>
                  <span>{formatSize(n.size)}</span>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}
