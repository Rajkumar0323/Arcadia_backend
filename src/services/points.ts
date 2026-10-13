import type { Game, Prisma, Season, User } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const PASS_THRESHOLD = 0.6;

export function levelInfo(xp: number) {
  const safe = Math.max(0, xp);
  const level = Math.floor(Math.sqrt(safe / 100)) + 1;
  const currentLevelXp = 100 * (level - 1) ** 2;
  const nextLevelXp = 100 * level ** 2;
  return {
    level,
    xp: safe,
    currentLevelXp,
    nextLevelXp,
    progress: (safe - currentLevelXp) / (nextLevelXp - currentLevelXp),
  };
}

export async function getActiveSeason(clubId: string, at = new Date()) {
  return prisma.season.findFirst({
    where: { clubId, startsAt: { lte: at }, endsAt: { gt: at } },
    orderBy: { startsAt: "desc" },
  });
}

export function computePoints(game: Pick<Game, "points" | "timeLimit">, accuracy: number, timeTaken: number) {
  const base = Math.round(game.points * accuracy);
  let speedBonus = 0;
  if (game.timeLimit && accuracy >= PASS_THRESHOLD) {
    speedBonus = Math.round(game.points * 0.2 * Math.max(0, 1 - timeTaken / game.timeLimit));
  }
  return { base, speedBonus, total: base + speedBonus };
}

export interface Standing {
  userId: string;
  points: number;
  rank: number;
  lastScoredAt: Date;
}

/** Ranked standings for a club. seasonId: a season id, null (points outside seasons) or "all" (all-time). */
export async function computeStandings(clubId: string, seasonId: string | null | "all"): Promise<Standing[]> {
  const where: Prisma.PointsLedgerWhereInput = { clubId, user: { isBanned: false } };
  if (seasonId !== "all") where.seasonId = seasonId;

  const rows = await prisma.pointsLedger.groupBy({
    by: ["userId"],
    where,
    _sum: { amount: true },
    _max: { createdAt: true },
  });

  return rows
    .map((r) => ({ userId: r.userId, points: r._sum.amount ?? 0, lastScoredAt: r._max.createdAt ?? new Date(0) }))
    .filter((r) => r.points > 0)
    // ties are broken by whoever reached the score first
    .sort((a, b) => b.points - a.points || a.lastScoredAt.getTime() - b.lastScoredAt.getTime())
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Stores an attempt and updates the leaderboard ledger.
 * Only the improvement over your previous best (in the same season) counts, so replaying can't be farmed.
 * Also completes any quest whose games have now all been passed.
 */
export async function recordAttempt(params: {
  user: User;
  game: Game;
  score: number;
  maxScore: number;
  timeTaken: number;
  /** The club's active season, if the caller already loaded it (saves a query). */
  season?: Season | null;
}) {
  const { user, game } = params;
  const accuracy = params.maxScore > 0 ? Math.min(1, Math.max(0, params.score / params.maxScore)) : 0;
  const timeTaken = Math.max(1, Math.round(params.timeTaken));
  const points = computePoints(game, accuracy, timeTaken);
  const passed = accuracy >= PASS_THRESHOLD;
  const season = params.season !== undefined ? params.season : await getActiveSeason(game.clubId);
  const seasonId = season?.id ?? null;

  return prisma.$transaction(async (tx) => {
    const prev = await tx.gameAttempt.aggregate({
      where: { userId: user.id, gameId: game.id, seasonId },
      _max: { pointsEarned: true },
    });
    const previousBest = prev._max.pointsEarned ?? 0;

    const attempt = await tx.gameAttempt.create({
      data: {
        userId: user.id,
        gameId: game.id,
        clubId: game.clubId,
        seasonId,
        score: params.score,
        maxScore: params.maxScore,
        accuracy,
        pointsEarned: points.total,
        timeTaken,
        passed,
      },
    });

    const delta = Math.max(0, points.total - previousBest);
    if (delta > 0) {
      await tx.pointsLedger.create({
        data: { userId: user.id, clubId: game.clubId, seasonId, amount: delta, reason: "GAME", gameId: game.id },
      });
    }

    const completedQuests: { id: string; title: string; bonusPoints: number }[] = [];
    if (passed) {
      const now = new Date();
      const quests = await tx.quest.findMany({
        where: {
          clubId: game.clubId,
          isActive: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          games: { some: { gameId: game.id } },
          completions: { none: { userId: user.id } },
        },
        include: { games: { where: { game: { isActive: true } }, select: { gameId: true } } },
      });

      const candidates = quests.filter((q) => q.games.length > 0);
      if (candidates.length) {
        // One lookup for every candidate quest instead of a query per quest.
        const passedAttempts = await tx.gameAttempt.findMany({
          where: {
            userId: user.id,
            passed: true,
            gameId: { in: [...new Set(candidates.flatMap((q) => q.games.map((g) => g.gameId)))] },
            createdAt: { gte: new Date(Math.min(...candidates.map((q) => q.startsAt.getTime()))) },
          },
          select: { gameId: true, createdAt: true },
        });
        const done = candidates.filter((q) =>
          q.games.every((g) => passedAttempts.some((a) => a.gameId === g.gameId && a.createdAt >= q.startsAt)),
        );
        if (done.length) {
          await tx.questCompletion.createMany({ data: done.map((q) => ({ userId: user.id, questId: q.id })) });
          const bonuses = done.filter((q) => q.bonusPoints > 0);
          if (bonuses.length) {
            await tx.pointsLedger.createMany({
              data: bonuses.map((q) => ({
                userId: user.id,
                clubId: game.clubId,
                seasonId,
                amount: q.bonusPoints,
                reason: "QUEST" as const,
                questId: q.id,
              })),
            });
          }
          completedQuests.push(...done.map((q) => ({ id: q.id, title: q.title, bonusPoints: q.bonusPoints })));
        }
      }
    }

    return {
      attempt,
      points,
      previousBest,
      delta,
      isNewBest: points.total > previousBest,
      completedQuests,
      season,
    };
  });
}
