declare namespace Cloudflare {
  interface Env {
    COMPANYBOOK_API_KEY?: string;
    MAGISTRAT_API_KEY?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}

declare namespace Cloudflare { interface Env { AUTH_DB?: D1Database; TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET_KEY?: string; AUTH_PEPPER?: string; } }
