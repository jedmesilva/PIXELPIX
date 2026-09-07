import pg from "pg";
import {
  generatePrizeBatch,
  PrizeBatchAlreadyExistsError,
} from "@workspace/prize-engine";

const { Pool } = pg;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL é obrigatório para gerar o lote de prêmios.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const batch = await generatePrizeBatch(pool);
    console.log(`Commit hash (publique antes da venda): ${batch.commitHash}`);
    console.log(
      `Concluído: ${batch.totalPositions} posições e R$ ${(batch.totalValueCents / 100).toFixed(2)} no pool.`,
    );
  } catch (error) {
    if (error instanceof PrizeBatchAlreadyExistsError) {
      console.error(error.message);
    }
    throw error;
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error("Falha ao gerar posições premiadas:", error);
  process.exitCode = 1;
});