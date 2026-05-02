export type AgentStatus = "idle" | "running" | "error" | "stopped";
export type RcStatus = "active" | "reconnecting" | "disconnected" | "unknown";

export interface RcEntry {
  session: string;
  agent: string;
  project: string;
  team: string;
  rc_status: RcStatus;
}

export interface Agent {
  id: string;
  name: string;
  role: "orchestrator" | "worker";
  status: AgentStatus;
  sessionId?: string;
  lastOutput?: string;
  startedAt?: string;
}

/** Formato real retornado por GET /teams/:id/agents/status */
export interface AgentStatus_Real {
  id: string;
  name: string;
  role: string;
  sessionName: string;
  active: boolean;
}

export interface AgentsStatusResponse {
  teamId: string;
  teamName: string;
  agents: AgentStatus_Real[];
}

export interface Team {
  id: string;
  project: string;
  name: string;
  description?: string;
  status: "running" | "stopped" | "error";
  agents: Agent[];
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  agentId: string;
  teamId: string;
  status: AgentStatus;
  output: string[];
  startedAt: string;
  endedAt?: string;
}

export interface TeamConfig {
  project: string;
  name: string;
  description?: string;
  agents: {
    name: string;
    role: "orchestrator" | "worker";
    prompt?: string;
  }[];
}
