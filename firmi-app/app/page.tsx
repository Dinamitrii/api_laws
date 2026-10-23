import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '../lib/firmi-seo-manifest';

export const metadata: Metadata = {
  title: 'Фирми — фирмени справки и документи | Predictorian',
  description: 'Търсене на фирми, преглед на фирмени данни и попълване на текстови шаблони. Справки чрез TheCompanyBook и Магистрат след вход в профил.',
  alternates: { canonical: `${SITE_URL}/` },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Фирми — от справката до документа',
    description: 'Фирмени данни и шаблони за документи в едно работно пространство.',
    url: `${SITE_URL}/`,
    siteName: 'Фирми · Predictorian', locale: 'bg_BG', type: 'website',
  },
};

export default function Landing() {
  const features = [
    ['01', 'Намери фирмата', 'Търси по име или ЕИК и прегледай данните от свързаните източници.'],
    ['02', 'Подреди информацията', 'Работи с наименование, адрес, представители и контакти. Провери и допълни нужните полета.'],
    ['03', 'Подготви документа', 'Използвай текстов шаблон, попълни го с фирмени данни и изтегли резултата или го отпечатай.'],
  ];
  return <div className="firmi-landing">
    <style>{`
      .firmi-landing{background:#f6f7f3;color:#18332a;min-height:100vh;font-family:Arial,system-ui,sans-serif}
      .firmi-landing *{box-sizing:border-box}.firmi-landing a{text-decoration:none}
      .firmi-landing .wrap{max-width:1120px;margin:auto;padding:0 26px}
      .firmi-landing header{display:flex;justify-content:space-between;align-items:center;padding:28px 0;border-bottom:1px solid #dce3d9;gap:18px}
      .firmi-landing .brand{font-size:23px;font-weight:800;color:#18332a}.firmi-landing .brand small{font-size:11px;display:block;letter-spacing:2px;margin-top:5px;color:#4b6254}
      .firmi-landing nav{display:flex;align-items:center;gap:22px}.firmi-landing nav a{color:#18332a;font-size:15px}
      .firmi-landing .hero{padding:90px 0 80px;max-width:850px}.firmi-landing .eyebrow{font-size:12px;letter-spacing:2px;font-weight:bold;color:#315f46}
      .firmi-landing h1{font-size:clamp(40px,6vw,74px);line-height:1.07;letter-spacing:-2px;margin:23px 0}
      .firmi-landing .lead{font-size:20px;line-height:1.7;color:#43584d;max-width:640px}.firmi-landing .cta{display:inline-block;background:#176b51;color:white!important;border-radius:9px;padding:15px 23px;font-weight:700;margin:17px 0}
      .firmi-landing .sub{font-size:13px;color:#4b6254}.firmi-landing h2{font-size:30px;letter-spacing:-.7px}
      .firmi-landing .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:30px 0 65px}
      .firmi-landing article{background:white;border:1px solid #dce3d9;border-radius:14px;padding:27px}.firmi-landing article span{font:14px monospace;color:#315f46}.firmi-landing h3{font-size:21px;margin:25px 0 14px}.firmi-landing article p{font-size:16px;line-height:1.8;color:#43584d}
      .firmi-landing .note{border-top:1px solid #dce3d9;padding:28px 0 50px;max-width:760px;font-size:16px;line-height:1.8;color:#43584d}
      .firmi-landing footer{border-top:1px solid #dce3d9;padding:26px 0 75px;font-size:13px;color:#4b6254}
      @media(max-width:700px){.firmi-landing .hero{padding:55px 0}.firmi-landing .cards{grid-template-columns:1fr}.firmi-landing nav{gap:14px}.firmi-landing nav a{font-size:13px}.firmi-landing .wrap{padding:0 20px}}
    `}</style>
    <div className="wrap">
      <header><Link href="/admin">Администратор</Link><Link href="/billing">Плащания</Link><Link className="brand" href="/">Фирми<small>BY PREDICTORIAN</small></Link><nav aria-label="Основна навигация"><a href="#how">Как работи</a><Link href="/app">Към приложението ↗</Link></nav></header>
      <main>
        <section className="hero"><p className="eyebrow">ФИРМЕНИ ДАННИ · ТВОИТЕ ДОКУМЕНТИ</p><h1>От фирмената справка<br/>до готовия документ.</h1><p className="lead">Намери фирмата, прегледай информацията и попълни своя шаблон. Събери работата с фирмени данни и документи на едно място.</p><Link className="cta" href="/app">Отвори Фирми →</Link><p className="sub">Необходим е профил. Входът и регистрацията са в приложението.</p></section>
        <section id="how" aria-labelledby="how-title"><h2 id="how-title">Три стъпки. Едно работно пространство.</h2><div className="cards">{features.map(([number,title,text])=><article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
        <section className="note"><h2>Информация с ясен източник</h2><p>Приложението използва интеграции с TheCompanyBook и Магистрат. Наличността на данните зависи от съответния източник и справка. Проверявай информацията преди използване в документи.</p><p>Фирмените справки и работното пространство са достъпни след вход в профил.</p></section>
      </main><footer>Фирми · Predictorian — фирмени справки и шаблони за документи.</footer>
    </div>
  </div>;
}
