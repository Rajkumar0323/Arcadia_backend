import { Router } from "express";
import stats from "./stats";
import clubs from "./clubs";
import games from "./games";
import quests from "./quests";
import seasons from "./seasons";
import users from "./users";
import rewards from "./rewards";
import courses from "./courses";

const router = Router();

router.use("/stats", stats);
router.use("/clubs", clubs);
router.use("/games", games);
router.use("/quests", quests);
router.use("/seasons", seasons);
router.use("/users", users);
router.use("/rewards", rewards);
router.use("/courses", courses);

export default router;
