import {
  bigint,
  bigserial,
  boolean,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const cells = pgTable(
  "cells",
  {
    id: integer("id").primaryKey(),
    reservationToken: uuid("reservation_token").defaultRandom().notNull(),
    email: text("email"),
    status: text("status").notNull().default("reserved"),
    reservedAt: timestamp("reserved_at", { withTimezone: true }).defaultNow().notNull(),
    paymentId: text("payment_id").unique(),
    prizeValueCents: integer("prize_value_cents").notNull().default(0),
    emoji: text("emoji"),
    revealedBy: text("revealed_by"),
    certificateSentAt: timestamp("certificate_sent_at", { withTimezone: true }),
  },
  (table) => ({
    statusReservedAt: index("idx_cells_status_reserved_at").on(
      table.status,
      table.reservedAt,
    ),
  }),
);

export const prizePool = pgTable("prize_pool", {
  tierId: integer("tier_id").primaryKey(),
  label: text("label").notNull(),
  nominalValueCents: bigint("nominal_value_cents", { mode: "number" }).notNull(),
  totalValueCents: bigint("total_value_cents", { mode: "number" }).notNull(),
  totalPositions: integer("total_positions").notNull(),
  remainingValueCents: bigint("remaining_value_cents", { mode: "number" }).notNull(),
  remainingPositions: integer("remaining_positions").notNull(),
});

export const winningPositions = pgTable(
  "winning_positions",
  {
    cellId: integer("cell_id").primaryKey(),
    tierId: integer("tier_id")
      .notNull()
      .references(() => prizePool.tierId),
    claimed: boolean("claimed").notNull().default(false),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (table) => ({
    tier: index("idx_winning_positions_tier").on(table.tierId),
  }),
);

export const prizeTierBatch = pgTable("prize_tier_batch", {
  id: integer("id").primaryKey().default(1),
  commitHash: text("commit_hash").notNull(),
  revealedAt: timestamp("revealed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const payoutSafetyConfig = pgTable("payout_safety_config", {
  id: integer("id").primaryKey().default(1),
  safetyMarginBps: integer("safety_margin_bps").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text("updated_by"),
});

export const prizeCalculationLog = pgTable(
  "prize_calculation_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    cellId: integer("cell_id").notNull(),
    tierId: integer("tier_id").notNull(),
    poolRemainingBeforeCents: bigint("pool_remaining_before_cents", { mode: "number" }).notNull(),
    positionsRemainingBefore: integer("positions_remaining_before").notNull(),
    fairShareCents: bigint("cota_justa_cents", { mode: "number" }).notNull(),
    availableCashCents: bigint("caixa_disponivel_cents", { mode: "number" }).notNull(),
    safetyMarginBps: integer("safety_margin_bps").notNull(),
    safetyCapCents: bigint("teto_seguranca_cents", { mode: "number" }).notNull(),
    releasedValueCents: bigint("valor_liberado_cents", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tier: index("idx_prize_calculation_log_tier").on(table.tierId),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    cellId: integer("cell_id").notNull().references(() => cells.id),
    providerPaymentId: text("provider_payment_id").notNull().unique(),
    checkoutUrl: text("checkout_url").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("BRL"),
    status: text("status").notNull(),
    deviceId: text("device_id"),
    ipAddress: inet("ip_address").notNull(),
    userAgent: text("user_agent"),
    geoCountry: text("geo_country"),
    geoRegion: text("geo_region"),
    geoCity: text("geo_city"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => ({
    cellId: index("idx_payments_cell_id").on(table.cellId),
    ipAddress: index("idx_payments_ip_address").on(table.ipAddress),
    deviceId: index("idx_payments_device_id").on(table.deviceId),
    cellPending: uniqueIndex("idx_payments_cell_pending")
      .on(table.cellId)
      .where(sql`${table.status} = 'pending'`),
  }),
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    paymentId: text("payment_id").notNull(),
    cellId: integer("cell_id"),
    payload: jsonb("payload").notNull(),
    signatureValid: boolean("signature_valid").notNull(),
    result: text("result").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    paymentId: index("idx_webhook_events_payment_id").on(table.paymentId),
  }),
);

export const cashLedger = pgTable(
  "cash_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    entryType: text("entry_type").notNull(),
    cellId: integer("cell_id").notNull().references(() => cells.id),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dedup: uniqueIndex("idx_cash_ledger_dedup").on(table.entryType, table.cellId),
    typeCreated: index("idx_cash_ledger_type_created").on(
      table.entryType,
      table.createdAt,
    ),
  }),
);

export const cellSignatures = pgTable(
  "cell_signatures",
  {
    cellId: integer("cell_id").primaryKey().references(() => cells.id),
    platform: text("platform").notNull(),
    handle: text("handle").notNull(),
    moderationStatus: text("moderation_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    moderation: index("idx_cell_signatures_moderation").on(table.moderationStatus),
  }),
);

export const signatureDeletionLog = pgTable("signature_deletion_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  cellId: integer("cell_id").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).defaultNow().notNull(),
  requestedVia: text("requested_via"),
  deletedBy: text("deleted_by"),
});