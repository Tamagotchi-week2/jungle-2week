/**
 * 다마고치 달걀 UI 전체가 하나의 컨테이너 쿼리 기준(egg 본체의 inline-size)으로
 * 스케일된다. 이 파일의 px 값은 "기준 디자인"(달걀 폭 320px)에서 측정한 값이며,
 * cq() 로 변환하면 달걀이 커지거나 작아져도 모든 요소(체인·화면·버튼·로그인 폼)가
 * 같은 비율로 함께 스케일된다 — 폼만 따로 줄이면 로그인 화면 안에 담기지 않는다.
 */
const EGG_REFERENCE_WIDTH = 320;

export function cq(px: number): string {
  return `${(px / EGG_REFERENCE_WIDTH) * 100}cqw`;
}
