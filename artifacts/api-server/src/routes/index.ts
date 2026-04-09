import { Router, type IRouter } from "express";
import healthRouter from "./health";
import travelersRouter from "./travelers";
import preferencesRouter from "./preferences";
import summaryRouter from "./summary";
import reviewsRouter from "./reviews";

const router: IRouter = Router();

router.use(healthRouter);
router.use(travelersRouter);
router.use(preferencesRouter);
router.use(summaryRouter);
router.use(reviewsRouter);

export default router;
