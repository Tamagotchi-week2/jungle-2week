"use client";

import { useEffect, useRef, useState } from "react";

const VOLUME = 0.35;
const MUTE_KEY = "bgm-muted";

interface BackgroundMusicProps {
  src: string | string[] | null;
}

/**
 * 화면별 배경음악을 재생한다. src 가 배열이면 한 곡이 끝날 때마다 다음 곡으로
 * 넘어가며 번갈아 재생하고, 문자열이면 그 한 곡을 반복한다. src(목록)가
 * 바뀌면 같은 <audio> 엘리먼트가 새 트랙으로 갈아탄다. 브라우저 자동재생
 * 정책상 사용자 상호작용 전에는 play() 가 막힐 수 있어, 첫 클릭/키 입력에서
 * 한 번 더 시도한다.
 */
export default function BackgroundMusic({ src }: BackgroundMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const playlist = src === null ? [] : Array.isArray(src) ? src : [src];
  const playlistKey = playlist.join("|");

  useEffect(() => {
    // 마운트 시 1회, 브라우저 저장소에서 읽어온다. SSR 에는 localStorage 가
    // 없어 effect 밖에서는 읽을 수 없다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMuted(window.localStorage.getItem(MUTE_KEY) === "1");
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || playlist.length === 0) return;

    let index = 0;
    audio.loop = playlist.length === 1;
    audio.volume = VOLUME;

    function playCurrent() {
      audio!.src = playlist[index];
      audio!.play().catch(() => {});
    }

    function advance() {
      index = (index + 1) % playlist.length;
      playCurrent();
    }

    playCurrent();
    audio.addEventListener("ended", advance);

    function retry() {
      audio!.play().catch(() => {});
    }
    window.addEventListener("pointerdown", retry, { once: true });
    window.addEventListener("keydown", retry, { once: true });
    return () => {
      audio.removeEventListener("ended", advance);
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playlistKey 가 playlist 내용을 대표한다
  }, [playlistKey]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = muted;
  }, [muted]);

  function toggleMute() {
    setMuted((prev) => {
      const next = !prev;
      window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      return next;
    });
  }

  if (playlist.length === 0) return null;

  return (
    <>
      <audio ref={audioRef} />
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "배경음악 켜기" : "배경음악 끄기"}
        className="mute-button fixed bottom-4 right-4 z-[60]"
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </>
  );
}
