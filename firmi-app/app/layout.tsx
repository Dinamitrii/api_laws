import type { Metadata } from "next";
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
