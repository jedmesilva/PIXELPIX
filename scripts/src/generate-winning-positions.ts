import { createHash, randomInt } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const TOTAL_CELLS = 1_000_000;
const MAX_POOL_VALUE_CENTS = 100_000_000;
const CHUNK_SIZE = 5_000;

const TIERS = [
  { id: 1, label: "R$10", quantidade: 40_000, nominalValueCents: 1_000 },
  { id: 2, label: "R$100", quantidade: 3_000, nominalValueCents: 10_000 },
  { id: 3, label: "R$1.000", quantidade: 150, nominalValueCents: 100_000 },
  { id: 4, label: "R$10.000", quantidade: 10, nominalValueCents: 1_000_000 },
  { id: 5, label: "R$50.000", quantidade: 1, nominalValueCents: 5_000_000 },
] as const;

type WinningPosition = { cellId: number; tierId: number };

function validateTierConfiguration() {
  const ids = new Set<number>();
  let totalPositions = 0;
  let totalPoolCents = 0;

  for (const tier of TIERS) {
    if (ids.has(tier.id)) {
      throw new Error(`Tier duplicado: ${tier.id}`);
    }
    ids.add(tier.id);
    if (!Number.isInteger(tier.id) || tier.id <= 0) {
      throw new Error(`Tier inválido: ${tier.id}`);
    }
    if (!Number.isInteger(tier.quantidade) || tier.quantidade < 0) {
      throw new Error(`Quantidade inválida no tier ${tier.id}.`);
    }
    if (
      !Number.isInteger(tier.nominalValueCents) ||
      tier.nominalValueCents < 0
    ) {
      throw new Error(`Valor nominal inválido no tier ${tier.id}.`);
    }
    totalPositions += tier.quantidade;
    totalPoolCents += tier.quantidade * tier.nominalValueCents;
  }

  if (totalPositions === 0) {
    throw new Error("A configuração precisa ter ao menos uma posição premiada.");
  }
  if (totalPositions > TOTAL_CELLS) {
    throw new Error("O total de posições premiadas ultrapassa o grid.");
  }
  if (totalPoolCents !== MAX_POOL_VALUE_CENTS) {
    throw new Error(
      `O pool precisa fechar exatamente em R$ ${(MAX_POOL_VALUE_CENTS / 100).toFixed(2)}; ` +
        `a configuração atual fecha em R$ ${(totalPoolCents / 100).toFixed(2)}.`,
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
  for (const tier of TIERS) {
    for (let index = 0; index < tier.quantidade; index += 1) {
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

function calcularCommitHash(positions: WinningPosition[]) {
  const content = [...positions]
    .sort((left, right) => left.cellId - right.cellId)
    .map((position) => `${position.cellId}:${position.tierId}`)
    .join(",");
  return createHash("sha256").update(content).digest("hex");
}

async function inserirEmLotes(
  client: pg.PoolClient,
  positions: WinningPosition[],
) {
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
    console.log(
      `Inseridas ${Math.min(offset + CHUNK_SIZE, positions.length)} / ${positions.length}`,
    );
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL é obrigatório para gerar o lote de prêmios.");
  }
  const { totalPositions, totalPoolCents } = validateTierConfiguration();

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const existing = await client.query(
      "SELECT id FROM prize_tier_batch WHERE id = 1",
    );
    if (existing.rows.length) {
      throw new Error(
        "prize_tier_batch já existe; este lote só pode ser gerado uma vez.",
      );
    }

    const ids = sortearIdsUnicos(TOTAL_CELLS, totalPositions);
    const tiers = gerarAtribuicaoDeTiers();
    const positions = ids.map((cellId, index) => ({
      cellId,
      tierId: tiers[index],
    }));
    const commitHash = calcularCommitHash([...positions]);
    console.log(`Commit hash (publique antes da venda): ${commitHash}`);

    await client.query("BEGIN");
    for (const tier of TIERS) {
      const totalValueCents = tier.quantidade * tier.nominalValueCents;
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
          tier.quantidade,
        ],
      );
    }
    await inserirEmLotes(client, positions);
    await client.query(
      `UPDATE cells
          SET emoji = '💰'
        WHERE id IN (SELECT cell_id FROM winning_positions)`,
    );
    await client.query(
      `INSERT INTO prize_tier_batch (id, commit_hash) VALUES (1, $1)`,
      [commitHash],
    );
    await client.query("COMMIT");
    console.log(
      `Concluído: ${totalPositions} posições e R$ ${(totalPoolCents / 100).toFixed(2)} no pool.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error("Falha ao gerar posições premiadas:", error);
  process.exitCode = 1;
});