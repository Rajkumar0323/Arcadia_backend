import type { RequestHandler } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import type { User } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { HttpError } from "../lib/errors";

const SYNC_EVERY_MS = 6 * 60 * 60 * 1000; // refresh profile from Clerk every 6h
const ACTIVITY_EVERY_MS = 5 * 60 * 1000;
const USER_CACHE_MS = 30 * 1000;

/** Pulls the user from Clerk and upserts it into our database. */
export async function syncUser(clerkId: string) {
  const cu = await clerkClient.users.getUser(clerkId);
  const primary = cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId) ?? cu.emailAddresses[0];
  const email = primary?.emailAddress?.toLowerCase();
  if (!email) throw new HttpError(400, "Your account has no email address");

  const name = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || cu.username || email.split("@")[0];
  const isAdminEmail = env.adminEmails.includes(email);
  const data = { clerkId, email, name, imageUrl: cu.imageUrl, syncedAt: new Date() };

  const existing = await prisma.user.findFirst({ where: { OR: [{ clerkId }, { email }] } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { ...data, ...(isAdminEmail ? { role: "ADMIN" as const } : {}) },
    });
  }
  return prisma.user.create({ data: { ...data, role: isAdminEmail ? "ADMIN" : "USER" } });
}

// Every API call goes through requireUser, so a short-lived cache saves one DB round-trip per request.
const userCache = new Map<string, { user: User; at: number }>();

/** Call after changing a user's role/ban status so it takes effect immediately. */
export function invalidateUserCache() {
  userCache.clear();
}

export const requireUser: RequestHandler = async (req, _res, next) => {
  const { userId } = getAuth(req);
  if (!userId) throw new HttpError(401, "Please sign in to continue");

  const cached = userCache.get(userId);
  let user = cached && Date.now() - cached.at < USER_CACHE_MS ? cached.user : null;
  if (!user) {
    user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || Date.now() - user.syncedAt.getTime() > SYNC_EVERY_MS) {
      try {
        user = await syncUser(userId);
      } catch (err) {
        if (!user) throw err; // first sign-in must succeed; later refreshes can fail silently
      }
    }
    if (!user) throw new HttpError(401, "Unable to load your account");
    if (userCache.size > 5000) userCache.clear();
    userCache.set(userId, { user, at: Date.now() });
  }
  if (user.isBanned) throw new HttpError(403, "Your account has been suspended");

  if (Date.now() - user.lastActiveAt.getTime() > ACTIVITY_EVERY_MS) {
    user.lastActiveAt = new Date();
    prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: user.lastActiveAt } }).catch(() => undefined);
  }

  req.user = user;
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== "ADMIN") throw new HttpError(403, "Admin access required");
  next();
};
