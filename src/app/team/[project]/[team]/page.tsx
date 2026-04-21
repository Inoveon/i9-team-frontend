"use client";

import { useEffect, useCallback, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { AgentPanel } from "@/components/AgentPanel";
import { AgentView } from "@/components/AgentView";
import { StatusBadge } from "@/components/StatusBadge";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { useTeamStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { Team } from "@/types";

type PageTab = "agents" | "notes";

export default function TeamPage() {
  const params = useParams<{ project: string; team: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeTeam, setActiveTeam } = useTeamStore();

  const initialTab: PageTab = searchParams.get("tab") === "notes" ? "notes" : "agents";
  const [pageTab, setPageTab] = useState<PageTab>(initialTab);

  const changeTab = useCallback(
    (next: PageTab) => {
      setPageTab(next);
      const current = new URLSearchParams(searchParams.toString());
      if (next === "notes") current.set("tab", "notes");
      else current.delete("tab");
      // Limpa ?note= se saindo de notas
      if (next !== "notes") current.delete("note");
      const qs = current.toString();
      const url = qs ? `?${qs}` : window.location.pathname;
      router.replace(url, { scroll: false });
    },
    [router, searchParams]
  );

  const fetchTeam = useCallback(async () => {
    try {
      const data = await api.get<{ team: Team }>(
        `/teams/${params.project}/${params.team}`
      );
      setActiveTeam(data.team);
    } catch {
      // ignore
    }
  }, [params.project, params.team, setActiveTeam]);

  useEffect(() => {
    void fetchTeam();
    // Polling só faz sentido na aba de agentes (evita refresh em cima do editor)
    if (pageTab !== "agents") return;
    const interval = setInterval(() => void fetchTeam(), 5000);
    return () => clearInterval(interval);
  }, [fetchTeam, pageTab]);

  const orchestrator = activeTeam?.agents.find((a) => a.role === "orchestrator");
  const workers = activeTeam?.agents.filter((a) => a.role === "worker") ?? [];
  const [selectedWorkerIdx, setSelectedWorkerIdx] = useState(0);
  const selectedWorker = workers[selectedWorkerIdx] ?? null;

  /**
   * Envia mensagem ao agente.
   *
   * Onda 1 — Fix F7: aceita `agentIdOverride` opcional (worker alvo).
   * Onda 5 — aceita `opts.attachmentIds` (UUIDs pré-uploadados em
   *   POST /upload/image?teamId=<id>). O backend (Onda 5) valida e
   *   injeta as imagens no tmux.
   */
  const handleSendMessage = async (
    message: string,
    agentIdOverride?: string,
    opts?: { attachmentIds?: string[] }
  ) => {
    if (!activeTeam) {
      console.warn("[TeamPage] handleSendMessage abortado — activeTeam ausente", { message });
      throw new Error("Team ainda não carregado — aguarde.");
    }

    const targetAgent = agentIdOverride
      ? activeTeam.agents.find((a) => a.id === agentIdOverride)
      : orchestrator;

    if (!targetAgent) {
      console.warn("[TeamPage] handleSendMessage abortado — agente destino ausente", {
        teamId: activeTeam.id,
        agentIdOverride,
        message,
      });
      throw new Error(
        agentIdOverride
          ? "Agente destinatário não encontrado neste team."
          : "Nenhum orquestrador configurado neste team."
      );
    }

    const attachmentIds = opts?.attachmentIds;
    const payload: {
      agentId: string;
      message: string;
      attachmentIds?: string[];
    } = { agentId: targetAgent.id, message };
    if (attachmentIds && attachmentIds.length > 0) {
      payload.attachmentIds = attachmentIds;
    }

    console.log("[TeamPage] POST /teams/:id/message", {
      teamId: activeTeam.id,
      agentName: targetAgent.name,
      agentRole: targetAgent.role,
      bytes: message.length,
      attachments: attachmentIds?.length ?? 0,
    });
    try {
      const resp = await api.post<{ ok: boolean; session: string; agent: string }>(
        `/teams/${activeTeam.id}/message`,
        payload
      );
      console.log("[TeamPage] POST /message OK", resp);
    } catch (err) {
      console.error("[TeamPage] POST /message FAIL", err);
      throw err;
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── HEADER (nav + título + tabs) — flexShrink:0 ───────────────── */}
      {/* Nav */}
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <Link
          href="/"
          style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
        >
          Dashboard
        </Link>
        <span style={{ color: "var(--border)", margin: "0 8px" }}>/</span>
        <span style={{ fontSize: 13, color: "var(--neon-blue)" }}>
          {params.project} / {params.team}
        </span>
      </div>

      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: "var(--text)",
          marginBottom: 16,
          letterSpacing: "-0.02em",
          flexShrink: 0,
        }}
      >
        {activeTeam?.name ?? `${params.project}/${params.team}`}
      </motion.h1>

      {/* Tabs da página (Agentes / Notas) */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 20,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        {(
          [
            { key: "agents", label: "Agentes", icon: "▸" },
            { key: "notes", label: "Notas", icon: "📄" },
          ] as { key: PageTab; label: string; icon: string }[]
        ).map((t) => {
          const isActive = pageTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => changeTab(t.key)}
              style={{
                padding: "8px 18px",
                fontSize: 12,
                fontWeight: isActive ? 700 : 400,
                fontFamily: '"JetBrains Mono", monospace',
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: isActive ? "rgba(0,212,255,0.06)" : "transparent",
                border: "none",
                borderBottom: isActive
                  ? "2px solid var(--neon-blue)"
                  : "2px solid transparent",
                color: isActive ? "var(--neon-blue)" : "rgba(255,255,255,0.35)",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: -1,
              }}
            >
              <span style={{ fontSize: 13 }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── CONTEÚDO — flex:1 ocupa restante do viewport ─────────────── */}
      {!activeTeam ? (
        <div
          className="card"
          style={{
            padding: 48,
            textAlign: "center",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          Carregando team...
        </div>
      ) : pageTab === "notes" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <NotesPanel teamId={activeTeam.id} />
        </div>
      ) : (
        <div
          className="team-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "60fr 40fr",
            gap: 20,
            alignItems: "stretch",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Orchestrator column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              height: "100%",
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 12,
                flexShrink: 0,
              }}
            >
              Orquestrador
            </p>
            {orchestrator?.sessionId ? (
              <div
                className="card"
                style={{
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--neon-purple)" }}>
                    {orchestrator.name}
                  </span>
                  <StatusBadge status={orchestrator.status} size="sm" />
                </div>
                <AgentView
                  session={orchestrator.sessionId}
                  showInput
                  teamId={activeTeam.id}
                  onSendMessage={(m, opts) => handleSendMessage(m, undefined, opts)}
                />
              </div>
            ) : orchestrator ? (
              <AgentPanel
                agent={orchestrator}
                showInput
                teamId={activeTeam.id}
                onSendMessage={(m, opts) => handleSendMessage(m, undefined, opts)}
              />
            ) : (
              <div
                className="card"
                style={{ padding: 24, color: "var(--text-muted)", flexShrink: 0 }}
              >
                Nenhum orquestrador configurado
              </div>
            )}
          </div>

          {/* Workers column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              minHeight: 0,
              height: "100%",
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                flexShrink: 0,
              }}
            >
              Agentes ({workers.length})
            </p>

            {workers.length === 0 ? (
              <div className="card" style={{ padding: 24, color: "var(--text-muted)", flexShrink: 0 }}>
                Nenhum agente worker
              </div>
            ) : (
              <>
                {/* Tabs de seleção — scroll horizontal se muitos agentes */}
                <div style={{
                  display: "flex",
                  gap: 6,
                  overflowX: "auto",
                  paddingBottom: 4,
                  scrollbarWidth: "thin",
                  scrollbarColor: "rgba(0,212,255,0.2) transparent",
                  flexShrink: 0,
                }}>
                  {workers.map((agent, idx) => {
                    const isActive = idx === selectedWorkerIdx;
                    return (
                      <button
                        key={agent.id}
                        onClick={() => setSelectedWorkerIdx(idx)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "5px 12px",
                          borderRadius: 8,
                          border: isActive
                            ? "1px solid rgba(0,212,255,0.5)"
                            : "1px solid rgba(255,255,255,0.06)",
                          background: isActive
                            ? "rgba(0,212,255,0.08)"
                            : "rgba(255,255,255,0.02)",
                          color: isActive ? "var(--neon-blue)" : "var(--text-muted)",
                          fontSize: 12,
                          fontWeight: isActive ? 700 : 400,
                          fontFamily: '"JetBrains Mono", monospace',
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          transition: "all 0.15s",
                          boxShadow: isActive ? "0 0 10px rgba(0,212,255,0.15)" : "none",
                        }}
                      >
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: isActive ? "var(--neon-blue)" : "rgba(255,255,255,0.15)",
                          flexShrink: 0,
                        }} />
                        {agent.name}
                        <StatusBadge status={agent.status} size="sm" />
                      </button>
                    );
                  })}
                </div>

                {/* Painel do agente selecionado — flex:1 ocupa restante da coluna */}
                {selectedWorker && (
                  <motion.div
                    key={selectedWorker.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      flex: 1,
                      minHeight: 0,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      className="card"
                      style={{
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                        minHeight: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 10,
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--neon-blue)" }}>
                          {selectedWorker.name}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 8 }}>
                          worker
                        </span>
                        <StatusBadge status={selectedWorker.status} size="sm" />
                      </div>
                      {selectedWorker.sessionId ? (
                        <AgentView
                          session={selectedWorker.sessionId}
                          showInput
                          teamId={activeTeam.id}
                          onSendMessage={(msg, opts) =>
                            handleSendMessage(msg, selectedWorker.id, opts)
                          }
                        />
                      ) : (
                        <AgentPanel
                          agent={selectedWorker}
                          showInput
                          teamId={activeTeam.id}
                          onSendMessage={(msg, opts) =>
                            handleSendMessage(msg, selectedWorker.id, opts)
                          }
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Responsivo: em <900px vira coluna única empilhada ─────────── */}
      <style jsx>{`
        @media (max-width: 900px) {
          :global(.team-grid) {
            grid-template-columns: 1fr !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
          :global(.team-grid) > div {
            min-height: 420px;
          }
        }
      `}</style>
    </div>
  );
}
