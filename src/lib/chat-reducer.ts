/**
 * Reducer puro do chat — Onda 1 (dedup + reconciliação otimista).
 *
 * Objetivos:
 *   1. Deduplicar eventos retransmitidos pelo backend (que reemite o
 *      buffer tmux inteiro a cada tick) — ver handler.ts:168-193.
 *   2. Merge in-place para eventos cujo conteúdo evolui:
 *        - `thinking` → `duration` cresce entre ticks
 *        - `tool_result` → `content` pode ser truncado → completo
 *   3. Reconciliar bubbles otimistas (adicionadas no clique Enviar)
 *      com o eco parseado do tmux, sem flicker e sem duplicação.
 *
 * Invariantes:
 *   - Função PURA: não muta `prev`, sempre retorna novo objeto.
 *   - `byKey` e `events` sempre consistentes: para cada idx em byKey,
 *     `eventKey(events[idx]) === key`.
 *   - Sliding window de `MAX_EVENTS` — ao exceder, descarta a cabeça
 *     e rebuilda `byKey` (custo O(N), amortizado raro).
 *
 * Testado manualmente em http://10.0.10.17:4721 contra backend atual.
 */

import type { ChatState, StreamEvent } from "./chat-types";

/** Janela máxima de eventos por session — suficiente pra sessões longas */
const MAX_EVENTS = 1000;

/** Janela de reconciliação otimista (ms) — após isso, otimista "sozinho" */
const RECONCILE_WINDOW_MS = 30_000;

// ────────────────────────────────────────────────────────────────────────
// eventKey — hash estável POR TIPO
// ────────────────────────────────────────────────────────────────────────

/**
 * Chave estável para dedup. **Estratégias diferentes por tipo:**
 *
 *   - `user_input` otimista → inclui `clientTs` (usuário pode enviar a
 *     mesma frase 2x de propósito; cada clique tem clientTs único).
 *   - `user_input` não-otimista (eco) → só `type:text` (sinal canônico).
 *   - `tool_call` / `tool_result` → `toolId` (único por invocação).
 *   - `thinking` → texto SEM o sufixo `(Ns)` (duration muda entre ticks).
 *   - `claude_text` / `system` → `type:text` (conteúdo estável).
 *   - `interactive_menu` → título + opções.
 *
 * @see parseMessageStream.ts para origem dos campos.
 */
