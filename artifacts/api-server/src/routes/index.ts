import { Router, type IRouter } from "express";
import healthRouter from "./health";
import activitiesRouter from "./activities";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(activitiesRouter);
router.use(storageRouter);

export default router;
