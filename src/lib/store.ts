import { create } from "zustand";
import type { Team, Agent, Session } from "@/types";
import type { ChatState, StreamEvent } from "./chat-types";
import { EMPTY_CHAT_STATE } from "./chat-types";
import { reduceEvents } from "./chat-reducer";

interface TeamStore {
  teams: Team[];
  activeTeam: Team | null;
  sessions: Record<string, Session>;
  agentOutputs: Record<string, string[]>;

  /**
   * Estado do chat POR session tmux.
   *
   * Mantido fora do hook `useMessageStream` para:
   *   - sobreviver ao unmount do componente (trocar de worker não perde timeline)
   *   - permitir dedup consistente mesmo em remount (ex: tab Chat/Terminal)
   *   - centralizar a regra de merge em um único reducer
   */
  chatBySession: Record<string, ChatState>;

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

  /** Aplica dedup + reconciliação otimista; usado tanto pelo WS quanto pelo append local */
  upsertChatEvents: (session: string, events: StreamEvent[]) => void;
  /** Zera a timeline daquela session (chave "limpar" do AgentView) */
  clearChatSession: (session: string) => void;
}

export const useTeamStore = create<TeamStore>((set) => ({
  teams: [],
  activeTeam: null,
  sessions: {},
  agentOutputs: {},
  chatBySession: {},

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

  upsertChatEvents: (session, events) =>
    set((state) => {
      const prev = state.chatBySession[session] ?? EMPTY_CHAT_STATE;
      const next = reduceEvents(prev, events);
      // Se reduceEvents retornou a mesma ref (nenhum evento novo), não re-renderiza.
      if (next === prev) return state;
      return {
        chatBySession: { ...state.chatBySession, [session]: next },
      };
    }),

  clearChatSession: (session) =>
    set((state) => ({
      chatBySession: {
        ...state.chatBySession,
        [session]: { events: [], byKey: new Map() },
      },
    })),
}));
