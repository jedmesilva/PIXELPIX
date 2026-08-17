---
name: Supabase connection verification
description: The app keeps Drizzle/PostgreSQL for transactional work and verifies the Supabase project before the API starts.
---

The backend must use the Supabase PostgreSQL connection through DATABASE_URL for Drizzle transactions, while SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY verify the REST project identity and required schema during startup. The anonymous key is not needed server-side.

**Why:** The Supabase variables can exist without being used by a PostgreSQL client, which can silently point the app at a different database. Failing closed is safer for PIXELPIX because reservations, payments, prizes, and the cash ledger must share one source of truth.

**How to apply:** Preserve the startup verification when changing database initialization, deployment variables, or schema setup. Do not expose service-role credentials or move them into frontend code.