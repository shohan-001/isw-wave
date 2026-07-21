"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// --- YouTube IFrame API loader (single shared promise) --------------------
// This is the ACTIVE, audio-producing player. Per the brief, it lives ONLY on
// the admin dashboard (the laptop wired to venue speakers). The public display
// page is silent. Keeping a visible player here is also a YouTube ToS
// requirement — do not hide it.

let apiPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    // Already loaded?
    // @ts-expect-error - YT is injected by the script
    if (window.YT && window.YT.Player) return resolve();
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    // @ts-expect-error - callback name required by the API
    window.onYouTubeIframeAPIReady = () => resolve();
  });
  return apiPromise;
}

export type PlayerState =
  | "unstarted"
  | "ended"
  | "playing"
  | "paused"
  | "buffering"
  | "cued";

type Props = {
  videoId: string | null; // current now-playing video
  nextVideoId: string | null; // preloaded so transitions have no dead air
  onEnded: () => void; // fire "next"/mark-played when the video finishes
  onReady?: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YTPlayer = any;

export function useYouTubePlayer({
  videoId,
  nextVideoId,
  onEnded,
  onReady,
}: Props) {
  const mainRef = useRef<HTMLDivElement>(null);
  const preloadRef = useRef<HTMLDivElement>(null);
  const mainPlayer = useRef<YTPlayer>(null);
  const preloadPlayer = useRef<YTPlayer>(null);

  const [ready, setReady] = useState(false);
  const [state, setState] = useState<PlayerState>("unstarted");
  const [volume, setVolumeState] = useState(80);

  // Keep the latest onEnded in a ref so the YT event handler (bound once)
  // always calls the current callback.
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // Initialize both players once.
  useEffect(() => {
    let cancelled = false;
    loadYouTubeAPI().then(() => {
      if (cancelled || !mainRef.current || !preloadRef.current) return;
      // @ts-expect-error - YT global
      const YT = window.YT;

      mainPlayer.current = new YT.Player(mainRef.current, {
        height: "100%",
        width: "100%",
        playerVars: { autoplay: 0, controls: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            setReady(true);
            mainPlayer.current?.setVolume(volume);
            onReady?.();
          },
          onStateChange: (e: { data: number }) => {
            // 0 = ended, 1 = playing, 2 = paused, 3 = buffering, 5 = cued
            const map: Record<number, PlayerState> = {
              [-1]: "unstarted",
              0: "ended",
              1: "playing",
              2: "paused",
              3: "buffering",
              5: "cued",
            };
            setState(map[e.data] ?? "unstarted");
            if (e.data === 0) onEndedRef.current();
          },
        },
      });

      // Hidden preload player: we cueVideoById the next track so its data is
      // buffered and the visible transition is near-instant. NOTE: this removes
      // the LOAD gap only — it cannot skip YouTube ads (monetization-controlled,
      // out of scope).
      preloadPlayer.current = new YT.Player(preloadRef.current, {
        height: "1",
        width: "1",
        playerVars: { autoplay: 0, controls: 0 },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the current video when it changes.
  useEffect(() => {
    if (!ready || !mainPlayer.current) return;
    if (videoId) {
      mainPlayer.current.loadVideoById(videoId);
    } else {
      mainPlayer.current.stopVideo?.();
    }
  }, [videoId, ready]);

  // Cue the next video on the hidden preload player.
  useEffect(() => {
    if (!ready || !preloadPlayer.current) return;
    if (nextVideoId) {
      preloadPlayer.current.cueVideoById?.(nextVideoId);
    }
  }, [nextVideoId, ready]);

  const play = useCallback(() => mainPlayer.current?.playVideo?.(), []);
  const pause = useCallback(() => mainPlayer.current?.pauseVideo?.(), []);
  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    mainPlayer.current?.setVolume?.(v);
  }, []);

  return {
    mainRef,
    preloadRef,
    ready,
    state,
    volume,
    play,
    pause,
    setVolume,
  };
}
