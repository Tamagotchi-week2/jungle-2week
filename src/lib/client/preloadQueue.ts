'use client';

/**
 * 이미지 URL 목록을 제한된 동시 수(concurrency)로 순차 처리하는 큐.
 * 한꺼번에 전부 요청하면 연결이 몰려 개별 응답이 오히려 늦어지므로,
 * 워커 몇 개가 큐에서 하나씩 꺼내 로드하고 끝나는 대로 다음 걸 집는 방식이다.
 */
export function preloadImagesWithProgress(
  urls: string[],
  concurrency: number,
  onProgress: (loaded: number, total: number) => void,
): Promise<void> {
  const total = urls.length;
  if (total === 0) {
    onProgress(0, 0);
    return Promise.resolve();
  }

  let nextIndex = 0;
  let loaded = 0;
  onProgress(0, total);

  const loadOne = (url: string) =>
    new Promise<void>((resolve) => {
      const img = new Image();
      // 실패한 이미지도 진행도에서는 "처리됨"으로 센다 — 하나 실패했다고
      // 로딩 화면이 영원히 멈춰있으면 안 된다.
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    });

  const worker = async () => {
    while (nextIndex < total) {
      const url = urls[nextIndex];
      nextIndex += 1;
      await loadOne(url);
      loaded += 1;
      onProgress(loaded, total);
    }
  };

  const workerCount = Math.min(concurrency, total);
  return Promise.all(Array.from({ length: workerCount }, worker)).then(() => undefined);
}
