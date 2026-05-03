"use client";

interface SystemBadgeProps {
  text: string;
}

export function SystemBadge({ text }: SystemBadgeProps) {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
      <span style={{
        fontSize: 10,
        color: "rgba(255,255,255,0.28)",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 20,
        padding: "2px 10px",
        fontFamily: '"JetBrains Mono", monospace',
        letterSpacing: "0.04em",
      }}>
        {text}
      </span>
    </div>
  );
}
