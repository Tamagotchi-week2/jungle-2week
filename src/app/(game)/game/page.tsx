import Village from '@/components/village/Village';

/**
 * 마을 화면 (설계 4장).
 *
 * B 는 이 화면을 루트(`/`)에 두었지만, 인증 게이트가 로그인 성공 시 `/game` 으로
 * 보내므로(17.1) 여기로 옮겼다. 루트는 세션 유무에 따라 분기만 한다.
 */
export default function GamePage() {
  return <Village />;
}
