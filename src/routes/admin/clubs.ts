import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { slugify } from "../../lib/utils";
import { badRequest } from "../../lib/errors";

const router = Router();

const clubSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().max(60).optional(),
  description: z.string().max(1000).default(""),
  icon: z.string().trim().min(1).max(8).default("🎮"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #8b5cf6")
    .default("#8b5cf6"),
  coverImage: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
  isActive: z.boolean().default(true),
});

router.get("/", async (_req, res) => {
  const clubs = await prisma.club.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { memberships: true, games: true, quests: true, seasons: true, attempts: true } } },
  });
  res.json(clubs);
});

router.post("/", async (req, res) => {
  const data = clubSchema.parse(req.body);
  const slug = slugify(data.slug || data.name);
  if (!slug) throw badRequest("Could not build a slug from that name");
  const club = await prisma.club.create({ data: { ...data, slug } });
  res.status(201).json(club);
});

router.patch("/:id", async (req, res) => {
  const data = clubSchema.partial().parse(req.body);
  const club = await prisma.club.update({
    where: { id: req.params.id },
    data: { ...data, ...(data.slug !== undefined ? { slug: slugify(data.slug) } : {}) },
  });
  res.json(club);
});

router.delete("/:id", async (req, res) => {
  await prisma.club.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
