"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { api } from "@/lib/api";
import type { TeamConfig } from "@/types";

export default function ConfigPage() {
  const [configs, setConfigs] = useState<TeamConfig[]>([]);
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api
      .get<TeamConfig[]>("/teams/config")
      .then((data) => {
        setConfigs(data);
        setRaw(JSON.stringify(data, null, 2));
      })
      .catch(() => {
        setRaw("[]");
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const parsed = JSON.parse(raw) as TeamConfig[];
      await api.put("/teams/config", parsed);
      setConfigs(parsed);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", padding: "32px 24px", maxWidth: 900, margin: "0 auto" }}>
      {/* Nav */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
          Dashboard
        </Link>
        <span style={{ color: "var(--border)", margin: "0 8px" }}>/</span>
        <span style={{ fontSize: 13, color: "var(--neon-blue)" }}>Configuracao</span>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "var(--text)",
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          Editor de Teams
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
          Edite o JSON de configuracao dos teams e salve.
        </p>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              backgroundColor: "var(--surface-2)",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
              teams.json — {configs.length} team{configs.length !== 1 ? "s" : ""}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {success && (
                <span style={{ fontSize: 12, color: "var(--neon-green)" }}>Salvo!</span>
              )}
              {error && (
                <span style={{ fontSize: 12, color: "var(--neon-red, #ff3864)" }}>{error}</span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--neon-blue)",
                  background: "transparent",
                  color: "var(--neon-blue)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>

          {/* Editor */}
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
            style={{
              width: "100%",
              minHeight: 500,
              padding: 20,
              backgroundColor: "var(--surface)",
              color: "var(--neon-blue)",
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontSize: 13,
              lineHeight: 1.6,
              border: "none",
              outline: "none",
              resize: "vertical",
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
