import { Router, type IRouter } from "express";
import cellsRouter from "./cells";
import healthRouter from "./health";
import webhookRouter from "./webhook";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cellsRouter);
router.use(webhookRouter);
// Keep administrative capabilities behind their own namespace and middleware.
// The admin router only defines paths relative to /admin, so a new admin route
// cannot accidentally become part of the public API by omitting the prefix.
router.use("/admin", adminRouter);

export default router;
