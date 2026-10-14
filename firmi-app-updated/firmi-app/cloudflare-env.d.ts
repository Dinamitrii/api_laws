declare namespace Cloudflare {
  interface Env {
    COMPANYBOOK_API_KEY?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
