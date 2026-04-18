import { Router, type IRouter } from "express";
import healthRouter from "./health";
import travelersRouter from "./travelers";
import preferencesRouter from "./preferences";
import summaryRouter from "./summary";
import reviewsRouter from "./reviews";
import tripProfilesRouter from "./trip-profiles";
import propertiesRouter from "./properties";
import loyaltyRouter from "./loyalty";
import placesRouter from "./places";
import personalityRouter from "./personality";
import quickMatchRouter from "./quick-match";
import planRouter from "./plan";
import accountRouter from "./account";

const router: IRouter = Router();

router.use(healthRouter);
router.use(travelersRouter);
router.use(preferencesRouter);
router.use(summaryRouter);
router.use(reviewsRouter);
router.use(tripProfilesRouter);
router.use(propertiesRouter);
router.use(loyaltyRouter);
router.use(placesRouter);
router.use(personalityRouter);
router.use(quickMatchRouter);
router.use(planRouter);
router.use(accountRouter);

export default router;
