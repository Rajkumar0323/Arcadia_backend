import crypto from "node:crypto";
import type { Reward, RewardType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError, notFound } from "../lib/errors";
import { computeStandings } from "./points";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function isMissingTableError(err: unknown, modelName: string) {
  if (!(err && typeof err === "object" && "code" in err)) return false;

  const code = (err as { code?: string }).code;
  const meta = (err as { meta?: { modelName?: string; table?: string } }).meta;
  const model = meta?.modelName ?? "";
  const table = meta?.table ?? "";

  return code === "P2021" && [model, table].some((value) => value.toLowerCase().includes(modelName.toLowerCase()));
}

export function generateCode(prefix = "ARC") {
  const part = () =>
    Array.from(crypto.randomBytes(4))
      .map((b) => ALPHABET[b % ALPHABET.length])
      .join("");
  return `${prefix}-${part()}-${part()}`;
}

/** Hides the discount & code until a scratch card is scratched. */
export function serializeReward<T extends Reward>(r: T) {
  const hidden = r.status === "UNSCRATCHED";
  return { ...r, discountPercent: hidden ? null : r.discountPercent, code: hidden ? null : r.code };
}

export async function expireRewards() {
  try {
    const res = await prisma.reward.updateMany({
      where: { status: { in: ["UNSCRATCHED", "AVAILABLE"] }, expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });
    return res.count;
  } catch (err) {
    if (isMissingTableError(err, "Reward")) {
      console.warn("[scheduler] Reward table not found; skipping reward expiry.");
      return 0;
    }
    throw err;
  }
}

interface RewardInput {
  userId: string;
  clubId?: string | null;
  seasonId?: string | null;
  type: RewardType;
  discountPercent: number;
  validDays: number;
  title: string;
  rank?: number | null;
  note?: string | null;
}

function rewardData(input: RewardInput) {
  return {
    userId: input.userId,
    clubId: input.clubId ?? null,
    seasonId: input.seasonId ?? null,
    type: input.type,
    status: input.type === "SCRATCH_CARD" ? ("UNSCRATCHED" as const) : ("AVAILABLE" as const),
    revealedAt: input.type === "PASS" ? new Date() : null,
    discountPercent: input.discountPercent,
    code: generateCode(input.type === "PASS" ? "PASS" : "SCR"),
    rank: input.rank ?? null,
    title: input.title,
    note: input.note ?? null,
    expiresAt: new Date(Date.now() + input.validDays * 86400_000),
  };
}

export async function issueReward(input: RewardInput) {
  return prisma.reward.create({ data: rewardData(input) });
}

/** Ranks a season's players and issues rewards according to its tiers. */
export async function finalizeSeason(seasonId: string, opts: { force?: boolean } = {}) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { tiers: { orderBy: { rankFrom: "asc" } }, club: true },
  });
  if (!season) throw notFound("Season");
  if (season.finalizedAt) throw new HttpError(400, "Season is already finalized");
  if (season.endsAt > new Date() && !opts.force) {
    throw new HttpError(400, "Season hasn't ended yet. Use force to end it early.");
  }

  const standings = await computeStandings(season.clubId, season.id);
  const issued: ReturnType<typeof rewardData>[] = [];

  for (const tier of season.tiers) {
    for (let rank = tier.rankFrom; rank <= tier.rankTo; rank++) {
      const s = standings[rank - 1];
      if (!s) break;
      const discount =
        tier.type === "PASS" ? tier.maxDiscount : crypto.randomInt(tier.minDiscount, tier.maxDiscount + 1);
      issued.push(
        rewardData({
          userId: s.userId,
          clubId: season.clubId,
          seasonId: season.id,
          type: tier.type,
          discountPercent: discount,
          validDays: tier.validDays,
          rank,
          title: tier.label || `${season.club.name} · ${season.name} · Rank #${rank}`,
        }),
      );
    }
  }

  // All rewards in one insert, atomically with marking the season finalized.
  await prisma.$transaction([
    prisma.reward.createMany({ data: issued }),
    prisma.season.update({
      where: { id: season.id },
      data: { finalizedAt: new Date(), ...(season.endsAt > new Date() ? { endsAt: new Date() } : {}) },
    }),
  ]);

  return { seasonId: season.id, players: standings.length, issued: issued.length };
}

/** Background job: finalize ended seasons and expire old rewards. */
export function startScheduler(enabled: boolean) {
  const run = async () => {
    try {
      try {
        await expireRewards();
      } catch (err) {
        if (isMissingTableError(err, "Reward")) {
          console.warn("[scheduler] Database schema not initialized yet; skipping reward expiry.");
          return;
        }
        throw err;
      }

      if (!enabled) return;

      let due;
      try {
        due = await prisma.season.findMany({ where: { finalizedAt: null, endsAt: { lte: new Date() } } });
      } catch (err) {
        if (isMissingTableError(err, "Season")) {
          console.warn("[scheduler] Database schema not initialized yet; skipping season finalization.");
          return;
        }
        throw err;
      }

      for (const s of due) {
        const res = await finalizeSeason(s.id).catch((e) => console.error("[scheduler] finalize failed", s.id, e));
        if (res) console.log(`[scheduler] finalized season ${s.name}: ${res.issued} rewards issued`);
      }
    } catch (err) {
      console.error("[scheduler]", err);
    }
  };
  setTimeout(run, 10_000);
  setInterval(run, 60 * 60 * 1000);
}
