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
  videoId: string | null;
  nextVideoId: string | null;
  onEnded: () => void;
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
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // Prevent double-advance: YT often fires ENDED more than once, and may fire
  // ENDED again while the next video is loading — that used to skip songs.
  const videoIdRef = useRef<string | null>(videoId);
  const endedForVideoRef = useRef<string | null>(null);
  const ignoreEndedUntilRef = useRef(0);

  useEffect(() => {
    videoIdRef.current = videoId;
    endedForVideoRef.current = null;
    // Ignore ENDED for a moment after a track change (load transitions).
    ignoreEndedUntilRef.current = Date.now() + 1500;
  }, [videoId]);

  useEffect(() => {
    let cancelled = false;
    loadYouTubeAPI().then(() => {
      if (cancelled || !mainRef.current || !preloadRef.current) return;
      // @ts-expect-error - YT global
      const YT = window.YT;

      mainPlayer.current = new YT.Player(mainRef.current, {
        height: "100%",
        width: "100%",
        playerVars: { autoplay: 1, controls: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            setReady(true);
            mainPlayer.current?.setVolume(volume);
            onReady?.();
          },
          onStateChange: (e: { data: number }) => {
            const map: Record<number, PlayerState> = {
              [-1]: "unstarted",
              0: "ended",
              1: "playing",
              2: "paused",
              3: "buffering",
              5: "cued",
            };
            setState(map[e.data] ?? "unstarted");
            if (e.data === 1) setAudioUnlocked(true);

            if (e.data === 0) {
              if (Date.now() < ignoreEndedUntilRef.current) return;
              const vid = videoIdRef.current;
              if (!vid) return;
              if (endedForVideoRef.current === vid) return;
              endedForVideoRef.current = vid;
              onEndedRef.current();
            }
          },
        },
      });

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

  // Load + explicitly play so auto-advance works after a track ends.
  useEffect(() => {
    if (!ready || !mainPlayer.current) return;
    if (videoId) {
      mainPlayer.current.loadVideoById(videoId);
      // loadVideoById alone often leaves the next track paused after ENDED.
      const tryPlay = () => {
        try {
          mainPlayer.current?.playVideo?.();
        } catch {
          /* ignore */
        }
      };
      tryPlay();
      // Retry shortly — YT sometimes ignores the first playVideo during load.
      const t1 = window.setTimeout(tryPlay, 250);
      const t2 = window.setTimeout(tryPlay, 800);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
    mainPlayer.current.stopVideo?.();
  }, [videoId, ready]);

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
  const getCurrentTime = useCallback((): number => {
    try {
      const t = mainPlayer.current?.getCurrentTime?.();
      return typeof t === "number" && Number.isFinite(t) ? t : 0;
    } catch {
      return 0;
    }
  }, []);

  const unlock = useCallback(() => {
    mainPlayer.current?.playVideo?.();
    setAudioUnlocked(true);
  }, []);

  return {
    mainRef,
    preloadRef,
    ready,
    state,
    volume,
    audioUnlocked,
    play,
    pause,
    setVolume,
    getCurrentTime,
    unlock,
  };
}
