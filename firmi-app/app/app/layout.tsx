import type { Metadata, Viewport } from "next";

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
      <body className="antialiased">{children}<a href="/auth" style={{ position: "fixed", right: 18, bottom: 18, zIndex: 50, background: "#176b51", color: "white", padding: "10px 16px", borderRadius: 10 }}>Профил / Изход</a></body>
    </html>
  );
}
