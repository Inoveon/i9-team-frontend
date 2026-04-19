"use client";

import { useEffect, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AgentPanel } from "@/components/AgentPanel";
import { AgentView } from "@/components/AgentView";
import { StatusBadge } from "@/components/StatusBadge";
import { useTeamStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { Team } from "@/types";

export default function TeamPage() {
  const params = useParams<{ project: string; team: string }>();
  const { activeTeam, setActiveTeam } = useTeamStore();

  const fetchTeam = useCallback(async () => {
    try {
      const data = await api.get<Team>(
        `/teams/${params.project}/${params.team}`
      );
      setActiveTeam(data);
    } catch {
      // ignore
    }
  }, [params.project, params.team, setActiveTeam]);

  useEffect(() => {
    void fetchTeam();
    const interval = setInterval(() => void fetchTeam(), 5000);
    return () => clearInterval(interval);
  }, [fetchTeam]);

  const orchestrator = activeTeam?.agents.find((a) => a.role === "orchestrator");
  const workers = activeTeam?.agents.filter((a) => a.role === "worker") ?? [];
  const [selectedWorkerIdx, setSelectedWorkerIdx] = useState(0);
  const selectedWorker = workers[selectedWorkerIdx] ?? null;

  const handleSendMessage = async (message: string) => {
    if (!activeTeam || !orchestrator) return;
    try {
      await api.post(`/teams/${activeTeam.id}/message`, {
        agentId: orchestrator.id,
        message,
      });
    } catch (err) {
      console.error("Send message failed", err);
      toast.error("Falha ao enviar mensagem ao agente");
    }
  };

  return (
    <div style={{ minHeight: "100vh", padding: "32px 24px" }}>
      {/* Nav */}
      <div style={{ marginBottom: 24 }}>
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
          marginBottom: 24,
          letterSpacing: "-0.02em",
        }}
      >
        {activeTeam?.name ?? `${params.project}/${params.team}`}
      </motion.h1>

      {!activeTeam ? (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
          Carregando team...
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60fr 40fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* Orchestrator */}
          <div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
              Orquestrador
            </p>
            {orchestrator?.sessionId ? (
              <div className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--neon-purple)" }}>
                    {orchestrator.name}
                  </span>
                  <StatusBadge status={orchestrator.status} size="sm" />
                </div>
                <AgentView
                  session={orchestrator.sessionId}
                  height={460}
                  showInput
                  onSendMessage={handleSendMessage}
                />
              </div>
            ) : orchestrator ? (
              <AgentPanel
                agent={orchestrator}
                height={480}
                showInput
                onSendMessage={handleSendMessage}
              />
            ) : (
              <div className="card" style={{ padding: 24, color: "var(--text-muted)" }}>
                Nenhum orquestrador configurado
              </div>
            )}
          </div>

          {/* Workers */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Agentes ({workers.length})
            </p>

            {workers.length === 0 ? (
              <div className="card" style={{ padding: 24, color: "var(--text-muted)" }}>
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

                {/* Painel do agente selecionado */}
                {selectedWorker && (
                  <motion.div
                    key={selectedWorker.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div className="card" style={{ padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--neon-blue)" }}>
                          {selectedWorker.name}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 8 }}>
                          worker
                        </span>
                        <StatusBadge status={selectedWorker.status} size="sm" />
                      </div>
                      {selectedWorker.sessionId ? (
                        <AgentView session={selectedWorker.sessionId} height={400} />
                      ) : (
                        <AgentPanel agent={selectedWorker} height={400} />
                      )}
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
