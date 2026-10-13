import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

const router = Router();

const courseSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(4000).default(""),
  price: z.number().int().min(0),
  imageUrl: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
  category: z.string().trim().max(60).default("General"),
  isActive: z.boolean().default(true),
});

router.get("/", async (_req, res) => {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
  res.json(courses);
});

router.post("/", async (req, res) => {
  const course = await prisma.course.create({ data: courseSchema.parse(req.body) });
  res.status(201).json(course);
});

router.patch("/:id", async (req, res) => {
  const course = await prisma.course.update({
    where: { id: req.params.id },
    data: courseSchema.partial().parse(req.body),
  });
  res.json(course);
});

router.delete("/:id", async (req, res) => {
  await prisma.course.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
