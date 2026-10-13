import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError, notFound } from "../lib/errors";
import { grade, publicPayload } from "../games/engine";
import { recordAttempt } from "../services/points";

const router = Router();

async function loadPlayableGame(id: string, userId: string) {
  const now = new Date();
  // One query: the game, its club, the caller's membership and the club's active season.
  const game = await prisma.game.findFirst({
    where: { id, isActive: true, club: { isActive: true } },
    include: {
      club: {
        include: {
          memberships: { where: { userId }, select: { id: true }, take: 1 },
          seasons: { where: { startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { startsAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!game) throw notFound("Game");
  return { game, isMember: game.club.memberships.length > 0, season: game.club.seasons[0] ?? null };
}

router.get("/:id", async (req, res) => {
  const user = req.user!;
  const [{ game, isMember }, best] = await Promise.all([
    loadPlayableGame(req.params.id, user.id),
    prisma.gameAttempt.aggregate({
      where: { userId: user.id, gameId: req.params.id },
      _max: { pointsEarned: true, accuracy: true },
      _count: { _all: true },
    }),
  ]);

  res.json({
    game: {
      id: game.id,
      title: game.title,
      description: game.description,
      type: game.type,
      difficulty: game.difficulty,
      points: game.points,
      timeLimit: game.timeLimit,
    },
    club: { id: game.club.id, name: game.club.name, slug: game.club.slug, icon: game.club.icon, color: game.club.color },
    isMember,
    payload: isMember ? publicPayload(game.type, game.content) : null,
    plays: best._count._all,
    myBest: best._count._all
      ? { pointsEarned: best._max.pointsEarned ?? 0, accuracy: best._max.accuracy ?? 0 }
      : null,
  });
});

const submitSchema = z.object({
  answers: z.unknown(),
  timeTaken: z.number().min(0).max(24 * 3600),
});

router.post("/:id/attempts", async (req, res) => {
  const user = req.user!;
  const body = submitSchema.parse(req.body);
  const { game, isMember, season } = await loadPlayableGame(req.params.id, user.id);
  if (!isMember) throw new HttpError(403, "Join this club to play its games");

  const graded = grade(game.type, game.content, body.answers);
  // Clamp time to the limit (+5s grace for latency) so the speed bonus can't go negative-weird.
  const timeTaken = game.timeLimit ? Math.min(body.timeTaken, game.timeLimit + 5) : body.timeTaken;
  const result = await recordAttempt({ user, game, season, score: graded.score, maxScore: graded.maxScore, timeTaken });

  res.status(201).json({
    attemptId: result.attempt.id,
    score: graded.score,
    maxScore: graded.maxScore,
    accuracy: result.attempt.accuracy,
    passed: result.attempt.passed,
    pointsEarned: result.points.total,
    basePoints: result.points.base,
    speedBonus: result.points.speedBonus,
    leaderboardPoints: result.delta,
    previousBest: result.previousBest,
    isNewBest: result.isNewBest,
    timeTaken: result.attempt.timeTaken,
    completedQuests: result.completedQuests,
    season: result.season ? { id: result.season.id, name: result.season.name } : null,
    review: graded.review,
  });
});

export default router;
