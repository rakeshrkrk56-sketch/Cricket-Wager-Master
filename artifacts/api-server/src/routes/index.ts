import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import walletRouter from "./wallet";
import adminRouter from "./admin";
import depositsRouter from "./deposits";
import withdrawalsRouter from "./withdrawals";
import notificationsRouter from "./notifications";
import supportRouter from "./support";
import settingsRouter from "./settings";
import kycRouter from "./kyc";
import riskRouter from "./risk";
import gameControlRouter from "./gameControl";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(walletRouter);
router.use(adminRouter);
router.use(depositsRouter);
router.use(withdrawalsRouter);
router.use(notificationsRouter);
router.use(supportRouter);
router.use(settingsRouter);
router.use(kycRouter);
router.use(riskRouter);
router.use(gameControlRouter);

export default router;
