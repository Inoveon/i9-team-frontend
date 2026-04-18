import type { Team, AgentsStatusResponse } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4020";
const ADMIN_USER = process.env.NEXT_PUBLIC_API_USER ?? "admin";
const ADMIN_PASS = process.env.NEXT_PUBLIC_API_PASS ?? "i9team";

/** Token cache (in-memory, reatualizado quando expirar) — exportado para uso no WS */
export async function getAuthToken(): Promise<string> { return getToken(); }

/** Token cache (in-memory, reatualizado quando expirar) */
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

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
interface RawAgent { id: string; name: string; role: string; sessionName: string }
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
        status: "running", // status real via /agents/status na TeamPage
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
