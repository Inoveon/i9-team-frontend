"use client";

import { useState } from "react";

interface InteractiveMenuProps {
  title: string;
  options: string[];
  onSelect?: (option: string) => void;
}

export function InteractiveMenu({ title, options, onSelect }: InteractiveMenuProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (option: string) => {
    if (selected) return; // já selecionado — desabilita
    setSelected(option);
    onSelect?.(option);
  };

  return (
    <div
      style={{
        margin: "6px 0",
        borderRadius: 10,
        border: "1px solid rgba(124,58,237,0.3)",
        background: "rgba(124,58,237,0.06)",
        overflow: "hidden",
        maxWidth: "88%",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "8px 14px",
          borderBottom: "1px solid rgba(124,58,237,0.15)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, color: "rgba(124,58,237,0.8)" }}>◈</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(200,180,255,0.9)",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          {title}
        </span>
        {selected && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: "rgba(0,255,136,0.6)",
              fontFamily: '"JetBrains Mono", monospace',
              letterSpacing: "0.06em",
            }}
          >
            ✓ respondido
          </span>
        )}
      </div>

      {/* Opções */}
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
        {options.map((opt, idx) => {
          const isSelected = selected === opt;
          const isDisabled = selected !== null && !isSelected;
          return (
            <button
              key={idx}
              onClick={() => handleSelect(opt)}
              disabled={isDisabled}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 12px",
                borderRadius: 7,
                border: isSelected
                  ? "1px solid rgba(0,255,136,0.5)"
                  : "1px solid rgba(124,58,237,0.2)",
                background: isSelected
                  ? "rgba(0,255,136,0.08)"
                  : isDisabled
                  ? "transparent"
                  : "rgba(124,58,237,0.05)",
                color: isSelected
                  ? "#00ff88"
                  : isDisabled
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(200,180,255,0.85)",
                fontSize: 12,
                fontFamily: '"JetBrains Mono", monospace',
                cursor: isDisabled ? "not-allowed" : "pointer",
                textAlign: "left",
                transition: "all 0.15s",
                opacity: isDisabled ? 0.4 : 1,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: isSelected
                    ? "2px solid #00ff88"
                    : "2px solid rgba(124,58,237,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 9,
                  color: isSelected ? "#00ff88" : "transparent",
                }}
              >
                {isSelected ? "●" : ""}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
