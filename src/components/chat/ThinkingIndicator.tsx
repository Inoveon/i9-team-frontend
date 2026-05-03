"use client";

// keyframe declarado uma vez fora do componente — evita múltiplas tags <style> no DOM
const PULSE_STYLE = `@keyframes pulse-dot {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}`;

let _styleInjected = false;
function ensureStyle() {
  if (typeof document === "undefined" || _styleInjected) return;
  const el = document.createElement("style");
  el.textContent = PULSE_STYLE;
  document.head.appendChild(el);
  _styleInjected = true;
}

interface ThinkingIndicatorProps {
  text?: string;
}

export function ThinkingIndicator({ text }: ThinkingIndicatorProps) {
  ensureStyle();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, opacity: 0.65 }}>
      <span style={{ fontSize: 10, color: "#7c3aed", fontFamily: "monospace" }}>
        {text ?? "thinking"}
      </span>
      <span style={{ display: "flex", gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#7c3aed",
              display: "inline-block",
              animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </span>
    </div>
  );
}
