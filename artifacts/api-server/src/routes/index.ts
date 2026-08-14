import { Router, type IRouter } from "express";
import cellsRouter from "./cells";
import healthRouter from "./health";
import webhookRouter from "./webhook";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cellsRouter);
router.use(webhookRouter);
router.use(adminRouter);

export default router;
