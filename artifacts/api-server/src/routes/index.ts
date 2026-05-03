import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gridRouter from "./grid/index";
import agentsRouter from "./agents/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gridRouter);
router.use(agentsRouter);

export default router;
