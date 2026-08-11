import { TamagotchiShell } from './_components/TamagotchiShell';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-1 items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(circle at 50% 20%, #1c1c1c 0%, #050505 65%)' }}
    >
      <TamagotchiShell>{children}</TamagotchiShell>
    </div>
  );
}
