import { Router, type IRouter } from "express";
import healthRouter from "./health";
import activitiesRouter from "./activities";
import storageRouter from "./storage";
import renderJobsRouter from "./renderJobs";
import globeRouter from "./globe";
import mcpRouter from "./mcp";
import agentRouter from "./agent";
import authRouter from "./auth";
import coachRouter from "./coach";
import interestRouter from "./interest";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(activitiesRouter);
router.use(storageRouter);
router.use(renderJobsRouter);
router.use(globeRouter);
router.use("/mcp", mcpRouter);
router.use(agentRouter);
router.use(coachRouter);
router.use(interestRouter);

export default router;
