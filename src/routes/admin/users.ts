import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { badRequest } from "../../lib/errors";
import { levelInfo } from "../../services/points";
import { invalidateUserCache } from "../../middleware/auth";

const router = Router();

router.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const pageSize = Math.min(100, Number(req.query.pageSize ?? 20) || 20);
  const where: Prisma.UserWhereInput = q
    ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] }
    : {};
  if (req.query.role === "ADMIN" || req.query.role === "USER") where.role = req.query.role;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { attempts: true, memberships: true, rewards: true } } },
    }),
  ]);
  const xp = await prisma.pointsLedger.groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((u) => u.id) } },
    _sum: { amount: true },
  });

  res.json({
    total,
    page,
    pageSize,
    users: users.map((u) => {
      const userXp = xp.find((x) => x.userId === u.id)?._sum.amount ?? 0;
      return { ...u, xp: userXp, level: levelInfo(userXp).level };
    }),
  });
});

router.patch("/:id", async (req, res) => {
  const data = z
    .object({ role: z.enum(["USER", "ADMIN"]).optional(), isBanned: z.boolean().optional() })
    .parse(req.body);
  if (req.params.id === req.user!.id && (data.role === "USER" || data.isBanned)) {
    throw badRequest("You can't demote or ban yourself");
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  invalidateUserCache();
  res.json(user);
});

export default router;
