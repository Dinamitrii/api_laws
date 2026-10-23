import type { Metadata } from "next";
import { GoogleAnalytics } from "../components/google-analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Фирмено досие — Фирми и документи",
  description: "Справки за фирми и попълване на документни шаблони.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg">
      <body className="antialiased">
        {children}
        <GoogleAnalytics />
        <a href="/auth" style={{ position: "fixed", right: 18, bottom: 18, zIndex: 50, background: "#176b51", color: "white", padding: "10px 16px", borderRadius: 10 }}>Профил / Изход</a>
      </body>
    </html>
  );
}
