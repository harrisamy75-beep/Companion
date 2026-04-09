import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import travelersRouter from "./travelers";
import preferencesRouter from "./preferences";
import summaryRouter from "./summary";
import reviewsRouter from "./reviews";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(travelersRouter);
router.use(preferencesRouter);
router.use(summaryRouter);
router.use(reviewsRouter);

export default router;