export function eventKey(e: StreamEvent): string {
  switch (e.type) {
    case "user_input":
      return e.optimistic && e.clientTs !== undefined
        ? `user_input:opt:${e.clientTs}:${e.text}`
        : `user_input:${e.text}`;

    case "claude_text":
    case "system":
      return `${e.type}:${e.text}`;

    case "tool_call":
      return e.toolId
        ? `tool_call:${e.toolId}`
        : `tool_call:${e.name ?? ""}:${e.args ?? ""}`;

    case "tool_result":
      return e.toolId
        ? `tool_result:${e.toolId}`
        : `tool_result:${e.text}`;

    case "thinking":
      // remove sufixo " (3s)" ou " (10s)" para que duration crescente
      // não gere chave nova a cada tick
      return `thinking:${(e.text ?? "").replace(/\s*\(\d+s?\)$/, "")}`;

    case "interactive_menu":
      return `menu:${e.title ?? ""}:${(e.options ?? []).join("|")}`;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Reconciliação otimista — FIFO
// ────────────────────────────────────────────────────────────────────────

/**
 * Tenta promover um otimista pendente para o eco recebido.
 *
 * **FIFO**: se o usuário enviou "ok" 2x em 5s (2 otimistas O1 e O2),
 * o primeiro eco casa com O1 (mais antigo), o segundo com O2.
 *
 * **Preserva posição e id** — o otimista não muda de lugar na timeline,
 * só perde a flag `optimistic` e ganha campos do servidor.
 *
 * @returns `true` se promoveu, `false` se não havia candidato.
 */
function tryReconcileOptimistic(
  events: StreamEvent[],
  byKey: Map<string, number>,
  echo: StreamEvent
): boolean {
  if (echo.type !== "user_input" || echo.optimistic) return false;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (
      e.type === "user_input" &&
      e.optimistic &&
      !e.reconciled &&
      e.text === echo.text &&
      e.clientTs !== undefined &&
      Math.abs(echo.timestamp - e.clientTs) < RECONCILE_WINDOW_MS
    ) {
      // Promove: preserva id + posição, limpa otimista, marca reconciliado.
      // Onda 5: preserva `attachments` locais (com previewUrl do browser) —
      // o eco do backend não reconstrói esses campos pois o tmux só recebeu
      // os paths das imagens. Manter o que o otimista tinha é o correto.
      const oldKey = eventKey(e);
      const promoted: StreamEvent = {
        ...e,
        ...echo,
        id: e.id,
        clientTs: e.clientTs,
        optimistic: false,
        reconciled: true,
        attachments: e.attachments ?? echo.attachments,
      };
      events[i] = promoted;

      // Atualiza byKey: remove chave otimista antiga, registra canônica.
      byKey.delete(oldKey);
      const newKey = eventKey(promoted);
      // Se já existe canônico com mesmo conteúdo (2ª frase igual já reconciliada),
      // não sobrescreve — mantém primeira como âncora de merge.
      if (!byKey.has(newKey)) byKey.set(newKey, i);

      return true;
    }
  }
  return false;
}

// ────────────────────────────────────────────────────────────────────────
// reduceEvents — principal
// ────────────────────────────────────────────────────────────────────────

/**
 * Aplica `incoming` sobre `prev` com dedup + reconciliação.
 *
 * Para cada evento de entrada:
 *   1. Se for eco de user_input → tenta reconciliar com otimista FIFO.
 *   2. Se já existe evento com mesma chave → merge in-place (update).
 *   3. Senão → push + registra no byKey.
 *   4. Aplica sliding window no fim.
 */
export function reduceEvents(
  prev: ChatState,
  incoming: StreamEvent[]
): ChatState {
  if (incoming.length === 0) return prev;

  // Copia defensiva — mutamos local, retornamos nova referência.
  const events = prev.events.slice();
  const byKey = new Map(prev.byKey);

  for (const ev of incoming) {
    // 1) Reconciliação otimista (ecos de user_input)
    if (tryReconcileOptimistic(events, byKey, ev)) continue;

    // 2) Merge ou push
    const key = eventKey(ev);
    const existingIdx = byKey.get(key);
    if (existingIdx !== undefined) {
      const existing = events[existingIdx];
      events[existingIdx] = {
        ...existing,
        ...ev,
        id: existing.id, // preserva id estável do cliente
        clientTs: existing.clientTs ?? ev.clientTs,
        // Onda 5: preserva anexos locais se o eco não os trouxer
        attachments: existing.attachments ?? ev.attachments,
      };
    } else {
      byKey.set(key, events.length);
      events.push(ev);
    }
  }

  // 3) Sliding window — descarta cabeça se exceder MAX_EVENTS
  if (events.length > MAX_EVENTS) {
    const drop = events.length - MAX_EVENTS;
    const trimmed = events.slice(drop);
    // Rebuild map com novos índices (O(N) uma vez a cada ~1000 eventos)
    const newByKey = new Map<string, number>();
    for (let i = 0; i < trimmed.length; i++) {
      newByKey.set(eventKey(trimmed[i]), i);
    }
    return { events: trimmed, byKey: newByKey };
  }

  return { events, byKey };
}

// ────────────────────────────────────────────────────────────────────────
// Helper de criação de evento otimista
// ────────────────────────────────────────────────────────────────────────

/**
 * Cria um StreamEvent marcado como otimista. Usado pelo hook ao clicar Enviar.
 */
export function makeOptimisticUserInput(
  id: string,
  text: string,
  clientTs: number = Date.now()
): StreamEvent {
  return {
    id,
    type: "user_input",
    text,
    timestamp: clientTs,
    clientTs,
    optimistic: true,
  };
}
