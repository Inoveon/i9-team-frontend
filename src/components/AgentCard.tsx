"use client";

import { motion } from "framer-motion";
import { StatusBadge } from "./StatusBadge";
import type { Agent } from "@/types";

/**
 * AgentCard — Card compacto de seleção de worker.
 *
 * Usado no painel direito da TeamPage acima do grid de terminais.
 * Comportamento toggle (multi-select): clicar abre/fecha o terminal
 * do agente correspondente no grid de baixo.
 */

export interface AgentCardProps {
  agent: Agent;
  selected: boolean;
  onToggle: () => void;
}

export function AgentCard({ agent, selected, onToggle }: AgentCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={
        "agent-card glass" + (selected ? " agent-card--selected" : "")
      }
      title={
        selected
          ? `Clique para fechar ${agent.name}`
          : `Clique para abrir ${agent.name}`
      }
    >
      <div className="agent-card__row">
        <span className="agent-card__name" title={agent.name}>
          {agent.name}
        </span>
        <StatusBadge status={agent.status} size="sm" />
      </div>
      {selected && <span className="agent-card__indicator" aria-hidden="true" />}
    </motion.button>
  );
}
