export type AgentStatus = "idle" | "running" | "error" | "stopped";

export interface Agent {
  id: string;
  name: string;
  role: "orchestrator" | "worker";
  status: AgentStatus;
  sessionId?: string;
  lastOutput?: string;
  startedAt?: string;
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
