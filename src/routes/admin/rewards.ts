import { Router } from "express";
import { z } from "zod";
import type { Prisma, RewardStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { issueReward } from "../../services/rewards";

const router = Router();
const STATUSES = ["UNSCRATCHED", "AVAILABLE", "REDEEMED", "EXPIRED", "REVOKED"];

router.get("/", async (req, res) => {
  const where: Prisma.RewardWhereInput = {};
  if (typeof req.query.status === "string" && STATUSES.includes(req.query.status)) {
    where.status = req.query.status as RewardStatus;
  }
  if (typeof req.query.type === "string" && ["SCRATCH_CARD", "PASS"].includes(req.query.type)) {
    where.type = req.query.type as "SCRATCH_CARD" | "PASS";
  }
  if (typeof req.query.clubId === "string" && req.query.clubId) where.clubId = req.query.clubId;
  if (typeof req.query.q === "string" && req.query.q) {
    where.OR = [
      { code: { contains: req.query.q, mode: "insensitive" } },
      { user: { email: { contains: req.query.q, mode: "insensitive" } } },
    ];
  }
  const rewards = await prisma.reward.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      user: { select: { id: true, name: true, email: true, imageUrl: true } },
      club: { select: { name: true, icon: true } },
      season: { select: { name: true } },
      course: { select: { title: true } },
    },
  });
  res.json(rewards);
});

router.post("/", async (req, res) => {
  const data = z
    .object({
      email: z.string().email(),
      clubId: z.string().nullable().optional(),
      type: z.enum(["SCRATCH_CARD", "PASS"]),
      discountPercent: z.number().int().min(1).max(100),
      validDays: z.number().int().min(1).max(365).default(30),
      title: z.string().trim().min(1).max(120),
      note: z.string().max(500).optional(),
    })
    .parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (!user) throw notFound("User with that email");
  const reward = await issueReward({ ...data, userId: user.id, clubId: data.clubId || null });
  res.status(201).json(reward);
});

router.patch("/:id/revoke", async (req, res) => {
  const reward = await prisma.reward.update({ where: { id: req.params.id }, data: { status: "REVOKED" } });
  res.json(reward);
});

export default router;
