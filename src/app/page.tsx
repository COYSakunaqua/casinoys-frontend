'use client'
import AuthBridge from '@/components/AuthBridge'
import Dashboard from '@/components/Dashboard'
import { useStore } from '@/store/useStore'

export default function Home() {
  const hasEnteredCasino = useStore((state) => state.hasEnteredCasino);

  if (hasEnteredCasino) return <Dashboard />;

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black z-0" />
      <div className="z-10 mb-12 text-center">
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 tracking-tighter mb-2">
          CasinOYS V5
        </h1>
        <p className="text-gray-400 font-mono text-sm tracking-widest uppercase">Neural Link & Genesis Airdrop</p>
      </div>
      <div className="z-10 w-full max-w-md"><AuthBridge /></div>
      <div className="fixed bottom-4 text-xs text-gray-600 font-mono z-10 uppercase tracking-widest">
        SYSTEM STATUS: DUAL-TRACK MIGRATION ACTIVE
      </div>
    </main>
  );
}