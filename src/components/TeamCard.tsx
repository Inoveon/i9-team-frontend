"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { StatusBadge } from "./StatusBadge";
import type { Team } from "@/types";

interface TeamCardProps {
  team: Team;
  onStart: (teamId: string) => void;
  onStop: (teamId: string) => void;
}

export function TeamCard({ team, onStart, onStop }: TeamCardProps) {
  const isRunning = team.status === "running";
  const runningAgents = team.agents.filter((a) => a.status === "running").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card"
      style={{ padding: "20px 24px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            {team.project}
          </p>
          <Link
            href={`/team/${team.project}/${team.name}`}
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--neon-blue)",
              textDecoration: "none",
            }}
          >
            {team.name}
          </Link>
        </div>
        <StatusBadge status={team.status} />
      </div>

      {team.description && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
          {team.description}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {team.agents.map((agent) => (
          <span
            key={agent.id}
            style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              color: agent.status === "running" ? "var(--neon-green)" : "var(--text-muted)",
              backgroundColor: "var(--surface-2)",
            }}
          >
            {agent.name}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {runningAgents}/{team.agents.length} agentes ativos
        </span>

        <div style={{ display: "flex", gap: 8 }}>
          {isRunning ? (
            <button
              onClick={() => onStop(team.id)}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: "1px solid var(--neon-red, #ff3864)",
                background: "transparent",
                color: "var(--neon-red, #ff3864)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => onStart(team.id)}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: "1px solid var(--neon-green)",
                background: "transparent",
                color: "var(--neon-green)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Start
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
