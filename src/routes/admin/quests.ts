import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { badRequest, notFound } from "../../lib/errors";

const router = Router();

const questSchema = z.object({
  clubId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(1000).default(""),
  bonusPoints: z.number().int().min(0).max(100000).default(250),
  startsAt: z.coerce.date().default(() => new Date()),
  endsAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().default(true),
  gameIds: z.array(z.string()).min(1, "Pick at least one game"),
});

async function assertGamesInClub(clubId: string, gameIds: string[]) {
  const count = await prisma.game.count({ where: { id: { in: gameIds }, clubId } });
  if (count !== new Set(gameIds).size) throw badRequest("All quest games must belong to the selected club");
}

const include = {
  club: { select: { name: true, icon: true, color: true } },
  games: { orderBy: { sortOrder: "asc" as const }, include: { game: { select: { id: true, title: true, type: true } } } },
  _count: { select: { completions: true } },
};

router.get("/", async (req, res) => {
  const quests = await prisma.quest.findMany({
    where: typeof req.query.clubId === "string" && req.query.clubId ? { clubId: req.query.clubId } : {},
    orderBy: { createdAt: "desc" },
    include,
  });
  res.json(quests);
});

router.post("/", async (req, res) => {
  const { gameIds, ...data } = questSchema.parse(req.body);
  await assertGamesInClub(data.clubId, gameIds);
  const quest = await prisma.quest.create({
    data: { ...data, endsAt: data.endsAt ?? null, games: { create: gameIds.map((gameId, sortOrder) => ({ gameId, sortOrder })) } },
    include,
  });
  res.status(201).json(quest);
});

router.patch("/:id", async (req, res) => {
  const existing = await prisma.quest.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound("Quest");
  const { gameIds, ...data } = questSchema.partial().parse(req.body);
  const clubId = data.clubId ?? existing.clubId;
  if (gameIds) await assertGamesInClub(clubId, gameIds);

  const quest = await prisma.$transaction(async (tx) => {
    if (gameIds) {
      await tx.questGame.deleteMany({ where: { questId: existing.id } });
      await tx.questGame.createMany({
        data: gameIds.map((gameId, sortOrder) => ({ questId: existing.id, gameId, sortOrder })),
      });
    }
    return tx.quest.update({ where: { id: existing.id }, data, include });
  });
  res.json(quest);
});

router.delete("/:id", async (req, res) => {
  await prisma.quest.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
