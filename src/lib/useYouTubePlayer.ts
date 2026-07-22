"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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

  const videoIdRef = useRef<string | null>(videoId);
  const loadedIdRef = useRef<string | null>(null);
  const endedForVideoRef = useRef<string | null>(null);
  const ignoreEndedUntilRef = useRef(0);
  const pendingPlayRef = useRef(false);
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    videoIdRef.current = videoId;
  }, [videoId]);

  useEffect(() => {
    audioUnlockedRef.current = audioUnlocked;
  }, [audioUnlocked]);

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

            if (e.data === 1) {
              setAudioUnlocked(true);
              pendingPlayRef.current = false;
            }

            // After loadVideoById, play once when cued (avoids restart loops).
            if (e.data === 5 && pendingPlayRef.current) {
              pendingPlayRef.current = false;
              try {
                mainPlayer.current?.playVideo?.();
              } catch {
                /* ignore */
              }
            }

            if (e.data === 0) {
              if (Date.now() < ignoreEndedUntilRef.current) return;
              const vid = videoIdRef.current;
              if (!vid || endedForVideoRef.current === vid) return;
              endedForVideoRef.current = vid;
              onEndedRef.current();
              // If advance fails and the same track is still loaded, allow retry.
              window.setTimeout(() => {
                if (
                  loadedIdRef.current === vid &&
                  endedForVideoRef.current === vid
                ) {
                  endedForVideoRef.current = null;
                }
              }, 4000);
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

  // Load a video only when the id actually changes — never re-load the same
  // track (that caused "plays a few seconds again then skips").
  useEffect(() => {
    if (!ready || !mainPlayer.current) return;
    if (!videoId) {
      loadedIdRef.current = null;
      mainPlayer.current.stopVideo?.();
      return;
    }
    if (loadedIdRef.current === videoId) return;

    loadedIdRef.current = videoId;
    endedForVideoRef.current = null;
    ignoreEndedUntilRef.current = Date.now() + 2500;
    pendingPlayRef.current = true;
    mainPlayer.current.loadVideoById(videoId);
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
