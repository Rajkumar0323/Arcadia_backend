import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { lastNDays, publicUser } from "../../lib/utils";

const router = Router();

router.get("/", async (_req, res) => {
  const now = new Date();
  const since = new Date(Date.now() - 30 * 86400_000);
  const weekAgo = new Date(Date.now() - 7 * 86400_000);

  const [
    users,
    newUsersWeek,
    activeUsersWeek,
    clubs,
    games,
    quests,
    attempts,
    attemptsWeek,
    activeSeasons,
    rewardsIssued,
    rewardsRedeemed,
    courses,
    signupsRaw,
    attemptsRaw,
    gameTypes,
    topClubsRaw,
    topPlayersRaw,
    recentAttempts,
    rewardStatus,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: weekAgo } } }),
    prisma.club.count(),
    prisma.game.count(),
    prisma.quest.count(),
    prisma.gameAttempt.count(),
    prisma.gameAttempt.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.season.count({ where: { startsAt: { lte: now }, endsAt: { gt: now } } }),
    prisma.reward.count(),
    prisma.reward.count({ where: { status: "REDEEMED" } }),
    prisma.course.count(),
    prisma.$queryRaw<{ day: Date; count: number }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
      FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ day: Date; count: number }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
      FROM "GameAttempt" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    prisma.game.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.club.findMany({
      include: { _count: { select: { memberships: true, attempts: true, games: true } } },
    }),
    prisma.pointsLedger.groupBy({
      by: ["userId"],
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
    prisma.gameAttempt.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: { select: { id: true, name: true, imageUrl: true } },
        game: { select: { title: true, type: true } },
        club: { select: { name: true, icon: true } },
      },
    }),
    prisma.reward.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const days = lastNDays(30);
  const key = (d: Date) => new Date(d).toISOString().slice(0, 10);
  const activity = days.map((day) => ({
    day,
    signups: signupsRaw.find((r) => key(r.day) === day)?.count ?? 0,
    attempts: attemptsRaw.find((r) => key(r.day) === day)?.count ?? 0,
  }));

  const playerUsers = await prisma.user.findMany({
    where: { id: { in: topPlayersRaw.map((p) => p.userId) } },
    select: { id: true, name: true, imageUrl: true, email: true },
  });

  res.json({
    totals: {
      users,
      newUsersWeek,
      activeUsersWeek,
      clubs,
      games,
      quests,
      attempts,
      attemptsWeek,
      activeSeasons,
      rewardsIssued,
      rewardsRedeemed,
      courses,
    },
    activity,
    gameTypes: gameTypes.map((g) => ({ type: g.type, count: g._count._all })),
    rewardStatus: rewardStatus.map((r) => ({ status: r.status, count: r._count._all })),
    topClubs: topClubsRaw
      .map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        members: c._count.memberships,
        attempts: c._count.attempts,
        games: c._count.games,
      }))
      .sort((a, b) => b.attempts - a.attempts || b.members - a.members)
      .slice(0, 6),
    topPlayers: topPlayersRaw.map((p) => {
      const u = playerUsers.find((x) => x.id === p.userId);
      return {
        ...publicUser(u ?? { id: p.userId, name: null, imageUrl: null }),
        email: u?.email ?? "",
        xp: p._sum.amount ?? 0,
      };
    }),
    recentAttempts: recentAttempts.map((a) => ({
      id: a.id,
      user: publicUser(a.user),
      game: a.game,
      club: a.club,
      accuracy: a.accuracy,
      pointsEarned: a.pointsEarned,
      createdAt: a.createdAt,
    })),
  });
});

export default router;
