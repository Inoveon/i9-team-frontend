import type { Team, AgentsStatusResponse, RcEntry } from "@/types";
import { getApiBase } from "@/lib/runtime-config";

const ADMIN_USER = process.env.NEXT_PUBLIC_API_USER ?? "admin";
const ADMIN_PASS = process.env.NEXT_PUBLIC_API_PASS ?? "i9team";

/** Token cache (in-memory, reatualizado quando expirar) — exportado para uso no WS */
export async function getAuthToken(): Promise<string> { return getToken(); }

/** Token cache (in-memory, reatualizado quando expirar) */
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const BASE_URL = getApiBase();
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  });

  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23h
  return cachedToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const BASE_URL = getApiBase();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// Formato bruto retornado pelo backend em GET /teams
interface RawAgent { id: string; name: string; role: string; sessionName: string; active?: boolean }
interface RawTeam {
  id: string; name: string; description?: string;
  createdAt: string; agents: RawAgent[];
}

// Named helpers
export async function getTeams(): Promise<Team[]> {
  const data = await request<{ teams: RawTeam[] }>("/teams");
  return (data.teams ?? []).map((t) => {
    const [project = t.name, teamName = t.name] = t.name.split("/");
    const hasAgents = t.agents.length > 0;
    return {
      id: t.id,
      project,
      name: teamName,
      description: t.description,
      status: hasAgents ? "running" : "stopped",
      agents: t.agents.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role === "orchestrator" ? "orchestrator" : "worker",
        status: a.active === false ? "stopped" : "running",
        sessionId: a.sessionName,
      })),
      createdAt: t.createdAt,
      updatedAt: t.createdAt,
    } as Team;
  });
}

export const getTeam = (id: string): Promise<Team> => request<Team>(`/teams/${id}`);

export async function getAgents(teamId: string): Promise<AgentsStatusResponse> {
  return request<AgentsStatusResponse>(`/teams/${teamId}/agents/status`);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/**
 * Envia mensagem ao agente via bridge service (POST /bridge/send).
 * Lança erro com mensagem humanizada para os casos:
 *   - 503 → bridge indisponível
 *   - 404 → agente não encontrado
 *   - outros → erro genérico com status
 */
export async function sendViaBridge(
  teamId: string,
  agentName: string,
  message: string
): Promise<{ ok: boolean }> {
  const token = await getToken();
  const BASE_URL = getApiBase();
  const res = await fetch(`${BASE_URL}/bridge/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ teamId, agentName, message }),
  });

  if (res.status === 503) {
    throw new BridgeUnavailableError("Bridge indisponível — mensagem não entregue");
  }
  if (res.status === 404) {
    throw new AgentNotFoundError("Agente não encontrado");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bridge error ${res.status}: ${text}`);
  }

  return res.json() as Promise<{ ok: boolean }>;
}

// ---------------------------------------------------------------------------
// Bridge status / stats types
// ---------------------------------------------------------------------------

export interface BridgeStatus {
  ok: boolean;
  uptime_seconds: number;
  broker_connected: boolean;
  msgs_received: number;
  msgs_sent: number;
  recent_messages?: BridgeMessage[];
}

export interface BridgeMessage {
  corr_id: string;
  from_agent: string;
  to_agent: string;
  project: string;
  team: string;
  type: string;
  ts_in: string;
  ts_out?: string;
  execution_ms?: number;
}

export interface BridgeStatsEntry {
  agent: string;
  msgs: number;
  avg_ms: number;
}

export interface BridgeTeamStatsEntry {
  project: string;
  team: string;
  msgs: number;
  avg_ms: number;
}

export interface BridgeDailyVolume {
  date: string;
  msgs: number;
}

export interface BridgeStats {
  top_agents_week: BridgeStatsEntry[];
  top_teams_week: BridgeTeamStatsEntry[];
  daily_volume: BridgeDailyVolume[];
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  return request<BridgeStatus>("/bridge/status");
}

export async function getBridgeStats(): Promise<BridgeStats> {
  return request<BridgeStats>("/bridge/stats");
}

export async function getRcStatus(): Promise<{ rc: RcEntry[] }> {
  return request<{ rc: RcEntry[] }>("/rc/status");
}

export class BridgeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BridgeUnavailableError";
  }
}

export class AgentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentNotFoundError";
  }
}
