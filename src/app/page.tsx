"use client";

import { useEffect, useCallback, useState } from "react";
import { motion } from "framer-motion";
import { TeamCard } from "@/components/TeamCard";
import { useTeamStore } from "@/lib/store";
import { toast } from "sonner";
import { getTeams, getAgents, getRcStatus, api } from "@/lib/api";
import type { Team, RcStatus } from "@/types";

export default function DashboardPage() {
  const { teams, setTeams, updateTeamStatus, updateAgentStatus } = useTeamStore();
  const [rcStatusMap, setRcStatusMap] = useState<Record<string, RcStatus>>({});

  const fetchTeams = useCallback(async () => {
    try {
      const data = await getTeams();
      setTeams(data);
      // Busca status real de cada team em paralelo
      await Promise.allSettled(
        data.map(async (team) => {
          try {
            const res = await getAgents(team.id);
            for (const agent of res.agents) { updateAgentStatus(team.id, agent.id, agent.active ? "running" : "stopped"); }
          } catch {
            // team sem agentes ativos — ignora
          }
        })
      );
    } catch {
      // Backend may not be running yet
    }
  }, [setTeams, updateAgentStatus]);

  const fetchRcStatus = useCallback(async () => {
    try {
      const { rc } = await getRcStatus();
      const map: Record<string, RcStatus> = {};
      for (const entry of rc) {
        map[`${entry.project}/${entry.team}/${entry.agent}`] = entry.rc_status;
      }
      setRcStatusMap(map);
    } catch {
      // RC endpoint indisponível — ignora
    }
  }, []);

  useEffect(() => {
    void fetchTeams();
    void fetchRcStatus();
    const interval = setInterval(() => {
      void fetchTeams();
      void fetchRcStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchTeams, fetchRcStatus]);

  const handleStart = async (teamId: string) => {
    try {
      await api.post(`/teams/${teamId}/start`, {});
      updateTeamStatus(teamId, "running");
      toast.success("Team iniciado");
    } catch (err) {
      console.error("Start failed", err);
      toast.error("Falha ao iniciar team");
    }
  };

  const handleStop = async (teamId: string) => {
    try {
      await api.post(`/teams/${teamId}/stop`, {});
      updateTeamStatus(teamId, "stopped");
      toast.success("Team parado");
    } catch (err) {
      console.error("Stop failed", err);
      toast.error("Falha ao parar team");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px 32px",
        maxWidth: "100%",
        
      }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ marginBottom: 40, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: "var(--text)",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          i9 Team Dashboard
        </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8 }}>
            {teams.length} team{teams.length !== 1 ? "s" : ""} configurados
          </p>
        </div>

        {/* Indicador online */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "var(--neon-green)",
              boxShadow: "0 0 10px var(--neon-green)",
              animation: "pulse 2s infinite",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 11, color: "var(--neon-green)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Online
          </span>
        </div>
      </motion.div>

      {/* Grid */}
      {teams.length === 0 ? (
        <div
          className="card"
          style={{
            padding: 48,
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <p style={{ fontSize: 16, marginBottom: 8 }}>Nenhum team encontrado</p>
          <p style={{ fontSize: 13 }}>
            Configure seus teams em{" "}
            <a href="/config" style={{ color: "var(--neon-blue)" }}>
              /config
            </a>
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 20,
          }}
        >
          {teams.map((team, i) => (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <TeamCard
                team={team}
                onStart={handleStart}
                onStop={handleStop}
                rcStatusMap={rcStatusMap}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
