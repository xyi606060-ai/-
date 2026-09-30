import { DatingApp } from '@/components/dating-app';
import { AuthGate } from '@/components/auth-gate';

export default function Home() {
  return (
    <main className="min-h-dvh bg-background">
      <AuthGate>
        <DatingApp />
      </AuthGate>
    </main>
  );
}