import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "i9 Team — Agent Dashboard",
  description: "Maestri multi-agent orchestration dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body
        style={{
          backgroundColor: "var(--bg)",
          color: "var(--text)",
          minHeight: "100vh",
        }}
      >
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#0d1117",
              border: "1px solid rgba(0,212,255,0.2)",
              color: "#e2e8f0",
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 13,
            },
          }}
        />
      </body>
    </html>
  );
}
