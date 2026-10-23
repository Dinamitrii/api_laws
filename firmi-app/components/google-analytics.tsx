// Google Measurement IDs are public. Keep the provided tag available in the
// static landing build even when the deploy environment does not load .env.local.
const configuredMeasurementId = process.env.GOOGLE_ANALYTICS_GTAG?.trim();
const measurementId = /^G-[A-Z0-9]+$/i.test(configuredMeasurementId ?? "")
  ? configuredMeasurementId
  : "G-EEEPRGM118";

export function GoogleAnalytics() {
  return (
    <>
      <script
        async
        data-firmi-google-tag="true"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <script
        id="firmi-google-analytics"
        data-firmi-google-tag="true"
        dangerouslySetInnerHTML={{ __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');` }}
      />
    </>
  );
}
