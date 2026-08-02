import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import walletRouter from "./wallet";
import matchesRouter from "./matches";
import predictionsRouter from "./predictions";
import adminRouter from "./admin";
import cricketRouter from "./cricket";
import depositsRouter from "./deposits";
import withdrawalsRouter from "./withdrawals";
import notificationsRouter from "./notifications";
import supportRouter from "./support";
import settingsRouter from "./settings";
import testSeedRouter from "./test-seed";
import kycRouter from "./kyc";
import riskRouter from "./risk";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(walletRouter);
router.use(matchesRouter);
router.use(predictionsRouter);
router.use(adminRouter);
router.use(cricketRouter);
router.use(depositsRouter);
router.use(withdrawalsRouter);
router.use(notificationsRouter);
router.use(supportRouter);
router.use(settingsRouter);
router.use(kycRouter);
router.use(riskRouter);

// Test-only seeding endpoints — never available in production
if (process.env["NODE_ENV"] !== "production") {
  router.use(testSeedRouter);
}

export default router;
