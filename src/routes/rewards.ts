import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError, notFound } from "../lib/errors";
import { serializeReward } from "../services/rewards";

const router = Router();

const include = {
  club: { select: { name: true, slug: true, icon: true, color: true } },
  season: { select: { name: true } },
  course: { select: { id: true, title: true, price: true } },
} as const;

async function ownReward(id: string, userId: string) {
  const reward = await prisma.reward.findFirst({ where: { id, userId }, include });
  if (!reward) throw notFound("Reward");
  if (reward.expiresAt && reward.expiresAt < new Date() && ["UNSCRATCHED", "AVAILABLE"].includes(reward.status)) {
    await prisma.reward.update({ where: { id }, data: { status: "EXPIRED" } });
    throw new HttpError(400, "This reward has expired");
  }
  return reward;
}

router.get("/", async (req, res) => {
  const now = new Date();
  const userId = req.user!.id;
  // Expire this user's stale rewards while loading the list (the hourly scheduler handles everyone else).
  const [, rewards] = await Promise.all([
    prisma.reward.updateMany({
      where: { userId, status: { in: ["UNSCRATCHED", "AVAILABLE"] }, expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    }),
    prisma.reward.findMany({
      where: { userId, status: { not: "REVOKED" } },
      orderBy: { createdAt: "desc" },
      include,
    }),
  ]);
  res.json(
    rewards.map((r) =>
      serializeReward(
        r.expiresAt && r.expiresAt < now && ["UNSCRATCHED", "AVAILABLE"].includes(r.status)
          ? { ...r, status: "EXPIRED" as const }
          : r,
      ),
    ),
  );
});

router.post("/:id/scratch", async (req, res) => {
  const reward = await ownReward(req.params.id, req.user!.id);
  if (reward.status !== "UNSCRATCHED") {
    res.json(serializeReward(reward));
    return;
  }
  const updated = await prisma.reward.update({
    where: { id: reward.id },
    data: { status: "AVAILABLE", revealedAt: new Date() },
    include,
  });
  res.json(serializeReward(updated));
});

router.post("/:id/redeem", async (req, res) => {
  const { courseId } = z.object({ courseId: z.string().min(1) }).parse(req.body);
  const [reward, course] = await Promise.all([
    ownReward(req.params.id, req.user!.id),
    prisma.course.findFirst({ where: { id: courseId, isActive: true } }),
  ]);
  if (reward.status === "UNSCRATCHED") throw new HttpError(400, "Scratch the card first");
  if (reward.status !== "AVAILABLE") throw new HttpError(400, "This reward can no longer be redeemed");
  if (!course) throw notFound("Course");

  const updated = await prisma.reward.update({
    where: { id: reward.id },
    data: { status: "REDEEMED", redeemedAt: new Date(), courseId: course.id },
    include,
  });
  const discount = Math.round((course.price * reward.discountPercent) / 100);
  res.json({
    reward: serializeReward(updated),
    pricing: {
      courseId: course.id,
      courseTitle: course.title,
      originalPrice: course.price,
      discountPercent: reward.discountPercent,
      discount,
      finalPrice: course.price - discount,
    },
  });
});

export default router;
