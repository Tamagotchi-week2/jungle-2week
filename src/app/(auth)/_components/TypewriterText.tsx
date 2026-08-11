'use client';

import { useEffect, useState } from 'react';

/**
 * 실험적 기능 — 로그인 화면 텍스트에 타이핑 효과를 넣어본다. 마음에 안 들면
 * 이 파일을 지우고 사용하는 곳에서 <TypewriterText text="...">를
 * 원래 텍스트로 되돌리면 그만이다.
 *
 * 실제로는 텍스트 전체를 항상 DOM에 두고 아직 안 보여줄 부분만 투명 처리한다
 * (레이아웃 폭이 타이핑 중에도 흔들리지 않는다). 스크린 리더용으로 완성된
 * 텍스트를 sr-only 로 따로 둬서, 타이핑이 끝나기 전에도 전체 내용을 읽을 수 있다.
 */
interface TypewriterTextProps {
  text: string;
  /** 한 글자당 지연시간(ms) */
  speed?: number;
  /** 타이핑 시작 전 대기시간(ms) */
  delay?: number;
}

export function TypewriterText({ text, speed = 45, delay = 0 }: TypewriterTextProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 모션 축소 환경에서는 타이핑 없이 바로 전체 텍스트를 보여준다
      setCount(text.length);
      return;
    }

    let i = 0;
    let interval: ReturnType<typeof setInterval>;
    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= text.length) clearInterval(interval);
      }, speed);
    }, delay);

    return () => {
      clearTimeout(startTimer);
      clearInterval(interval);
    };
  }, [text, speed, delay]);

  return (
    <span>
      <span aria-hidden="true">
        {text.slice(0, count)}
        <span className="opacity-0">{text.slice(count)}</span>
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
