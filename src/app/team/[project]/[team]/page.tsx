"use client";

import { useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { AgentPanel } from "@/components/AgentPanel";
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

  const handleSendMessage = async (message: string) => {
    if (!activeTeam || !orchestrator) return;
    try {
      await api.post(`/teams/${activeTeam.id}/message`, {
        agentId: orchestrator.id,
        message,
      });
    } catch (err) {
      console.error("Send message failed", err);
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
            {orchestrator ? (
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
          <div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
              Agentes ({workers.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {workers.length === 0 ? (
                <div className="card" style={{ padding: 24, color: "var(--text-muted)" }}>
                  Nenhum agente worker
                </div>
              ) : (
                workers.map((agent) => (
                  <AgentPanel key={agent.id} agent={agent} height={200} />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
