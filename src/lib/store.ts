import { create } from "zustand";
import type { Team, Agent, Session } from "@/types";

interface TeamStore {
  teams: Team[];
  activeTeam: Team | null;
  sessions: Record<string, Session>;
  agentOutputs: Record<string, string[]>;

  setTeams: (teams: Team[]) => void;
  setActiveTeam: (team: Team | null) => void;
  updateTeamStatus: (teamId: string, status: Team["status"]) => void;
  updateAgentStatus: (
    teamId: string,
    agentId: string,
    status: Agent["status"]
  ) => void;
  appendOutput: (agentId: string, line: string) => void;
  clearOutput: (agentId: string) => void;
  upsertSession: (session: Session) => void;
}

export const useTeamStore = create<TeamStore>((set) => ({
  teams: [],
  activeTeam: null,
  sessions: {},
  agentOutputs: {},

  setTeams: (teams) => set({ teams }),

  setActiveTeam: (activeTeam) => set({ activeTeam }),

  updateTeamStatus: (teamId, status) =>
    set((state) => ({
      teams: state.teams.map((t) => (t.id === teamId ? { ...t, status } : t)),
      activeTeam:
        state.activeTeam?.id === teamId
          ? { ...state.activeTeam, status }
          : state.activeTeam,
    })),

  updateAgentStatus: (teamId, agentId, status) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              agents: t.agents.map((a) =>
                a.id === agentId ? { ...a, status } : a
              ),
            }
          : t
      ),
    })),

  appendOutput: (agentId, line) =>
    set((state) => ({
      agentOutputs: {
        ...state.agentOutputs,
        [agentId]: [...(state.agentOutputs[agentId] ?? []), line],
      },
    })),

  clearOutput: (agentId) =>
    set((state) => ({
      agentOutputs: { ...state.agentOutputs, [agentId]: [] },
    })),

  upsertSession: (session) =>
    set((state) => ({
      sessions: { ...state.sessions, [session.id]: session },
    })),
}));
