import { createHash, randomInt } from "node:crypto";
import type { Pool, PoolClient } from "pg";

export const TOTAL_CELLS = 1_000_000;
export const MAX_POOL_VALUE_CENTS = 100_000_000;
const CHUNK_SIZE = 5_000;
const PRIZE_BATCH_LOCK_KEY = 8_347_291;

export const PRIZE_TIERS = [
  { id: 1, label: "R$10", quantity: 40_000, nominalValueCents: 1_000 },
  { id: 2, label: "R$100", quantity: 3_000, nominalValueCents: 10_000 },
  { id: 3, label: "R$1.000", quantity: 150, nominalValueCents: 100_000 },
  { id: 4, label: "R$10.000", quantity: 10, nominalValueCents: 1_000_000 },
  { id: 5, label: "R$50.000", quantity: 1, nominalValueCents: 5_000_000 },
] as const;

type WinningPosition = { cellId: number; tierId: number };

export type PrizeBatchTier = {
  id: number;
  label: string;
  quantity: number;
  nominalValueCents: number;
  totalValueCents: number;
};

export type PrizeBatchSummary = {
  status: "not_generated" | "generated";
  commitHash: string | null;
  createdAt: string | null;
  totalPositions: number;
  totalValueCents: number;
  tiers: PrizeBatchTier[];
  canGenerate: boolean;
};

export class PrizeBatchAlreadyExistsError extends Error {
  constructor() {
    super("O lote de prêmios já foi gerado e não pode ser substituído.");
    this.name = "PrizeBatchAlreadyExistsError";
  }
}

function configuredTiers(): PrizeBatchTier[] {
  return PRIZE_TIERS.map((tier) => ({
    id: tier.id,
    label: tier.label,
    quantity: tier.quantity,
    nominalValueCents: tier.nominalValueCents,
    totalValueCents: tier.quantity * tier.nominalValueCents,
  }));
}

function validateTierConfiguration() {
  const ids = new Set<number>();
  let totalPositions = 0;
  let totalPoolCents = 0;

  for (const tier of PRIZE_TIERS) {
    if (ids.has(tier.id) || !Number.isInteger(tier.id) || tier.id <= 0) {
      throw new Error(`Tier inválido ou duplicado: ${tier.id}`);
    }
    ids.add(tier.id);
    totalPositions += tier.quantity;
    totalPoolCents += tier.quantity * tier.nominalValueCents;
  }

  if (totalPositions === 0 || totalPositions > TOTAL_CELLS) {
    throw new Error("A configuração de prêmios não cabe no grid.");
  }
  if (totalPoolCents !== MAX_POOL_VALUE_CENTS) {
    throw new Error(
      `O pool precisa fechar em ${MAX_POOL_VALUE_CENTS} centavos; encontrou ${totalPoolCents}.`,
    );
  }
  return { totalPositions, totalPoolCents };
}

function sortearIdsUnicos(total: number, count: number) {
  const chosen = new Set<number>();
  while (chosen.size < count) chosen.add(randomInt(0, total));
  return [...chosen];
}

function gerarAtribuicaoDeTiers() {
  const assignments: number[] = [];
  for (const tier of PRIZE_TIERS) {
    for (let index = 0; index < tier.quantity; index += 1) {
      assignments.push(tier.id);
    }
  }
  for (let index = assignments.length - 1; index > 0; index -= 1) {
    const other = randomInt(0, index + 1);
    [assignments[index], assignments[other]] = [
      assignments[other],
      assignments[index],
    ];
  }
  return assignments;
}

function calculateCommitHash(positions: WinningPosition[]) {
  const content = [...positions]
    .sort((left, right) => left.cellId - right.cellId)
    .map((position) => `${position.cellId}:${position.tierId}`)
    .join(",");
  return createHash("sha256").update(content).digest("hex");
}

async function insertPositions(client: PoolClient, positions: WinningPosition[]) {
  for (let offset = 0; offset < positions.length; offset += CHUNK_SIZE) {
    const batch = positions.slice(offset, offset + CHUNK_SIZE);
    const params: number[] = [];
    const values = batch.map((position, index) => {
      const base = index * 2;
      params.push(position.cellId, position.tierId);
      return `($${base + 1}, $${base + 2})`;
    });
    await client.query(
      `INSERT INTO winning_positions (cell_id, tier_id)
       VALUES ${values.join(",")}`,
      params,
    );
  }
}

