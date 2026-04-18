import type { Metadata } from "next";
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
    <html lang="pt-BR" className="dark">
      <body
        style={{
          backgroundColor: "var(--bg)",
          color: "var(--text)",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
