import { Router, type IRouter } from "express";
import healthRouter from "./health";
import activitiesRouter from "./activities";
import storageRouter from "./storage";
import renderJobsRouter from "./renderJobs";
import globeRouter from "./globe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(activitiesRouter);
router.use(storageRouter);
router.use(renderJobsRouter);
router.use(globeRouter);

export default router;
