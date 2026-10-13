import { Router } from "express";
import { prisma } from "../lib/prisma";
import { notFound } from "../lib/errors";
import { publicUser } from "../lib/utils";
import { computeStandings, getActiveSeason } from "../services/points";

const router = Router();

const seasonLite = (s: { id: string; name: string; startsAt: Date; endsAt: Date; finalizedAt: Date | null } | null) =>
  s ? { id: s.id, name: s.name, startsAt: s.startsAt, endsAt: s.endsAt, finalizedAt: s.finalizedAt } : null;

async function findClub(slug: string) {
  const club = await prisma.club.findFirst({ where: { slug, isActive: true } });
  if (!club) throw notFound("Club");
  return club;
}

router.get("/", async (req, res) => {
  const now = new Date();
  const clubs = await prisma.club.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { memberships: true, games: { where: { isActive: true } } } },
      memberships: { where: { userId: req.user!.id }, select: { id: true } },
      seasons: { where: { startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { startsAt: "desc" }, take: 1 },
    },
  });
  res.json(
    clubs.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      icon: c.icon,
      color: c.color,
      coverImage: c.coverImage,
      memberCount: c._count.memberships,
      gameCount: c._count.games,
      isMember: c.memberships.length > 0,
      activeSeason: seasonLite(c.seasons[0] ?? null),
    })),
  );
});

router.get("/:slug", async (req, res) => {
  const user = req.user!;
  const club = await findClub(req.params.slug);
  const now = new Date();

  const [memberCount, membership, games, quests, { season, standings }, myStats, myPassed] = await Promise.all([
    prisma.clubMembership.count({ where: { clubId: club.id } }),
    prisma.clubMembership.findUnique({ where: { userId_clubId: { userId: user.id, clubId: club.id } } }),
    prisma.game.findMany({
      where: { clubId: club.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        difficulty: true,
        points: true,
        timeLimit: true,
      },
    }),
    prisma.quest.findMany({
      where: {
        clubId: club.id,
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      include: {
        games: {
          where: { game: { isActive: true } },
          orderBy: { sortOrder: "asc" },
          include: { game: { select: { id: true, title: true, type: true } } },
        },
        completions: { where: { userId: user.id }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getActiveSeason(club.id).then(async (season) => ({
      season,
      standings: season ? await computeStandings(club.id, season.id) : null,
    })),
    prisma.gameAttempt.groupBy({
      by: ["gameId"],
      where: { userId: user.id, clubId: club.id },
      _max: { pointsEarned: true, accuracy: true },
      _count: { _all: true },
    }),
    prisma.gameAttempt.findMany({
      where: { userId: user.id, clubId: club.id, passed: true },
      select: { gameId: true, createdAt: true },
    }),
  ]);

  let myStanding: { rank: number | null; points: number; totalPlayers: number } | null = null;
  if (standings) {
    const me = standings.find((s) => s.userId === user.id);
    myStanding = { rank: me?.rank ?? null, points: me?.points ?? 0, totalPlayers: standings.length };
  }

  res.json({
    id: club.id,
    name: club.name,
    slug: club.slug,
    description: club.description,
    icon: club.icon,
    color: club.color,
    coverImage: club.coverImage,
    memberCount,
    gameCount: games.length,
    isMember: !!membership,
    activeSeason: seasonLite(season),
    myStanding,
    games: games.map((g) => {
      const s = myStats.find((m) => m.gameId === g.id);
      return {
        ...g,
        plays: s?._count._all ?? 0,
        myBest: s ? { pointsEarned: s._max.pointsEarned ?? 0, accuracy: s._max.accuracy ?? 0 } : null,
      };
    }),
    quests: quests.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      bonusPoints: q.bonusPoints,
      startsAt: q.startsAt,
      endsAt: q.endsAt,
      completed: q.completions.length > 0,
      games: q.games.map((qg) => ({
        id: qg.game.id,
        title: qg.game.title,
        type: qg.game.type,
        passed: myPassed.some((a) => a.gameId === qg.game.id && a.createdAt >= q.startsAt),
      })),
    })),
  });
});

router.post("/:slug/join", async (req, res) => {
  const club = await findClub(req.params.slug);
  await prisma.clubMembership.upsert({
    where: { userId_clubId: { userId: req.user!.id, clubId: club.id } },
    create: { userId: req.user!.id, clubId: club.id },
    update: {},
  });
  res.json({ ok: true });
});

router.delete("/:slug/leave", async (req, res) => {
  const club = await findClub(req.params.slug);
  await prisma.clubMembership.deleteMany({ where: { userId: req.user!.id, clubId: club.id } });
  res.json({ ok: true });
});

router.get("/:slug/seasons", async (req, res) => {
  const club = await findClub(req.params.slug);
  const seasons = await prisma.season.findMany({
    where: { clubId: club.id, startsAt: { lte: new Date() } },
    orderBy: { startsAt: "desc" },
  });
  res.json(seasons.map(seasonLite));
});

router.get("/:slug/leaderboard", async (req, res) => {
  const club = await findClub(req.params.slug);
  const scope = String(req.query.season ?? "current");
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 200);

  let season = null;
  let key: string | null | "all" = "all";
  if (scope === "current") {
    season =
      (await getActiveSeason(club.id)) ??
      (await prisma.season.findFirst({
        where: { clubId: club.id, startsAt: { lte: new Date() } },
        orderBy: { endsAt: "desc" },
      }));
    key = season ? season.id : "all";
  } else if (scope !== "all") {
    season = await prisma.season.findFirst({ where: { id: scope, clubId: club.id } });
    if (!season) throw notFound("Season");
    key = season.id;
  }

  const standings = await computeStandings(club.id, key);
  const top = standings.slice(0, limit);
  const mine = standings.find((s) => s.userId === req.user!.id);
  const userIds = [...new Set([...top.map((s) => s.userId), ...(mine ? [mine.userId] : [])])];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, imageUrl: true },
  });
  const toEntry = (s: (typeof standings)[number]) => {
    const u = users.find((x) => x.id === s.userId);
    return { rank: s.rank, points: s.points, user: publicUser(u ?? { id: s.userId, name: null, imageUrl: null }) };
  };

  res.json({
    scope: key === "all" ? "all" : "season",
    season: seasonLite(season),
    total: standings.length,
    entries: top.map(toEntry),
    me: mine ? toEntry(mine) : null,
  });
});

export default router;
