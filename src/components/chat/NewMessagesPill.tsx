"use client";

/**
 * NewMessagesPill — Indicador de mensagens novas abaixo do viewport.
 *
 * Aparece quando:
 *   - O usuário não está no fim da timeline (`isAtBottom === false`).
 *   - Chegaram eventos novos desde que ele saiu do fim (`hasNew === true`).
 *
 * Clique → scroll suave até o fim (responsabilidade do pai via `onClick`).
 *
 * Decisão de UX: sem contagem (Lee pediu "uma seta"). Contagem pode ser
 * adicionada em v2 com `lastSeenIndex` se houver demanda.
 */

interface NewMessagesPillProps {
  visible: boolean;
  onClick: () => void;
}

export function NewMessagesPill({ visible, onClick }: NewMessagesPillProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ir para mensagens mais recentes"
      style={{
        position: "absolute",
        left: "50%",
        bottom: "100%",
        transform: "translate(-50%, -8px)",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "rgba(0, 212, 255, 0.12)",
        border: "1px solid rgba(0, 212, 255, 0.4)",
        color: "var(--neon-blue, #00d4ff)",
        cursor: "pointer",
        backdropFilter: "blur(8px)",
        boxShadow: "0 0 16px rgba(0, 212, 255, 0.25)",
        transition: "background 0.15s, border-color 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(0, 212, 255, 0.2)";
        e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.7)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(0, 212, 255, 0.12)";
        e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.4)";
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}
