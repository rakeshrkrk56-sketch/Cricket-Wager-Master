import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  getGetAdminStatsQueryKey,
  useGetAdminStats,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

const ALERTS_PREFERENCE_KEY = "jazment_ops_request_alerts_enabled";
const APP_TITLE = "Jazment Ops";

type NotificationState = NotificationPermission | "unsupported";

interface PendingRequestAlertsContextValue {
  alertsEnabled: boolean;
  setAlertsEnabled: (enabled: boolean) => void;
  notificationState: NotificationState;
}

const PendingRequestAlertsContext = createContext<PendingRequestAlertsContextValue | undefined>(undefined);

function readAlertsPreference() {
  return localStorage.getItem(ALERTS_PREFERENCE_KEY) !== "false";
}

function getNotificationState(): NotificationState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export function PendingRequestAlertsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [alertsEnabled, setAlertsEnabledState] = useState(readAlertsPreference);
  const [notificationState, setNotificationState] = useState<NotificationState>(getNotificationState);
  const previousCounts = useRef<{ deposits: number; withdrawals: number } | null>(null);
  const audioContext = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (audioContext.current) return audioContext.current;

    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;

    audioContext.current = new AudioContextConstructor();
    return audioContext.current;
  }, []);

  const resumeAudio = useCallback(() => {
    const context = getAudioContext();
    if (context?.state === "suspended") void context.resume();
  }, [getAudioContext]);

  const playChime = useCallback(() => {
    const context = getAudioContext();
    if (!context) return;

    if (context.state === "suspended") void context.resume();

    const now = context.currentTime;
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.setValueAtTime(1174, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.24);
  }, [getAudioContext]);

  const requestNotificationPermission = useCallback(() => {
    if (typeof Notification === "undefined") {
      setNotificationState("unsupported");
      return;
    }
    if (Notification.permission !== "default") {
      setNotificationState(Notification.permission);
      return;
    }

    void Notification.requestPermission()
      .then(setNotificationState)
      .catch(() => setNotificationState(Notification.permission));
  }, []);

  const setAlertsEnabled = useCallback(
    (enabled: boolean) => {
      setAlertsEnabledState(enabled);
      localStorage.setItem(ALERTS_PREFERENCE_KEY, String(enabled));

      if (enabled) {
        // These calls happen in the switch's user gesture, allowing browsers
        // to resume audio and show their notification permission prompt.
        resumeAudio();
        requestNotificationPermission();
      }
    },
    [requestNotificationPermission, resumeAudio],
  );

  const { data: stats } = useGetAdminStats({
    query: {
      queryKey: getGetAdminStatsQueryKey(),
      enabled: isAuthenticated,
      refetchInterval: 30_000,
    },
  });

  const pendingDeposits = isAuthenticated ? (stats?.pendingDepositsCount ?? 0) : 0;
  const pendingWithdrawals = isAuthenticated ? (stats?.pendingWithdrawalsCount ?? 0) : 0;
  const totalPending = pendingDeposits + pendingWithdrawals;

  useEffect(() => {
    document.title = totalPending > 0 ? `(${totalPending}) ${APP_TITLE}` : APP_TITLE;
  }, [totalPending]);

  useEffect(() => {
    if (!isAuthenticated) {
      previousCounts.current = null;
      return;
    }
    if (!stats) return;

    const currentCounts = {
      deposits: stats.pendingDepositsCount,
      withdrawals: stats.pendingWithdrawalsCount,
    };
    const previous = previousCounts.current;
    previousCounts.current = currentCounts;

    // Establish a baseline on the first response so opening the admin panel
    // does not announce requests that were already waiting.
    if (!previous || !alertsEnabled) return;

    const newDeposits = Math.max(0, currentCounts.deposits - previous.deposits);
    const newWithdrawals = Math.max(0, currentCounts.withdrawals - previous.withdrawals);
    if (newDeposits === 0 && newWithdrawals === 0) return;

    playChime();

    if (notificationState === "granted") {
      const parts = [
        newDeposits > 0 ? `${newDeposits} new deposit${newDeposits === 1 ? "" : "s"}` : "",
        newWithdrawals > 0 ? `${newWithdrawals} new withdrawal${newWithdrawals === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      try {
        new Notification("Jazment Ops: New request", {
          body: `${parts.join(" and ")} awaiting review.`,
          tag: "jazment-pending-requests",
        });
      } catch {
        // A browser can revoke notification permission between polling
        // intervals. The chime remains available as the fallback alert.
      }
    }
  }, [alertsEnabled, isAuthenticated, notificationState, playChime, stats]);

  useEffect(() => {
    // A login click or any later interaction unlocks Web Audio for future
    // polling alerts without requiring an extra setup step.
    const handleInteraction = () => resumeAudio();
    window.addEventListener("pointerdown", handleInteraction, { once: true });
    window.addEventListener("keydown", handleInteraction, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [resumeAudio]);

  return (
    <PendingRequestAlertsContext.Provider
      value={{ alertsEnabled, setAlertsEnabled, notificationState }}
    >
      {children}
    </PendingRequestAlertsContext.Provider>
  );
}

export function usePendingRequestAlerts() {
  const context = useContext(PendingRequestAlertsContext);
  if (!context) {
    throw new Error("usePendingRequestAlerts must be used within PendingRequestAlertsProvider");
  }
  return context;
}