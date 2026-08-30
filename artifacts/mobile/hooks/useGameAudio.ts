import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createAudioPlayer,
  setAudioModeAsync,
  setIsAudioActiveAsync,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export type GameSound =
  | "chipSelect"
  | "betPlace"
  | "betAccepted"
  | "betRejected"
  | "countdown"
  | "bettingClosed"
  | "cardDeal"
  | "cardReveal"
  | "resultWin"
  | "resultLoss"
  | "chipCollect"
  | "nextRound";

const MUTE_STORAGE_KEY = "jazment:dragon-tiger:muted";

const SOUND_SOURCES: Record<GameSound, number> = {
  chipSelect: require("../assets/sounds/dragon-tiger/chip-select.wav"),
  betPlace: require("../assets/sounds/dragon-tiger/bet-place.wav"),
  betAccepted: require("../assets/sounds/dragon-tiger/bet-accepted.wav"),
  betRejected: require("../assets/sounds/dragon-tiger/bet-rejected.wav"),
  countdown: require("../assets/sounds/dragon-tiger/countdown.wav"),
  bettingClosed: require("../assets/sounds/dragon-tiger/betting-closed.wav"),
  cardDeal: require("../assets/sounds/dragon-tiger/card-deal.wav"),
  cardReveal: require("../assets/sounds/dragon-tiger/card-reveal.wav"),
  resultWin: require("../assets/sounds/dragon-tiger/result-win.wav"),
  resultLoss: require("../assets/sounds/dragon-tiger/result-loss.wav"),
  chipCollect: require("../assets/sounds/dragon-tiger/chip-collect.wav"),
  nextRound: require("../assets/sounds/dragon-tiger/next-round.wav"),
};

type AudioPlayer = ReturnType<typeof createAudioPlayer>;

export function useGameAudio() {
  const playersRef = useRef<Partial<Record<GameSound, AudioPlayer>>>({});
  const mutedRef = useRef(true);
  const readyRef = useRef(false);
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      AsyncStorage.getItem(MUTE_STORAGE_KEY),
      setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "mixWithOthers",
      }),
      setIsAudioActiveAsync(AppState.currentState === "active"),
    ])
      .then(([savedMuted]) => {
        if (!mounted) return;
        const shouldMute = savedMuted === "true";
        mutedRef.current = shouldMute;
        setMutedState(shouldMute);
        readyRef.current = true;
      })
      .catch(() => {
        if (!mounted) return;
        mutedRef.current = false;
        readyRef.current = true;
      });

    for (const [name, source] of Object.entries(SOUND_SOURCES)) {
      playersRef.current[name as GameSound] = createAudioPlayer(source, {
        updateInterval: 1000,
      });
    }

    const subscription = AppState.addEventListener("change", (state) => {
      void setIsAudioActiveAsync(state === "active").catch(() => undefined);
    });

    return () => {
      mounted = false;
      subscription.remove();
      for (const player of Object.values(playersRef.current)) {
        player?.pause();
        player?.remove();
      }
      playersRef.current = {};
      readyRef.current = false;
      void setIsAudioActiveAsync(false).catch(() => undefined);
    };
  }, []);

  const play = useCallback(async (sound: GameSound) => {
    if (!readyRef.current || mutedRef.current) return;
    const player = playersRef.current[sound];
    if (!player) return;

    try {
      player.pause();
      await player.seekTo(0);
      player.play();
    } catch {
      // Sound feedback must never interrupt a real-money game action.
    }
  }, []);

  const setMuted = useCallback((nextMuted: boolean) => {
    readyRef.current = true;
    mutedRef.current = nextMuted;
    setMutedState(nextMuted);
    void AsyncStorage.setItem(MUTE_STORAGE_KEY, String(nextMuted)).catch(
      () => undefined,
    );
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted(!mutedRef.current);
  }, [setMuted]);

  return { muted, play, setMuted, toggleMuted };
}