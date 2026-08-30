import { randomInt, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import {
  db,
  dragonTigerBetsTable,
  dragonTigerRoundsTable,
  platformSettingsTable,
  pool,
  type PoolClient,
  transactionsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import WebSocket, { WebSocketServer, type RawData } from "ws";
import { parseToken } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { ensureGameConfig } from "../lib/gameConfig";

const BETTING_MS = 15_000;
const REVEAL_MS = 5_000;
const AUTH_TIMEOUT_MS = 5_000;
const MAX_TABLE_PLAYERS = 4;
const CONTROL_MODE_KEY = "dragon_tiger_mode";
const CONTROL_PAUSED_KEY = "dragon_tiger_paused";
const PUBSUB_CHANNEL = "dragon_tiger_events";

export type GameMode = "AUTOMATIC" | "MANAGED";
type Choice = "DRAGON" | "TIGER" | "TIE";
type AuthenticatedSocket = WebSocket & { userId?: string };

function resultFor(dragonRank: number, tigerRank: number): Choice {
  if (dragonRank > tigerRank) return "DRAGON";
  if (tigerRank > dragonRank) return "TIGER";
  return "TIE";
}

function moneyToCents(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}

function centsToMoney(value: bigint): string {
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

function addMoney(left: string, right: string): string {
  return centsToMoney(moneyToCents(left) + moneyToCents(right));
}

function subtractMoney(left: string, right: string): string {
  return centsToMoney(moneyToCents(left) - moneyToCents(right));
}

function send(socket: WebSocket, message: unknown): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

export class DragonTigerGame {
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly instanceId = randomUUID();
  private timer?: NodeJS.Timeout;
  private pubSubRetry?: NodeJS.Timeout;
  private pubSubClient?: PoolClient;
  private mode: GameMode = "AUTOMATIC";
  private paused = false;
  private stopped = false;
  private readonly pendingPlayerIds = new Set<string>();

  attach(server: Server): void {
    server.on("upgrade", (request, socket, head) => {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      if (pathname !== "/ws/game") {
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(request, socket, head, (client: WebSocket) => {
        this.wss.emit("connection", client, request);
      });
    });

    this.wss.on("connection", (socket: AuthenticatedSocket) => {
      let reservedPlayerId: string | undefined;
      const authTimer = setTimeout(
        () => socket.close(4401, "Authentication required"),
        AUTH_TIMEOUT_MS,
      );
      socket.once("close", () => {
        clearTimeout(authTimer);
        if (reservedPlayerId) this.pendingPlayerIds.delete(reservedPlayerId);
      });

      socket.once("message", async (data: RawData) => {
        try {
          const message = JSON.parse(data.toString()) as {
            type?: string;
            token?: string;
          };
          if (message.type !== "AUTH" || typeof message.token !== "string") {
            socket.close(4401, "Invalid authentication message");
            return;
          }
          const parsed = parseToken(message.token.replace(/^Bearer\s+/i, ""));
          if (!parsed) {
            socket.close(4401, "Invalid token");
            return;
          }
          const [user] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, parsed.userId));
          if (!user || user.status === "suspended") {
            socket.close(4401, "User not found or suspended");
            return;
          }

          const connectedPlayerIds = this.getConnectedPlayerIds();
          const alreadyAtTable =
            connectedPlayerIds.has(user.id) ||
            this.pendingPlayerIds.has(user.id);
          if (
            !alreadyAtTable &&
            connectedPlayerIds.size + this.pendingPlayerIds.size >=
              MAX_TABLE_PLAYERS
          ) {
            send(socket, {
              type: "TABLE_FULL",
              code: "TABLE_FULL",
              message: `This table is full. Maximum ${MAX_TABLE_PLAYERS} players can join.`,
              capacity: MAX_TABLE_PLAYERS,
            });
            socket.close(4429, "Dragon Tiger table is full");
            return;
          }
          if (!alreadyAtTable) {
            reservedPlayerId = user.id;
            this.pendingPlayerIds.add(user.id);
          }

          clearTimeout(authTimer);
          socket.userId = user.id;
          if (reservedPlayerId) {
            this.pendingPlayerIds.delete(reservedPlayerId);
            reservedPlayerId = undefined;
          }
          send(socket, { type: "AUTH_OK" });
          send(socket, {
            type: "BALANCE",
            balance: Number(user.walletBalance),
          });
          send(socket, {
            type: "GAME_STATE",
            ...(await this.getPrivateState(socket.userId)),
          });
          socket.on(
            "message",
            (payload: RawData) =>
              void this.handleMessage(socket, payload.toString()),
          );
          socket.once("close", () => this.broadcastTableStatus());
          this.broadcastTableStatus();
        } catch {
          socket.close(4401, "Invalid authentication message");
        }
      });
    });

    void this.resume().catch((err) =>
      logger.error({ err }, "Unable to start Dragon Tiger game"),
    );
  }

  async getControlState() {
    await this.refreshControlState();
    return {
      ...(await this.getPublicState()),
      mode: this.mode,
      paused: this.paused,
    };
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.clearTimer();
    if (this.pubSubRetry) clearTimeout(this.pubSubRetry);
    const pubSubClient = this.pubSubClient;
    this.pubSubClient = undefined;
    if (pubSubClient) {
      pubSubClient.removeAllListeners("notification");
      pubSubClient.removeAllListeners("error");
      await pubSubClient
        .query(`UNLISTEN ${PUBSUB_CHANNEL}`)
        .catch(() => undefined);
      pubSubClient.release();
    }
    for (const socket of this.wss.clients)
      socket.close(1001, "Server shutting down");
    await new Promise<void>((resolve) => {
      if (this.wss.clients.size === 0) {
        this.wss.close(() => resolve());
        return;
      }
      const forceClose = setTimeout(() => {
        for (const socket of this.wss.clients) socket.terminate();
      }, 1_000);
      forceClose.unref();
      this.wss.close(() => {
        clearTimeout(forceClose);
        resolve();
      });
    });
  }

  async setControl(input: {
    mode?: GameMode;
    paused?: boolean;
    closeBetting?: boolean;
  }) {
    if (input.mode !== undefined) {
      await this.persistSetting(CONTROL_MODE_KEY, input.mode);
    }
    if (input.paused !== undefined) {
      await this.persistSetting(CONTROL_PAUSED_KEY, String(input.paused));
    }
    await this.refreshControlState();
    if (input.closeBetting) await this.closeBetting();
    if (!this.paused) await this.ensureRound();
    const state = await this.getControlState();
    this.broadcast({ type: "GAME_STATE", ...state });
    return state;
  }

  private async resume(): Promise<void> {
    await ensureGameConfig();
    await db
      .insert(platformSettingsTable)
      .values([
        { key: CONTROL_MODE_KEY, value: "AUTOMATIC", updatedAt: new Date() },
        { key: CONTROL_PAUSED_KEY, value: "false", updatedAt: new Date() },
      ])
      .onConflictDoNothing();
    await this.startPubSub();
    await this.refreshControlState();
    await this.ensureRound();
  }

  private async startPubSub(): Promise<void> {
    if (this.stopped || this.pubSubClient) return;
    let client: PoolClient | undefined;
    try {
      const connectedClient = await pool.connect();
      client = connectedClient;
      this.pubSubClient = connectedClient;
      connectedClient.on("notification", (notification) => {
        if (notification.channel !== PUBSUB_CHANNEL || !notification.payload)
          return;
        try {
          const event = JSON.parse(notification.payload) as {
            originId?: string;
            audience?: "all" | "user";
            userId?: string;
            message?: unknown;
          };
          if (event.originId === this.instanceId || event.message === undefined)
            return;
          if (event.audience === "user" && event.userId) {
            this.sendPrivateLocal(event.userId, event.message);
          } else if (event.audience === "all") {
            this.broadcastLocal(event.message);
            const type =
              typeof event.message === "object" && event.message !== null
                ? (event.message as { type?: unknown }).type
                : undefined;
            if (
              type === "ROUND_STARTED" ||
              type === "BETTING_CLOSED" ||
              type === "ROUND_RESULT" ||
              type === "GAME_STATE"
            ) {
              void this.ensureRound().catch((err) => {
                logger.error(
                  { err },
                  "Unable to reconcile Dragon Tiger timer from peer event",
                );
              });
            }
          }
        } catch (err) {
          logger.warn({ err }, "Ignored malformed Dragon Tiger pub/sub event");
        }
      });
      connectedClient.on("error", (err) => {
        logger.error({ err }, "Dragon Tiger pub/sub connection failed");
        if (this.pubSubClient === connectedClient)
          this.pubSubClient = undefined;
        connectedClient.release(true);
        this.schedulePubSubReconnect();
      });
      await connectedClient.query(`LISTEN ${PUBSUB_CHANNEL}`);
      this.broadcastLocal({
        type: "GAME_STATE",
        ...(await this.getPublicState()),
      });
      await this.ensureRound();
    } catch (err) {
      if (client) {
        if (this.pubSubClient === client) this.pubSubClient = undefined;
        client.release(true);
      }
      logger.error({ err }, "Unable to subscribe to Dragon Tiger events");
      this.schedulePubSubReconnect();
    }
  }

  private schedulePubSubReconnect(): void {
    if (this.stopped || this.pubSubRetry) return;
    this.pubSubRetry = setTimeout(() => {
      this.pubSubRetry = undefined;
      void this.startPubSub();
    }, 1_000);
    this.pubSubRetry.unref();
  }

  private publish(
    audience: "all" | "user",
    message: unknown,
    userId?: string,
  ): void {
    const payload = JSON.stringify({
      originId: this.instanceId,
      audience,
      userId,
      message,
    });
    void pool
      .query("select pg_notify($1, $2)", [PUBSUB_CHANNEL, payload])
      .catch((err) => {
        logger.error({ err }, "Unable to publish Dragon Tiger event");
      });
  }

  private async refreshControlState(): Promise<void> {
    const settings = await db
      .select()
      .from(platformSettingsTable)
      .where(
        sql`${platformSettingsTable.key} in (${CONTROL_MODE_KEY}, ${CONTROL_PAUSED_KEY})`,
      );
    const mode = settings.find((item) => item.key === CONTROL_MODE_KEY)?.value;
    this.mode = mode === "MANAGED" ? "MANAGED" : "AUTOMATIC";
    this.paused =
      settings.find((item) => item.key === CONTROL_PAUSED_KEY)?.value ===
      "true";
  }

  private async persistSetting(key: string, value: string): Promise<void> {
    await db
      .insert(platformSettingsTable)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformSettingsTable.key,
        set: { value, updatedAt: new Date() },
      });
  }

  private async handleMessage(
    socket: AuthenticatedSocket,
    raw: string,
  ): Promise<void> {
    let clientBetId: string | undefined;
    try {
      const message = JSON.parse(raw) as {
        type?: string;
        roundId?: string;
        clientBetId?: string;
        choice?: Choice;
        selection?: Choice;
        side?: Choice;
        amount?: number | string;
      };
      clientBetId =
        typeof message.clientBetId === "string"
          ? message.clientBetId.slice(0, 120)
          : undefined;
      if (message.type !== "BET" && message.type !== "PLACE_BET") {
        send(socket, {
          type: "ERROR",
          code: "UNKNOWN_MESSAGE",
          message: "Unknown message type",
          clientBetId,
        });
        return;
      }
      if (!socket.userId) return;
      const choice = message.choice ?? message.selection ?? message.side;
      const amount = String(message.amount ?? "");
      if (!choice || !["DRAGON", "TIGER", "TIE"].includes(choice)) {
        send(socket, {
          type: "ERROR",
          code: "INVALID_CHOICE",
          message: "Invalid bet choice",
          clientBetId,
        });
        return;
      }
      if (!/^\d{1,10}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
        send(socket, {
          type: "ERROR",
          code: "INVALID_AMOUNT",
          message: "Amount must be positive with at most two decimals",
          clientBetId,
        });
        return;
      }
      const placed = await this.placeBet(
        socket.userId,
        choice,
        amount,
        message.roundId,
      );
      send(socket, { type: "BET_ACCEPTED", bet: placed.bet, clientBetId });
      send(socket, { type: "BALANCE", balance: placed.balance });
      const publicBetActivity = {
        type: "BET_ACTIVITY",
        roundId: placed.bet.roundId,
        choice: placed.bet.choice,
        amount: Number(placed.bet.amount),
      };
      this.broadcastLocalExcept(socket, publicBetActivity);
      this.publish("all", publicBetActivity);
      this.broadcast({
        type: "POOLS_UPDATED",
        roundId: placed.bet.roundId,
        ...(await this.getPools(placed.bet.roundId)),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to place bet";
      const code =
        message === "INSUFFICIENT_BALANCE"
          ? message
          : message === "ACCOUNT_NOT_ACTIVE"
            ? message
            : message === "BETTING_CLOSED"
              ? message
              : message === "SIDE_LOCKED"
                ? message
                : "BET_FAILED";
      send(socket, { type: "ERROR", code, message, clientBetId });
    }
  }

  private async placeBet(
    userId: string,
    choice: Choice,
    amount: string,
    expectedRoundId?: string,
  ) {
    return db.transaction(async (tx) => {
      const [round] = await tx
        .select()
        .from(dragonTigerRoundsTable)
        .where(
          and(
            eq(dragonTigerRoundsTable.activeSlot, 1),
            eq(dragonTigerRoundsTable.status, "BETTING"),
          ),
        )
        .for("update");
      if (!round || round.bettingClosesAt.getTime() <= Date.now())
        throw new Error("BETTING_CLOSED");
      if (expectedRoundId && round.id !== expectedRoundId)
        throw new Error("BETTING_CLOSED");
      const [existingBet] = await tx
        .select({ choice: dragonTigerBetsTable.choice })
        .from(dragonTigerBetsTable)
        .where(
          and(
            eq(dragonTigerBetsTable.roundId, round.id),
            eq(dragonTigerBetsTable.userId, userId),
          ),
        )
        .limit(1);
      if (existingBet && existingBet.choice !== choice)
        throw new Error("SIDE_LOCKED");

      const [updatedUser] = await tx
        .update(usersTable)
        .set({
          walletBalance: sql`${usersTable.walletBalance} - ${amount}::numeric`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(usersTable.id, userId),
            eq(usersTable.status, "active"),
            gte(usersTable.walletBalance, amount),
          ),
        )
        .returning();
      if (!updatedUser) {
        const [account] = await tx
          .select({ status: usersTable.status })
          .from(usersTable)
          .where(eq(usersTable.id, userId));
        throw new Error(
          account?.status === "active"
            ? "INSUFFICIENT_BALANCE"
            : "ACCOUNT_NOT_ACTIVE",
        );
      }

      const balanceAfter = Number(updatedUser.walletBalance);
      const balanceBefore = addMoney(updatedUser.walletBalance, amount);
      const [bet] = await tx
        .insert(dragonTigerBetsTable)
        .values({
          roundId: round.id,
          userId,
          choice,
          amount,
        })
        .returning();
      await tx.insert(transactionsTable).values({
        userId,
        type: "bet_placed",
        amount,
        balanceBefore,
        balanceAfter: String(balanceAfter),
        referenceId: bet.id,
        note: `Dragon Tiger ${choice} bet`,
      });
      return {
        balance: balanceAfter,
        bet: { ...bet, amount: Number(bet.amount), payout: Number(bet.payout) },
      };
    });
  }

  private async ensureRound(): Promise<void> {
    this.clearTimer();
    const { active, created } = await db.transaction(async (tx) => {
      const settings = await tx
        .select()
        .from(platformSettingsTable)
        .where(
          sql`${platformSettingsTable.key} in (${CONTROL_MODE_KEY}, ${CONTROL_PAUSED_KEY})`,
        )
        .for("update");
      const mode = settings.find(
        (item) => item.key === CONTROL_MODE_KEY,
      )?.value;
      this.mode = mode === "MANAGED" ? "MANAGED" : "AUTOMATIC";
      this.paused =
        settings.find((item) => item.key === CONTROL_PAUSED_KEY)?.value ===
        "true";

      const [current] = await tx
        .select()
        .from(dragonTigerRoundsTable)
        .where(eq(dragonTigerRoundsTable.activeSlot, 1))
        .limit(1);
      if (current || this.paused)
        return { active: current, created: undefined };

      const [newRound] = await tx
        .insert(dragonTigerRoundsTable)
        .values({ bettingClosesAt: new Date(Date.now() + BETTING_MS) })
        .onConflictDoNothing()
        .returning();
      return { active: newRound, created: newRound };
    });

    if (!active) {
      if (!this.paused) this.schedule(() => this.ensureRound(), 100);
      return;
    }
    if (created) {
      this.broadcast({
        type: "ROUND_STARTED",
        ...(await this.publicStateForRound(created)),
      });
      this.schedule(
        () => this.closeBetting(),
        created.bettingClosesAt.getTime() - Date.now(),
      );
      return;
    }
    if (active.status === "BETTING") {
      const remaining = active.bettingClosesAt.getTime() - Date.now();
      if (remaining <= 0) await this.closeBetting();
      else this.schedule(() => this.closeBetting(), remaining);
    } else if (active.status === "REVEAL") {
      const remaining =
        (active.revealEndsAt?.getTime() ?? Date.now()) - Date.now();
      if (remaining <= 0) await this.settleRound(active.id);
      else this.schedule(() => this.settleRound(active.id), remaining);
    }
  }

  async closeBetting(): Promise<void> {
    this.clearTimer();
    const dragonRank = randomInt(1, 14);
    const tigerRank = randomInt(1, 14);

    const revealEndsAt = new Date(Date.now() + REVEAL_MS);
    const [round] = await db
      .update(dragonTigerRoundsTable)
      .set({
        status: "REVEAL",
        dragonRank,
        tigerRank,
        result: resultFor(dragonRank, tigerRank),
        revealEndsAt,
      })
      .where(
        and(
          eq(dragonTigerRoundsTable.activeSlot, 1),
          eq(dragonTigerRoundsTable.status, "BETTING"),
        ),
      )
      .returning();
    if (!round) {
      await this.ensureRound();
      return;
    }
    this.broadcast({
      type: "BETTING_CLOSED",
      ...(await this.publicStateForRound(round)),
    });
    this.schedule(() => this.settleRound(round.id), REVEAL_MS);
  }

  private async settleRound(roundId: string): Promise<void> {
    this.clearTimer();
    const [round] = await db
      .select()
      .from(dragonTigerRoundsTable)
      .where(
        and(
          eq(dragonTigerRoundsTable.id, roundId),
          eq(dragonTigerRoundsTable.status, "REVEAL"),
        ),
      );
    if (!round?.result) {
      await this.ensureRound();
      return;
    }

    const bets = await db
      .select()
      .from(dragonTigerBetsTable)
      .where(
        and(
          eq(dragonTigerBetsTable.roundId, roundId),
          eq(dragonTigerBetsTable.status, "PENDING"),
        ),
      );
    for (const bet of bets) {
      const won = bet.choice === round.result;
      const payout = won
        ? centsToMoney(
            moneyToCents(bet.amount) * BigInt(bet.choice === "TIE" ? 9 : 2),
          )
        : "0.00";
      const balance = await db.transaction(async (tx) => {
        const [claimed] = await tx
          .update(dragonTigerBetsTable)
          .set({
            status: won ? "WON" : "LOST",
            payout,
            settledAt: new Date(),
          })
          .where(
            and(
              eq(dragonTigerBetsTable.id, bet.id),
              eq(dragonTigerBetsTable.status, "PENDING"),
            ),
          )
          .returning();
        // The original bet_placed transaction is the economic debit. A second
        // "loss" transaction would duplicate that movement, so losing bets are
        // represented by their terminal bet status only.
        if (!claimed || !won) return undefined;
        const [user] = await tx
          .update(usersTable)
          .set({
            walletBalance: sql`${usersTable.walletBalance} + ${payout}::numeric`,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, bet.userId))
          .returning();
        const balanceAfter = Number(user.walletBalance);
        await tx.insert(transactionsTable).values({
          userId: bet.userId,
          type: "win",
          amount: payout,
          balanceBefore: subtractMoney(user.walletBalance, payout),
          balanceAfter: String(balanceAfter),
          referenceId: bet.id,
          note: `Dragon Tiger ${round.result} payout`,
        });
        return balanceAfter;
      });
      if (balance !== undefined)
        this.sendPrivate(bet.userId, { type: "BALANCE", balance });
    }

    const [settled] = await db
      .update(dragonTigerRoundsTable)
      .set({
        status: "SETTLED",
        activeSlot: null,
        settledAt: new Date(),
      })
      .where(
        and(
          eq(dragonTigerRoundsTable.id, roundId),
          eq(dragonTigerRoundsTable.status, "REVEAL"),
        ),
      )
      .returning();
    if (settled) {
      this.broadcast({
        type: "ROUND_RESULT",
        ...(await this.publicStateForRound(settled)),
      });
    }
    await this.ensureRound();
  }

  private async getPublicState() {
    const [round] = await db
      .select()
      .from(dragonTigerRoundsTable)
      .where(eq(dragonTigerRoundsTable.activeSlot, 1))
      .limit(1);
    if (!round) {
      const exposure = this.emptyPools();
      return {
        round: null,
        game: null,
        ...exposure,
        serverTime: new Date().toISOString(),
      };
    }
    return this.publicStateForRound(round);
  }

  private async getPrivateState(userId: string) {
    const state = await this.getPublicState();
    if (!state.round) return { ...state, myBets: [] };
    const myBets = await db
      .select({
        id: dragonTigerBetsTable.id,
        roundId: dragonTigerBetsTable.roundId,
        choice: dragonTigerBetsTable.choice,
        amount: dragonTigerBetsTable.amount,
        status: dragonTigerBetsTable.status,
      })
      .from(dragonTigerBetsTable)
      .where(
        and(
          eq(dragonTigerBetsTable.roundId, state.round.id),
          eq(dragonTigerBetsTable.userId, userId),
        ),
      );
    return {
      ...state,
      myBets: myBets.map((bet) => ({ ...bet, amount: Number(bet.amount) })),
    };
  }

  private getConnectedPlayerIds(): Set<string> {
    const playerIds = new Set<string>();
    for (const socket of this.wss.clients) {
      const userId = (socket as AuthenticatedSocket).userId;
      if (userId) playerIds.add(userId);
    }
    return playerIds;
  }

  private broadcastTableStatus(): void {
    this.broadcast({
      type: "TABLE_STATUS",
      players: this.getConnectedPlayerIds().size,
      capacity: MAX_TABLE_PLAYERS,
    });
  }

  private async publicStateForRound(
    round: typeof dragonTigerRoundsTable.$inferSelect,
  ) {
    const canonicalRound = this.publicRound(round);
    const exposure = await this.getPools(round.id);
    const phaseEndsAt =
      round.status === "BETTING" ? round.bettingClosesAt : round.revealEndsAt;
    const secondsRemaining = Math.max(
      0,
      Math.ceil(((phaseEndsAt?.getTime() ?? Date.now()) - Date.now()) / 1_000),
    );
    return {
      round: canonicalRound,
      // Compatibility view for realtime clients. `round` remains canonical.
      game: {
        state: round.status,
        phase: round.status,
        roundId: round.id,
        secondsRemaining,
        remainingSeconds: secondsRemaining,
        timer: secondsRemaining,
        phaseEndsAt: phaseEndsAt?.toISOString() ?? null,
        pools: exposure.pools,
        liabilities: exposure.liabilities,
        dragonCard:
          round.status === "BETTING" ? null : { rank: round.dragonRank },
        tigerCard:
          round.status === "BETTING" ? null : { rank: round.tigerRank },
        result: round.status === "BETTING" ? null : round.result,
      },
      ...exposure,
      serverTime: new Date().toISOString(),
    };
  }

  private publicRound(round: typeof dragonTigerRoundsTable.$inferSelect) {
    return {
      id: round.id,
      status: round.status,
      bettingClosesAt: round.bettingClosesAt.toISOString(),
      revealEndsAt: round.revealEndsAt?.toISOString() ?? null,
      dragonRank: round.status === "BETTING" ? null : round.dragonRank,
      tigerRank: round.status === "BETTING" ? null : round.tigerRank,
      result: round.status === "BETTING" ? null : round.result,
    };
  }

  private emptyPools() {
    return {
      pools: { DRAGON: 0, TIGER: 0, TIE: 0 },
      liabilities: { DRAGON: 0, TIGER: 0, TIE: 0 },
      activePlayers: 0,
    };
  }

  private async getPools(roundId: string) {
    const rows = await db
      .select({
        choice: dragonTigerBetsTable.choice,
        total: sql<string>`coalesce(sum(${dragonTigerBetsTable.amount}), 0)`,
        players: sql<string>`count(distinct ${dragonTigerBetsTable.userId})`,
      })
      .from(dragonTigerBetsTable)
      .where(eq(dragonTigerBetsTable.roundId, roundId))
      .groupBy(dragonTigerBetsTable.choice);
    const values = this.emptyPools();
    for (const row of rows) {
      const total = Number(row.total);
      values.pools[row.choice] = total;
      values.liabilities[row.choice] = total * (row.choice === "TIE" ? 9 : 2);
      values.activePlayers += Number(row.players);
    }
    return values;
  }

  private broadcast(message: unknown): void {
    this.broadcastLocal(message);
    this.publish("all", message);
  }

  private broadcastLocal(message: unknown): void {
    for (const socket of this.wss.clients) {
      const authenticated = socket as AuthenticatedSocket;
      if (authenticated.userId) send(authenticated, message);
    }
  }

  private broadcastLocalExcept(
    excludedSocket: WebSocket,
    message: unknown,
  ): void {
    for (const socket of this.wss.clients) {
      const authenticated = socket as AuthenticatedSocket;
      if (socket !== excludedSocket && authenticated.userId)
        send(authenticated, message);
    }
  }

  private sendPrivate(userId: string, message: unknown): void {
    this.sendPrivateLocal(userId, message);
    this.publish("user", message, userId);
  }

  private sendPrivateLocal(userId: string, message: unknown): void {
    for (const socket of this.wss.clients) {
      const authenticated = socket as AuthenticatedSocket;
      if (authenticated.userId === userId) send(authenticated, message);
    }
  }

  private schedule(action: () => Promise<void>, delay: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(
      () => {
        void action().catch((err) => {
          logger.error({ err }, "Dragon Tiger transition failed");
          this.schedule(() => this.ensureRound(), 1_000);
        });
      },
      Math.max(0, delay),
    );
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
}

export const dragonTigerGame = new DragonTigerGame();
