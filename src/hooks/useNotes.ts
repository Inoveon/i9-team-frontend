"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export interface NoteSummary {
  name: string;
  size: number;
  updatedAt: string;
}

export interface NoteFull {
  name: string;
  content: string;
  size: number;
  updatedAt: string;
  etag: string;
}

export interface SaveResult {
  name: string;
  savedAt: string;
  etag: string;
  backupPath?: string;
}

export interface ConflictPayload {
  reason: "conflict";
  currentEtag: string;
  currentContent: string;
}

export class NoteConflictError extends Error {
  payload: ConflictPayload;
  constructor(payload: ConflictPayload) {
    super("conflict");
    this.payload = payload;
  }
}

export class NoteNotFoundError extends Error {
  constructor(public readonly noteName: string) {
    super(`note not found: ${noteName}`);
  }
}

interface UseNotesApi {
  notes: NoteSummary[];
  selectedNote: NoteFull | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadNote: (name: string) => Promise<NoteFull | null>;
  saveNote: (
    name: string,
    content: string,
    expectedEtag?: string
  ) => Promise<SaveResult>;
  createNote: (name: string, content: string) => Promise<SaveResult>;
  deleteNote: (name: string) => Promise<void>;
  clearSelected: () => void;
}

/**
 * Tenta deserializar o body de uma Error para detectar 409 conflict.
 * O `api` envolve o body em mensagem `API <status>: <body>`.
 */
function parseApiError(err: unknown): { status?: number; body?: unknown } {
  if (!(err instanceof Error)) return {};
  const m = err.message.match(/^API (\d+):\s*([\s\S]*)$/);
  if (!m) return {};
  const status = Number(m[1]);
  let body: unknown;
  try {
    body = JSON.parse(m[2]);
  } catch {
    body = m[2];
  }
  return { status, body };
}

export function useNotes(teamId: string | undefined): UseNotesApi {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [selectedNote, setSelectedNote] = useState<NoteFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const teamIdRef = useRef(teamId);
  teamIdRef.current = teamId;

  const refresh = useCallback(async () => {
    const id = teamIdRef.current;
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<NoteSummary[]>(`/teams/${id}/notes`);
      // DESC por updatedAt — backend já retorna assim, mas garantimos
      const sorted = [...data].sort((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
      );
      setNotes(sorted);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[useNotes] falha em refresh", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNote = useCallback(
    async (name: string): Promise<NoteFull | null> => {
      const id = teamIdRef.current;
      if (!id) return null;
      try {
        const data = await api.get<NoteFull>(
          `/teams/${id}/notes/${encodeURIComponent(name)}`
        );
        setSelectedNote(data);
        setError(null);
        return data;
      } catch (err) {
        const { status } = parseApiError(err);
        if (status === 404) {
          console.warn("[useNotes] nota não encontrada", name);
          setNotes((prev) => prev.filter((n) => n.name !== name));
          setSelectedNote((cur) => (cur?.name === name ? null : cur));
          throw new NoteNotFoundError(name);
        }
        console.error("[useNotes] falha em loadNote", err);
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    []
  );

  const saveNote = useCallback(
    async (
      name: string,
      content: string,
      expectedEtag?: string
    ): Promise<SaveResult> => {
      const id = teamIdRef.current;
      if (!id) throw new Error("teamId ausente");
      try {
        const data = await api.put<SaveResult>(
          `/teams/${id}/notes/${encodeURIComponent(name)}`,
          expectedEtag ? { content, expectedEtag } : { content }
        );
        // Atualiza selectedNote e lista
        setSelectedNote((cur) =>
          cur && cur.name === name
            ? {
                ...cur,
                content,
                etag: data.etag,
                updatedAt: data.savedAt,
                size: content.length,
              }
            : cur
        );
        setNotes((prev) => {
          const others = prev.filter((n) => n.name !== name);
          return [
            {
              name,
              size: content.length,
              updatedAt: data.savedAt,
            },
            ...others,
          ];
        });
        return data;
      } catch (err) {
        const { status, body } = parseApiError(err);
        if (status === 409 && body && typeof body === "object") {
          throw new NoteConflictError(body as ConflictPayload);
        }
        console.error("[useNotes] falha em saveNote", err);
        throw err;
      }
    },
    []
  );

  const createNote = useCallback(
    async (name: string, content: string): Promise<SaveResult> => {
      const id = teamIdRef.current;
      if (!id) throw new Error("teamId ausente");
      const data = await api.post<SaveResult>(`/teams/${id}/notes`, {
        name,
        content,
      });
      setNotes((prev) => [
        {
          name: data.name,
          size: content.length,
          updatedAt: data.savedAt,
        },
        ...prev.filter((n) => n.name !== data.name),
      ]);
      return data;
    },
    []
  );

  const deleteNote = useCallback(async (name: string): Promise<void> => {
    const id = teamIdRef.current;
    if (!id) throw new Error("teamId ausente");
    try {
      await api.delete<void>(`/teams/${id}/notes/${encodeURIComponent(name)}`);
    } catch (err) {
      const { status } = parseApiError(err);
      if (status !== 404) throw err;
    }
    setNotes((prev) => prev.filter((n) => n.name !== name));
    setSelectedNote((cur) => (cur?.name === name ? null : cur));
  }, []);

  const clearSelected = useCallback(() => setSelectedNote(null), []);

  // Carga inicial + refresh a cada 30s (debounce implícito via setInterval único)
  useEffect(() => {
    if (!teamId) return;
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 30_000);
    return () => clearInterval(interval);
  }, [teamId, refresh]);

  return {
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
  };
}
