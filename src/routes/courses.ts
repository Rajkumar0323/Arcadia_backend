import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (_req, res) => {
  const courses = await prisma.course.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } });
  res.json(courses);
});

export default router;
