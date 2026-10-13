import { Router } from "express";
import { z } from "zod";
import { Difficulty, GameType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { validateContent } from "../../games/engine";

const router = Router();

const gameSchema = z.object({
  clubId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(1000).default(""),
  type: z.nativeEnum(GameType),
  difficulty: z.nativeEnum(Difficulty).default("MEDIUM"),
  points: z.number().int().min(0).max(10000).default(100),
  timeLimit: z.number().int().min(10).max(3600).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  content: z.unknown(),
});

router.get("/", async (req, res) => {
  const where: Prisma.GameWhereInput = {};
  if (typeof req.query.clubId === "string" && req.query.clubId) where.clubId = req.query.clubId;
  if (typeof req.query.type === "string" && req.query.type in GameType) where.type = req.query.type as GameType;
  if (typeof req.query.q === "string" && req.query.q) where.title = { contains: req.query.q, mode: "insensitive" };
  const games = await prisma.game.findMany({
    where,
    orderBy: [{ club: { name: "asc" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      type: true,
      difficulty: true,
      points: true,
      timeLimit: true,
      isActive: true,
      sortOrder: true,
      clubId: true,
      createdAt: true,
      club: { select: { name: true, icon: true, color: true } },
      _count: { select: { attempts: true } },
    },
  });
  res.json(games);
});

router.get("/:id", async (req, res) => {
  const game = await prisma.game.findUnique({ where: { id: req.params.id } });
  if (!game) throw notFound("Game");
  res.json(game);
});

router.post("/", async (req, res) => {
  const data = gameSchema.parse(req.body);
  const content = validateContent(data.type, data.content) as Prisma.InputJsonValue;
  const game = await prisma.game.create({ data: { ...data, timeLimit: data.timeLimit ?? null, content } });
  res.status(201).json(game);
});

router.patch("/:id", async (req, res) => {
  const existing = await prisma.game.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound("Game");
  const data = gameSchema.partial().parse(req.body);
  const type = data.type ?? existing.type;
  let content: Prisma.InputJsonValue | undefined;
  if (data.content !== undefined || data.type !== undefined) {
    content = validateContent(type, data.content ?? existing.content) as Prisma.InputJsonValue;
  }
  const game = await prisma.game.update({
    where: { id: existing.id },
    data: { ...data, content },
  });
  res.json(game);
});

router.delete("/:id", async (req, res) => {
  await prisma.game.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
