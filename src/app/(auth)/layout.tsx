import { TamagotchiShell } from './_components/TamagotchiShell';
import BackgroundMusic from '@/components/ui/BackgroundMusic';
import { SOUNDS } from '@/lib/client/sounds';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-1 items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(circle at 50% 20%, #1c1c1c 0%, #050505 65%)' }}
    >
      {/* login <-> signup 전환에도 레이아웃이 리마운트되지 않으므로, 두 곡이
          여기서 계속 이어서 번갈아 재생된다 (TamagotchiShell 의 연출과 동일한 전제). */}
      <BackgroundMusic src={[SOUNDS.loginPrimary, SOUNDS.loginSecondary]} />
      <TamagotchiShell>{children}</TamagotchiShell>
    </div>
  );
}
