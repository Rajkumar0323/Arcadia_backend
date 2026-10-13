import { Router } from "express";
import { prisma } from "../lib/prisma";
import { computeStandings, levelInfo } from "../services/points";

const router = Router();

async function xpFor(userId: string) {
  const agg = await prisma.pointsLedger.aggregate({ where: { userId }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

router.get("/", async (req, res) => {
  const user = req.user!;
  const [xp, gamesPlayed, questsCompleted, clubsJoined, rewardsAvailable, unscratched] = await Promise.all([
    xpFor(user.id),
    prisma.gameAttempt.count({ where: { userId: user.id } }),
    prisma.questCompletion.count({ where: { userId: user.id } }),
    prisma.clubMembership.count({ where: { userId: user.id } }),
    prisma.reward.count({ where: { userId: user.id, status: "AVAILABLE" } }),
    prisma.reward.count({ where: { userId: user.id, status: "UNSCRATCHED" } }),
  ]);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      role: user.role,
      createdAt: user.createdAt,
    },
    stats: { level: levelInfo(xp), gamesPlayed, questsCompleted, clubsJoined, rewardsAvailable, unscratched },
  });
});

router.get("/dashboard", async (req, res) => {
  const user = req.user!;
  const now = new Date();
  const memberships = await prisma.clubMembership.findMany({
    where: { userId: user.id, club: { isActive: true } },
    include: { club: true },
    orderBy: { joinedAt: "asc" },
  });
  const clubIds = memberships.map((m) => m.clubId);

  // Active seasons for every joined club in one query, then all standings in parallel.
  const clubsPromise = prisma.season
    .findMany({
      where: { clubId: { in: clubIds }, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: "desc" },
    })
    .then((seasons) =>
      Promise.all(
        memberships.map(async ({ club }) => {
          const season = seasons.find((s) => s.clubId === club.id) ?? null;
          const standings = season ? await computeStandings(club.id, season.id) : [];
          const me = standings.find((s) => s.userId === user.id);
          return {
            id: club.id,
            name: club.name,
            slug: club.slug,
            icon: club.icon,
            color: club.color,
            activeSeason: season
              ? { id: season.id, name: season.name, startsAt: season.startsAt, endsAt: season.endsAt, finalizedAt: null }
              : null,
            myRank: me?.rank ?? null,
            myPoints: me?.points ?? 0,
            totalPlayers: standings.length,
          };
        }),
      ),
    );

  const [clubs, quests, passedAttempts, recent, unscratched] = await Promise.all([
    clubsPromise,
    prisma.quest.findMany({
      where: {
        clubId: { in: clubIds },
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      include: {
        club: { select: { name: true, slug: true, icon: true, color: true } },
        games: {
          where: { game: { isActive: true } },
          orderBy: { sortOrder: "asc" },
          include: { game: { select: { id: true, title: true, type: true } } },
        },
        completions: { where: { userId: user.id }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.gameAttempt.findMany({
      where: { userId: user.id, passed: true, clubId: { in: clubIds } },
      select: { gameId: true, createdAt: true },
    }),
    prisma.gameAttempt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { game: { select: { title: true, type: true } }, club: { select: { name: true, slug: true } } },
    }),
    prisma.reward.count({ where: { userId: user.id, status: "UNSCRATCHED" } }),
  ]);

  res.json({
    clubs,
    quests: quests.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      bonusPoints: q.bonusPoints,
      startsAt: q.startsAt,
      endsAt: q.endsAt,
      completed: q.completions.length > 0,
      club: q.club,
      games: q.games.map((qg) => ({
        id: qg.game.id,
        title: qg.game.title,
        type: qg.game.type,
        passed: passedAttempts.some((a) => a.gameId === qg.game.id && a.createdAt >= q.startsAt),
      })),
    })),
    recent: recent.map((a) => ({
      id: a.id,
      gameId: a.gameId,
      gameTitle: a.game.title,
      gameType: a.game.type,
      clubName: a.club.name,
      clubSlug: a.club.slug,
      accuracy: a.accuracy,
      pointsEarned: a.pointsEarned,
      createdAt: a.createdAt,
    })),
    unscratched,
  });
});

router.get("/attempts", async (req, res) => {
  const attempts = await prisma.gameAttempt.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      game: { select: { title: true, type: true } },
      club: { select: { name: true, slug: true, icon: true, color: true } },
    },
  });
  res.json(
    attempts.map((a) => ({
      id: a.id,
      gameId: a.gameId,
      gameTitle: a.game.title,
      gameType: a.game.type,
      club: a.club,
      accuracy: a.accuracy,
      pointsEarned: a.pointsEarned,
      timeTaken: a.timeTaken,
      passed: a.passed,
      createdAt: a.createdAt,
    })),
  );
});

export default router;
