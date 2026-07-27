import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const page = Number(req.query["page"] ?? 1);
  const limit = Number(req.query["limit"] ?? 30);
  const offset = (page - 1) * limit;

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id));

  const [{ unreadCount }] = await db
    .select({ unreadCount: count() })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.read, false)));

  res.json({
    notifications: notifications.map(serializeNotification),
    total: Number(total),
    unreadCount,
    page,
    limit,
  });
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, user.id));
  res.json({ success: true });
});

router.post("/notifications/:notificationId/read", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const notificationId = req.params["notificationId"] as string;
  const [n] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, notificationId));
  if (!n || n.userId !== user.id) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.id, notificationId));
  res.json({ success: true });
});

function serializeNotification(n: any) {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.read,
    createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
  };
}

export default router;
