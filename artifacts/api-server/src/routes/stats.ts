import { Router, type IRouter } from "express";
import { GetPublicStatsResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/stats", async (_request, response): Promise<void> => {
  const result = await pool.query(`
    SELECT
      COALESCE(SUM(total_value_cents), 0) AS total_prize_cents,
      COALESCE(SUM(remaining_value_cents), 0) AS remaining_prize_cents
    FROM prize_pool
  `);
  const row = result.rows[0];
  const data = GetPublicStatsResponse.parse({
    totalPrizeCents: Number(row?.total_prize_cents ?? 0),
    remainingPrizeCents: Number(row?.remaining_prize_cents ?? 0),
  });

  response.setHeader(
    "Cache-Control",
    "public, max-age=2, s-maxage=5, stale-while-revalidate=30",
  );
  response.json(data);
});

export default router;