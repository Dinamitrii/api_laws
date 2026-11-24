"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export default function JsonLd() {
  const origin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
  if (!origin) return null;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: "Вестерос БГ ЕООД",
        url: origin,
        logo: `${origin}/brand/vesterosbg-brand-logo.svg`,
        email: "office@vesterosbg.online",
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin,
        name: "Фирмено досие",
        inLanguage: "bg",
        publisher: { "@id": `${origin}/#organization` },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}