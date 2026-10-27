/// <reference types="@cloudflare/workers-types" />

// The starter's optional D1 source is still type-checked, even though the
// scheduling app uses its NestJS/PostgreSQL API rather than this binding.
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
  }
}
