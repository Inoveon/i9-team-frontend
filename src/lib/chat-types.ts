/**
 * Tipos compartilhados do stream de eventos do chat.
 *
 * Extraídos do hook `useMessageStream` para serem reutilizados pelo
 * reducer (`chat-reducer.ts`) e store Zustand (`store.ts`).
 */

export type StreamEventType =
  | "user_input"
  | "claude_text"
  | "tool_call"
  | "tool_result"
  | "thinking"
  | "system"
  | "interactive_menu";

export interface StreamEvent {
  id: string;
  type: StreamEventType;
  /** Texto normalizado — preenchido pelo hook independente do campo original */
  text: string;
  name?: string;
  args?: string;
  toolId?: string;
  title?: string;
  options?: string[];
  timestamp: number;

  // ─── Onda 1 — reconciliação otimista ────────────────────────────────
  /** Evento adicionado localmente antes do eco do servidor */
  optimistic?: boolean;
  /** Marcado como reconciliado com eco do servidor (promovido) */
  reconciled?: boolean;
  /** Timestamp do clique (client-side) para reconciliação FIFO */
  clientTs?: number;
}

/**
 * Estado do chat para UMA session tmux.
 *
 * - `events`: lista ordenada de bubbles
 * - `byKey`: Map hash → index em `events` para dedup O(1) e merge in-place
 *
 * Mantido por session no store Zustand (`chatBySession`), sobrevive
 * ao unmount do hook → usuário não perde timeline ao alternar workers.
 */
export interface ChatState {
  events: StreamEvent[];
  byKey: Map<string, number>;
}

export const EMPTY_CHAT_STATE: ChatState = {
  events: [],
  byKey: new Map(),
};
