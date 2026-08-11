import {
  boolean,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  bigserial,
  sql,
} from "drizzle-orm/pg-core";

export const prizes = pgTable("prizes", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  weight: integer("weight").notNull(),
  stock: integer("stock"),
  valueCents: integer("value_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const cells = pgTable(
  "cells",
  {
    id: integer("id").primaryKey(),
    reservationToken: uuid("reservation_token").defaultRandom().notNull(),
    email: text("email"),
    status: text("status").notNull().default("reserved"),
    reservedAt: timestamp("reserved_at").defaultNow().notNull(),
    paymentId: text("payment_id").unique(),
    prizeId: integer("prize_id").references(() => prizes.id),
    emoji: text("emoji"),
    revealedBy: text("revealed_by"),
    socialNetwork: text("social_network"),
    socialHandle: text("social_handle"),
    certificateSentAt: timestamp("certificate_sent_at"),
  },
  (table) => ({
    statusReservedAt: index("idx_cells_status_reserved_at").on(
      table.status,
      table.reservedAt,
    ),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    cellId: integer("cell_id")
      .notNull()
      .references(() => cells.id),
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    confirmedAt: timestamp("confirmed_at"),
  },
  (table) => ({
    cellId: index("idx_payments_cell_id").on(table.cellId),
    ipAddress: index("idx_payments_ip_address").on(table.ipAddress),
    deviceId: index("idx_payments_device_id").on(table.deviceId),
    cellPending: index("idx_payments_cell_pending")
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
    receivedAt: timestamp("received_at").defaultNow().notNull(),
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
    cellId: integer("cell_id")
      .notNull()
      .references(() => cells.id),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    dedup: uniqueIndex("idx_cash_ledger_dedup").on(
      table.entryType,
      table.cellId,
    ),
    typeCreated: index("idx_cash_ledger_type_created").on(
      table.entryType,
      table.createdAt,
    ),
  }),
);