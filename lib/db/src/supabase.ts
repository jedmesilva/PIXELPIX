import type { Pool } from "pg";

const EXPECTED_TABLES = [
  "cells",
  "prize_pool",
  "winning_positions",
  "prize_tier_batch",
  "payout_safety_config",
  "prize_calculation_log",
  "payments",
  "webhook_events",
  "cash_ledger",
  "prize_redemption_requests",
  "cell_signatures",
  "signature_deletion_log",
] as const;

const SUPABASE_REQUEST_TIMEOUT_MS = 10_000;

export type SupabaseConnectionStatus = {
  provider: "supabase";
  projectRef: string;
  verifiedTableCount: number;
};

function projectRefFromSupabaseUrl(value: URL) {
  const hostname = value.hostname.toLowerCase();
  const suffix = ".supabase.co";

  if (!hostname.endsWith(suffix)) return null;
  const ref = hostname.slice(0, -suffix.length).split(".")[0];
  return ref && ref !== "www" ? ref : null;
}

function databaseProjectRefs(value: URL) {
  const refs = new Set<string>();
  const hostname = value.hostname.toLowerCase();

  const directMatch = hostname.match(/^db\.([^.]+)\.supabase\.co$/);
  if (directMatch?.[1]) refs.add(directMatch[1]);

  const username = decodeURIComponent(value.username);
  const poolerMatch = username.match(/^postgres\.([^.]+)$/);
  if (poolerMatch?.[1]) refs.add(poolerMatch[1]);

  return refs;
}

function requireSupabaseConfig() {
  const rawSupabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!rawSupabaseUrl) {
    throw new Error("SUPABASE_URL must be set for the database identity check.");
  }
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be set for the server-side database identity check.",
    );
  }
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set for the PostgreSQL connection.");
  }

  let supabaseUrl: URL;
  let postgresUrl: URL;
  try {
    supabaseUrl = new URL(rawSupabaseUrl);
    postgresUrl = new URL(databaseUrl);
  } catch {
    throw new Error("SUPABASE_URL or DATABASE_URL is not a valid URL.");
  }

  if (!["http:", "https:"].includes(supabaseUrl.protocol)) {
    throw new Error("SUPABASE_URL must use HTTP or HTTPS.");
  }
  if (!["postgres:", "postgresql:"].includes(postgresUrl.protocol)) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL.");
  }

  const supabaseProjectRef = projectRefFromSupabaseUrl(supabaseUrl);
  const postgresHostname = postgresUrl.hostname.toLowerCase();
  const isSupabasePostgresHost =
    postgresHostname.endsWith(".supabase.co") ||
    postgresHostname.includes(".pooler.supabase.com");

  if (!isSupabasePostgresHost) {
    throw new Error(
      "DATABASE_URL não aponta para um host PostgreSQL do Supabase configurado.",
    );
  }

  const databaseRefs = databaseProjectRefs(postgresUrl);
  if (
    supabaseProjectRef &&
    databaseRefs.size > 0 &&
    !databaseRefs.has(supabaseProjectRef)
  ) {
    throw new Error(
      "DATABASE_URL e SUPABASE_URL apontam para projetos Supabase diferentes.",
    );
  }

  return { supabaseUrl, serviceRoleKey, supabaseProjectRef };
}

async function verifySupabaseRestApi(
  supabaseUrl: URL,
  serviceRoleKey: string,
) {
  const endpoint = new URL("/rest/v1/cells", supabaseUrl);
  endpoint.searchParams.set("select", "id");
  endpoint.searchParams.set("limit", "0");

  const response = await fetch(endpoint, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "count=exact",
    },
    signal: AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Supabase REST verification failed with HTTP ${response.status}.`,
    );
  }
}

async function verifyPostgresSchema(pool: Pool) {
  const result = await pool.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = $2
        AND table_name = ANY($3::text[])
    `,
    ["public", "BASE TABLE", [...EXPECTED_TABLES]],
  );

  const present = new Set(result.rows.map((row) => row.table_name));
  const missing = EXPECTED_TABLES.filter((table) => !present.has(table));

  if (missing.length > 0) {
    throw new Error(
      `Supabase schema is missing required tables: ${missing.join(", ")}.`,
    );
  }

  return present.size;
}

export async function verifySupabaseConnection(
  pool: Pool,
): Promise<SupabaseConnectionStatus> {
  const { supabaseUrl, serviceRoleKey, supabaseProjectRef } =
    requireSupabaseConfig();

  await verifySupabaseRestApi(supabaseUrl, serviceRoleKey);
  const verifiedTableCount = await verifyPostgresSchema(pool);

  return {
    provider: "supabase",
    projectRef: supabaseProjectRef ?? "verified",
    verifiedTableCount,
  };
}