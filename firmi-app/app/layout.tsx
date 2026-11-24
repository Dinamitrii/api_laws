import UsageBanner from '../components/usage-banner';
import Link from 'next/link';
import JsonLd from '../components/json-ld';
import type { Metadata, Viewport } from "next";
import "./globals.css";

import { GoogleAnalytics } from "@/components/google-analytics";


export const metadata: Metadata = {
  title: "Фирмено досие — Фирми и документи",
  description: "Справки за фирми и попълване на документни шаблони.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/favicon/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#176b51",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg">
    
    
    <head>
  <GoogleAnalytics />
  <JsonLd />
  <link rel="alternate" type="text/plain" title="llms.txt" href="/llms.txt" />
  <link rel="alternate" type="application/json" title="ai-catalog" href="/ai-catalog.json" />
  <script
    id="poper-js-script"
    defer
    data-keep-script="true"
    data-account-id="1491f0de70be08155c17ec34ba920623"
    src="https://app.poper.ai/share/poper.js"
  />
</head>
    
      <body className="antialiased"><UsageBanner />{children}<Link href="/auth" style={{ position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", zIndex: 50, background: "#176b51", color: "white", padding: "10px 16px", borderRadius: 10 }}>Профил / Изход</Link></body>
    </html>
  );
}
