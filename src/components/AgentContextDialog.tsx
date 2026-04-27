"use client";

import { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, RefreshCw, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";

/**
 * AgentContextDialog — Modal Liquid Glass que exibe o `agent-context.md`
 * de um agente (renderizado como markdown).
 *
 * Backend endpoint: `GET /teams/:teamId/agents/:name/context` →
 *   `{ markdown: string, lastUpdate: string, exists: boolean }`
 *
 * Resiliente: se o endpoint ainda não existir (Task #29 paralela), o
 * `try/catch` mostra mensagem amigável.
 */

interface AgentContextResponse {
  markdown: string;
  lastUpdate: string;
  exists: boolean;
}

interface AgentContextDialogProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  agentName: string;
}

export function AgentContextDialog({
  open,
  onClose,
  teamId,
  agentName,
}: AgentContextDialogProps) {
  const [markdown, setMarkdown] = useState<string>("");
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId || !agentName) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AgentContextResponse>(
        `/teams/${encodeURIComponent(teamId)}/agents/${encodeURIComponent(
          agentName
        )}/context`
      );
      setMarkdown(data.markdown ?? "");
      setLastUpdate(data.lastUpdate ?? "");
      if (!data.exists) {
        setError(
          "Sem contexto criado ainda — esse agente nunca atualizou seu agent-context."
        );
      }
    } catch (err) {
      setMarkdown("");
      setLastUpdate("");
      setError(
        err instanceof Error
          ? `Erro ao carregar contexto: ${err.message}`
          : "Erro ao carregar contexto."
      );
    } finally {
      setLoading(false);
    }
  }, [teamId, agentName]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="dialog-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="dialog-content glass-modal"
                initial={{ opacity: 0, scale: 0.96, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{
                  type: "spring",
                  stiffness: 320,
                  damping: 28,
                  mass: 0.8,
                }}
                aria-describedby={undefined}
              >
                <div className="dialog-header">
                  <Dialog.Title asChild>
                    <p className="dialog-title">
                      <FileText size={14} aria-hidden="true" />
                      <span
                        style={{
                          color: "var(--text-primary)",
                          textTransform: "none",
                          letterSpacing: 0,
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {agentName}
                      </span>
                      <span style={{ opacity: 0.5 }}>·</span>
                      Contexto
                    </p>
                  </Dialog.Title>
                  <div className="dialog-actions">
                    <button
                      type="button"
                      onClick={() => void load()}
                      disabled={loading}
                      className="agent-frame__btn"
                      title="Recarregar contexto"
                      aria-label="Recarregar contexto"
                    >
                      <RefreshCw
                        size={14}
                        className={loading ? "spinning" : undefined}
                      />
                    </button>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        className="agent-frame__btn"
                        title="Fechar"
                        aria-label="Fechar"
                      >
                        <X size={14} />
                      </button>
                    </Dialog.Close>
                  </div>
                </div>
                <div className="dialog-body markdown-body">
                  {loading && !markdown && (
                    <div className="dialog-empty">Carregando contexto…</div>
                  )}
                  {error && !loading && (
                    <div className="dialog-empty">{error}</div>
                  )}
                  {!error && markdown && (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {markdown}
                    </ReactMarkdown>
                  )}
                </div>
                {lastUpdate && !error && (
                  <div className="dialog-footer">
                    Última atualização:{" "}
                    {(() => {
                      try {
                        return new Date(lastUpdate).toLocaleString("pt-BR");
                      } catch {
                        return lastUpdate;
                      }
                    })()}
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
