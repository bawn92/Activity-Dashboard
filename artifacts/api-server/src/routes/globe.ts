import { Router, type IRouter } from "express";
import { globeSampleData } from "../lib/globeSampleData";

const router: IRouter = Router();

router.get("/globe/data", (_req, res) => {
  res.json(globeSampleData);
});

export default router;
