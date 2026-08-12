import { TamagotchiShell } from './_components/TamagotchiShell';
import BackgroundMusic from '@/components/ui/BackgroundMusic';
import { SOUNDS } from '@/lib/client/sounds';

/** 배경 숲에 배치할 장식용 동물. 게임에서 실제로 키울 수 있는 종의 성체 스프라이트를 재사용한다. */
const BACKGROUND_CRITTERS = [
  { src: '/sprites/adult/land_ab.webp', style: { left: '4%', bottom: '24%', width: '58px', animationDelay: '0s' } },
  { src: '/sprites/adult/land_bb.webp', style: { left: '17%', bottom: '5%', width: '50px', animationDelay: '0.4s' } },
  { src: '/sprites/adult/sea_bb.webp', style: { right: '8%', bottom: '15%', width: '56px', animationDelay: '0.9s' } },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative z-0 flex flex-1 items-center justify-center bg-cover bg-center px-4 py-10"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 20%, rgba(5,5,5,0.35) 0%, rgba(5,5,5,0.75) 65%), url('/sprites/backgrounds/village-surroundings.webp')",
      }}
    >
      {BACKGROUND_CRITTERS.map(({ src, style: { animationDelay, ...position } }) => (
        <div key={src} className="login-critter hidden sm:block" style={position}>
          <div className="login-critter-sprite-wrap" style={{ animationDelay }}>
            <img
              src={src}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="login-critter-sprite pixelated"
            />
            {/* 실루엣 모양의 반투명 검은 막 — 마스크로 스프라이트의 알파 채널을 그대로 따온다 */}
            <span
              className="login-critter-tint"
              style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }}
            />
          </div>
        </div>
      ))}
      {/* login <-> signup 전환에도 레이아웃이 리마운트되지 않으므로, 두 곡이
          여기서 계속 이어서 번갈아 재생된다 (TamagotchiShell 의 연출과 동일한 전제). */}
      <BackgroundMusic src={[SOUNDS.loginPrimary, SOUNDS.loginSecondary]} />
      <TamagotchiShell>{children}</TamagotchiShell>
    </div>
  );
}
