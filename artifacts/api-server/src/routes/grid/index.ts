import { Router } from "express";
import { getGridState } from "./gridState";
import { getGridSummary } from "./gridSummary";
import { injectShockHandler } from "./injectShock";
import { repairNodeHandler } from "./repairNode";

const router = Router();

router.get("/grid/state", getGridState);
router.get("/grid/summary", getGridSummary);
router.post("/grid/inject-shock", injectShockHandler);
router.post("/grid/nodes/:nodeId/repair", repairNodeHandler);

export default router;
