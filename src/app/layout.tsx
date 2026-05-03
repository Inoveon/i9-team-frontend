import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ShellWrapper } from "@/components/layout/ShellWrapper";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

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
    <html lang="pt-BR" className={`dark ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body
        style={{
          backgroundColor: "var(--bg)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
          minHeight: "100vh",
        }}
      >
        <ShellWrapper>{children}</ShellWrapper>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(32px)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#f0f0f0",
              fontFamily: 'var(--font-mono), ui-monospace, monospace',
              fontSize: 13,
            },
          }}
        />
      </body>
    </html>
  );
}
