import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tripsRouter from "./trips";
import bookingsRouter from "./bookings";
import statsRouter from "./stats";
import notificationsRouter from "./notifications";
import customPickupsRouter from "./custom-pickups";
import statDetailsRouter from "./stat-details";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(tripsRouter);
router.use(bookingsRouter);
router.use(statsRouter);
router.use(notificationsRouter);
router.use(customPickupsRouter);
router.use(statDetailsRouter);

export default router;
