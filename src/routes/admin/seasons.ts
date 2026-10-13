import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { badRequest, notFound } from "../../lib/errors";
import { publicUser } from "../../lib/utils";
import { computeStandings } from "../../services/points";
import { finalizeSeason } from "../../services/rewards";

const router = Router();

const tierSchema = z
  .object({
    rankFrom: z.number().int().min(1),
    rankTo: z.number().int().min(1),
    type: z.enum(["SCRATCH_CARD", "PASS"]),
    minDiscount: z.number().int().min(1).max(100),
    maxDiscount: z.number().int().min(1).max(100),
    validDays: z.number().int().min(1).max(365).default(30),
    label: z.string().trim().max(120).optional().nullable(),
  })
  .refine((t) => t.rankTo >= t.rankFrom, { message: "Rank 'to' must be ≥ rank 'from'" })
  .refine((t) => t.maxDiscount >= t.minDiscount, { message: "Max discount must be ≥ min discount" });

const seasonBase = z.object({
  clubId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  tiers: z.array(tierSchema).max(20).default([]),
});

async function assertNoOverlap(clubId: string, startsAt: Date, endsAt: Date, excludeId?: string) {
  if (endsAt <= startsAt) throw badRequest("End date must be after start date");
  const clash = await prisma.season.findFirst({
    where: { clubId, id: excludeId ? { not: excludeId } : undefined, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
  });
  if (clash) throw badRequest(`Overlaps with "${clash.name}" in the same club`);
}

const include = {
  club: { select: { name: true, icon: true, color: true } },
  tiers: { orderBy: { rankFrom: "asc" as const } },
  _count: { select: { rewards: true, attempts: true } },
};

router.get("/", async (req, res) => {
  const seasons = await prisma.season.findMany({
    where: typeof req.query.clubId === "string" && req.query.clubId ? { clubId: req.query.clubId } : {},
    orderBy: { startsAt: "desc" },
    include,
  });
  res.json(seasons);
});

router.post("/", async (req, res) => {
  const { tiers, ...data } = seasonBase.parse(req.body);
  await assertNoOverlap(data.clubId, data.startsAt, data.endsAt);
  const season = await prisma.season.create({ data: { ...data, tiers: { create: tiers } }, include });
  res.status(201).json(season);
});

router.patch("/:id", async (req, res) => {
  const existing = await prisma.season.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound("Season");
  if (existing.finalizedAt) throw badRequest("Finalized seasons can't be edited");
  const { tiers, ...data } = seasonBase.partial().parse(req.body);
  await assertNoOverlap(
    data.clubId ?? existing.clubId,
    data.startsAt ?? existing.startsAt,
    data.endsAt ?? existing.endsAt,
    existing.id,
  );
  const season = await prisma.$transaction(async (tx) => {
    if (tiers) {
      await tx.rewardTier.deleteMany({ where: { seasonId: existing.id } });
      await tx.rewardTier.createMany({ data: tiers.map((t) => ({ ...t, seasonId: existing.id })) });
    }
    return tx.season.update({ where: { id: existing.id }, data, include });
  });
  res.json(season);
});

router.delete("/:id", async (req, res) => {
  const existing = await prisma.season.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound("Season");
  if (existing.finalizedAt) throw badRequest("Finalized seasons can't be deleted (rewards were issued)");
  await prisma.season.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

router.get("/:id/standings", async (req, res) => {
  const season = await prisma.season.findUnique({ where: { id: req.params.id } });
  if (!season) throw notFound("Season");
  const standings = (await computeStandings(season.clubId, season.id)).slice(0, 100);
  const users = await prisma.user.findMany({
    where: { id: { in: standings.map((s) => s.userId) } },
    select: { id: true, name: true, imageUrl: true, email: true },
  });
  res.json(
    standings.map((s) => {
      const u = users.find((x) => x.id === s.userId);
      return {
        rank: s.rank,
        points: s.points,
        user: { ...publicUser(u ?? { id: s.userId, name: null, imageUrl: null }), email: u?.email ?? "" },
      };
    }),
  );
});

router.post("/:id/finalize", async (req, res) => {
  const { force } = z.object({ force: z.boolean().default(false) }).parse(req.body ?? {});
  const result = await finalizeSeason(req.params.id, { force });
  res.json(result);
});

export default router;
