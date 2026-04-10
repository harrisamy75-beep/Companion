import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import travelersRouter from "./travelers";
import preferencesRouter from "./preferences";
import summaryRouter from "./summary";
import reviewsRouter from "./reviews";
import tripProfilesRouter from "./trip-profiles";
import propertiesRouter from "./properties";
import loyaltyRouter from "./loyalty";
import placesRouter from "./places";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(travelersRouter);
router.use(preferencesRouter);
router.use(summaryRouter);
router.use(reviewsRouter);
router.use(tripProfilesRouter);
router.use(propertiesRouter);
router.use(loyaltyRouter);
router.use(placesRouter);

export default router;
