"use client";

interface UserBubbleProps {
  text: string;
}

export function UserBubble({ text }: UserBubbleProps) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
      <div
        style={{
          maxWidth: "80%",
          padding: "10px 14px",
          borderRadius: "16px 16px 4px 16px",
          background: "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(0,212,255,0.15) 100%)",
          border: "1px solid rgba(124,58,237,0.35)",
          color: "#e2e8f0",
          fontSize: 13,
          lineHeight: 1.55,
          fontFamily: "system-ui, sans-serif",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          boxShadow: "0 0 12px rgba(124,58,237,0.1)",
        }}
      >
        {text}
      </div>
    </div>
  );
}
