"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FileText } from "lucide-react";
import { NotesList } from "./NotesList";
import { NoteViewer } from "./NoteViewer";
import { NoteEditor } from "./NoteEditor";
import { NewNoteDialog } from "./NewNoteDialog";
import { ToastStack, type ToastItem, type ToastKind } from "./NotesToast";
import {
  useNotes,
  NoteConflictError,
  NoteNotFoundError,
} from "@/hooks/useNotes";

interface NotesPanelProps {
  teamId: string | undefined;
}

type ViewMode = "view" | "edit";

let toastCounter = 0;

export function NotesPanel({ teamId }: NotesPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const noteFromUrl = searchParams.get("note");

  const {
    notes,
    selectedNote,
    loading,
    error,
    refresh,
    loadNote,
    saveNote,
    createNote,
    deleteNote,
    clearSelected,
  } = useNotes(teamId);

  const [mode, setMode] = useState<ViewMode>("view");
  const [saving, setSaving] = useState(false);
  const [loadingNote, setLoadingNote] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback(
    (
      kind: ToastKind,
      message: string,
      opts?: { title?: string; actions?: ToastItem["actions"]; ttl?: number }
    ) => {
      const id = `t${Date.now()}-${++toastCounter}`;
      const item: ToastItem = {
        id,
        kind,
        message,
        title: opts?.title,
        actions: opts?.actions,
      };
      setToasts((prev) => [...prev, item]);
      const ttl = opts?.ttl ?? (opts?.actions ? 12_000 : 4_000);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ttl);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sincroniza URL ?note= com seleção
  useEffect(() => {
    if (!teamId) return;
    if (noteFromUrl && noteFromUrl !== selectedNote?.name) {
      setLoadingNote(true);
      loadNote(noteFromUrl)
        .catch((err) => {
          if (err instanceof NoteNotFoundError) {
            pushToast("warning", `A nota "${err.noteName}" não existe mais`, {
              title: "Nota removida",
            });
            setUrlNote(null);
          }
        })
        .finally(() => setLoadingNote(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteFromUrl, teamId]);

  const setUrlNote = useCallback(
    (name: string | null) => {
      const current = new URLSearchParams(searchParams.toString());
      if (name) current.set("note", name);
      else current.delete("note");
      const qs = current.toString();
      const url = qs ? `?${qs}` : window.location.pathname;
      router.replace(url, { scroll: false });
    },
    [router, searchParams]
  );

  const handleSelect = useCallback(
    async (name: string) => {
      setMode("view");
      setLoadingNote(true);
      try {
        await loadNote(name);
        setUrlNote(name);
      } catch (err) {
        if (err instanceof NoteNotFoundError) {
          pushToast("warning", `Nota "${name}" não encontrada`);
        } else {
          pushToast(
            "error",
            err instanceof Error ? err.message : "Falha ao carregar nota"
          );
        }
      } finally {
        setLoadingNote(false);
      }
    },
    [loadNote, pushToast, setUrlNote]
  );

  const handleEdit = useCallback(() => setMode("edit"), []);

  const handleCancel = useCallback(() => setMode("view"), []);

  const handleSave = useCallback(
    async (content: string, opts?: { force?: boolean }) => {
      if (!selectedNote) return;
      setSaving(true);
      try {
        await saveNote(
          selectedNote.name,
          content,
          opts?.force ? undefined : selectedNote.etag
        );
        pushToast("success", "Nota salva com sucesso");
        setMode("view");
      } catch (err) {
        if (err instanceof NoteConflictError) {
          pushToast(
            "warning",
            "Nota foi modificada no servidor enquanto você editava.",
            {
              title: "Conflito de edição",
              actions: [
                {
                  label: "Recarregar",
                  variant: "ghost",
                  onClick: () => {
                    void loadNote(selectedNote.name).then(() => {
                      setMode("view");
                      pushToast("info", "Versão do servidor carregada");
                    });
                  },
                },
                {
                  label: "Forçar salvar",
                  variant: "primary",
                  onClick: () => {
                    void handleSave(content, { force: true });
                  },
                },
              ],
            }
          );
        } else {
          pushToast(
            "error",
            err instanceof Error ? err.message : "Falha ao salvar"
          );
        }
      } finally {
        setSaving(false);
      }
    },
    [selectedNote, saveNote, loadNote, pushToast]
  );

  const handleCreate = useCallback(
    async (name: string, content: string) => {
      try {
        await createNote(name, content);
        setShowNewDialog(false);
        pushToast("success", `Nota "${name}" criada`);
        await handleSelect(name);
      } catch (err) {
        pushToast(
          "error",
          err instanceof Error ? err.message : "Falha ao criar nota"
        );
        throw err;
      }
    },
    [createNote, pushToast, handleSelect]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedNote) return;
    const ok = window.confirm(
      `Deletar a nota "${selectedNote.name}"? Esta ação é irreversível.`
    );
    if (!ok) return;
    try {
      await deleteNote(selectedNote.name);
      clearSelected();
      setUrlNote(null);
      setMode("view");
      pushToast("success", "Nota deletada");
    } catch (err) {
      pushToast(
        "error",
        err instanceof Error ? err.message : "Falha ao deletar"
      );
    }
  }, [selectedNote, deleteNote, clearSelected, setUrlNote, pushToast]);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: 16,
          height: "calc(100vh - 220px)",
          minHeight: 520,
        }}
        className="notes-grid"
      >
        {/* Sidebar: lista */}
        <div
          className="card"
          style={{
            padding: 14,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <NotesList
            notes={notes}
            selectedName={selectedNote?.name ?? null}
            loading={loading}
            onSelect={handleSelect}
            onCreate={() => setShowNewDialog(true)}
            onRefresh={() => void refresh()}
          />
        </div>

        {/* Conteúdo: viewer ou editor */}
        <div
          className="card"
          style={{
            padding: 18,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {error && !selectedNote && !loading && (
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                background: "rgba(255,56,100,0.06)",
                border: "1px solid rgba(255,56,100,0.3)",
                color: "var(--neon-red)",
                fontSize: 12,
                marginBottom: 12,
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              Falha ao carregar notas: {error}
              <button
                onClick={() => void refresh()}
                style={{
                  marginLeft: 12,
                  padding: "3px 10px",
                  borderRadius: 4,
                  border: "1px solid rgba(255,56,100,0.3)",
                  background: "transparent",
                  color: "var(--neon-red)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {loadingNote ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  fontSize: 12,
                }}
              >
                Carregando nota...
              </motion.div>
            ) : !selectedNote ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  color: "var(--text-muted)",
                  textAlign: "center",
                }}
              >
                <FileText
                  size={36}
                  strokeWidth={1.5}
                  style={{ opacity: 0.35, color: "var(--text-tertiary)" }}
                  aria-hidden="true"
                />
                <div style={{ fontSize: 13 }}>
                  {notes.length === 0
                    ? "Nenhuma nota ainda"
                    : "Selecione uma nota para visualizar"}
                </div>
                {notes.length === 0 && (
                  <button
                    onClick={() => setShowNewDialog(true)}
                    style={{
                      marginTop: 8,
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid rgba(34, 197, 94, 0.4)",
                      background: "rgba(34, 197, 94, 0.06)",
                      color: "var(--neon-green)",
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: '"JetBrains Mono", monospace',
                      letterSpacing: "0.05em",
                      cursor: "pointer",
                    }}
                  >
                    + Criar primeira nota
                  </button>
                )}
              </motion.div>
            ) : mode === "view" ? (
              <motion.div
                key={`view-${selectedNote.name}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
              >
                <NoteViewer
                  note={selectedNote}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`edit-${selectedNote.name}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
              >
                <NoteEditor
                  note={selectedNote}
                  onSave={(c) => handleSave(c)}
                  onCancel={handleCancel}
                  saving={saving}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <NewNoteDialog
        open={showNewDialog}
        existingNames={notes.map((n) => n.name)}
        onCancel={() => setShowNewDialog(false)}
        onCreate={handleCreate}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Responsivo: em <md vira stack vertical */}
      <style jsx>{`
        @media (max-width: 860px) {
          .notes-grid {
            grid-template-columns: 1fr !important;
            height: auto !important;
            min-height: 0 !important;
          }
          .notes-grid > :first-child {
            max-height: 260px;
          }
          .notes-grid > :last-child {
            min-height: 60vh;
          }
        }
      `}</style>
    </>
  );
}
