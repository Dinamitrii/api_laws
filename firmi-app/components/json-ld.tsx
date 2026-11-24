"use client";
import { useSyncExternalStore } from "react";
import { FAQ, STEPS } from "../lib/faq";

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
      {
        "@type": "SoftwareApplication",
        "@id": `${origin}/#app`,
        name: "Фирмено досие",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any",
        url: origin,
        inLanguage: "bg",
        description:
          "Уеб приложение за фирмени справки и попълване на документни шаблони.",
        featureList: [
          "Търсене на фирми по име или ЕИК",
          "Данни от Магистрат, eik.bg и TheCompanyBook",
          "Попълване на текстови шаблони",
          "Изтегляне като TXT или печат / PDF",
        ],
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "BGN",
          description: "Безплатен план: 35 заявки на месец.",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${origin}/#faq`,
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "HowTo",
        "@id": `${origin}/#howto`,
        name: "Как да използваш Фирмено досие",
        step: STEPS.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.name,
          text: s.text,
        })),
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