function generatedSummary(commitHash: string, createdAt: Date | string): PrizeBatchSummary {
  const tiers = configuredTiers();
  return {
    status: "generated",
    commitHash,
    createdAt: new Date(createdAt).toISOString(),
    totalPositions: tiers.reduce((total, tier) => total + tier.quantity, 0),
    totalValueCents: tiers.reduce((total, tier) => total + tier.totalValueCents, 0),
    tiers,
    canGenerate: false,
  };
}

export async function getPrizeBatchStatus(pool: Pool): Promise<PrizeBatchSummary> {
  const [batch, tiers] = await Promise.all([
    pool.query("SELECT commit_hash, created_at FROM prize_tier_batch WHERE id = 1"),
    pool.query(
      `SELECT tier_id, label, nominal_value_cents, total_value_cents, total_positions
         FROM prize_pool
        ORDER BY tier_id`,
    ),
  ]);

  const batchRow = batch.rows[0];
  if (!batchRow) {
    const configured = configuredTiers();
    return {
      status: "not_generated",
      commitHash: null,
      createdAt: null,
      totalPositions: configured.reduce((total, tier) => total + tier.quantity, 0),
      totalValueCents: configured.reduce((total, tier) => total + tier.totalValueCents, 0),
      tiers: configured,
      canGenerate: true,
    };
  }

  const storedTiers: PrizeBatchTier[] = tiers.rows.map((row) => ({
    id: Number(row.tier_id),
    label: String(row.label),
    quantity: Number(row.total_positions),
    nominalValueCents: Number(row.nominal_value_cents),
    totalValueCents: Number(row.total_value_cents),
  }));
  return {
    status: "generated",
    commitHash: String(batchRow.commit_hash),
    createdAt: new Date(batchRow.created_at).toISOString(),
    totalPositions: storedTiers.reduce((total, tier) => total + tier.quantity, 0),
    totalValueCents: storedTiers.reduce((total, tier) => total + tier.totalValueCents, 0),
    tiers: storedTiers,
    canGenerate: false,
  };
}

export async function generatePrizeBatch(pool: Pool): Promise<PrizeBatchSummary> {
  const { totalPositions } = validateTierConfiguration();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [PRIZE_BATCH_LOCK_KEY]);

    const existing = await client.query(
      "SELECT id FROM prize_tier_batch WHERE id = 1",
    );
    if (existing.rows.length > 0) {
      throw new PrizeBatchAlreadyExistsError();
    }

    const partial = await client.query(
      `SELECT
         (SELECT COUNT(*) FROM prize_pool) AS pools,
         (SELECT COUNT(*) FROM winning_positions) AS positions`,
    );
    if (
      Number(partial.rows[0]?.pools ?? 0) > 0 ||
      Number(partial.rows[0]?.positions ?? 0) > 0
    ) {
      throw new Error(
        "O banco contém dados de prêmios sem um lote selado; a geração foi bloqueada para análise.",
      );
    }

    const ids = sortearIdsUnicos(TOTAL_CELLS, totalPositions);
    const tiers = gerarAtribuicaoDeTiers();
    const positions = ids.map((cellId, index) => ({
      cellId,
      tierId: tiers[index],
    }));
    const commitHash = calculateCommitHash(positions);

    for (const tier of PRIZE_TIERS) {
      const totalValueCents = tier.quantity * tier.nominalValueCents;
      await client.query(
        `INSERT INTO prize_pool
           (tier_id, label, nominal_value_cents, total_value_cents,
            total_positions, remaining_value_cents, remaining_positions)
         VALUES ($1, $2, $3, $4, $5, $4, $5)`,
        [
          tier.id,
          tier.label,
          tier.nominalValueCents,
          totalValueCents,
          tier.quantity,
        ],
      );
    }

    await insertPositions(client, positions);
    await client.query(
      `UPDATE cells
          SET emoji = '💰'
        WHERE id IN (SELECT cell_id FROM winning_positions)`,
    );
    const batch = await client.query(
      `INSERT INTO prize_tier_batch (id, commit_hash)
       VALUES (1, $1)
       RETURNING created_at`,
      [commitHash],
    );
    await client.query("COMMIT");

    return generatedSummary(commitHash, batch.rows[0].created_at);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}