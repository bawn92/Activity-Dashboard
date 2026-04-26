import { Router, type IRouter } from "express";
import healthRouter from "./health";
import activitiesRouter from "./activities";
import storageRouter from "./storage";
import renderJobsRouter from "./renderJobs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(activitiesRouter);
router.use(storageRouter);
router.use(renderJobsRouter);

export default router;
