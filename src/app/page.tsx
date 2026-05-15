'use client'
import AuthBridge from '@/components/AuthBridge'
import Dashboard from '@/components/Dashboard'
import BettingLobby from '@/components/BettingLobby'
import Derivatives from '@/components/Derivatives'
import TopNavbar from '@/components/TopNavbar'
import { useStore } from '@/store/useStore'
import { useCasinoHeartbeat } from '@/hooks/useCasinoHeartbeat'

export default function Home() {
  useCasinoHeartbeat()

  const hasEnteredCasino = useStore((state) => state.hasEnteredCasino);
  const currentView = useStore((state) => state.currentView);

  if (hasEnteredCasino) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col">
        {/* 全域頂部導航 */}
        <TopNavbar />
        
        {/* 視圖抽換區 (SPA 0-Latency Routing) */}
        <div className="flex-1 overflow-y-auto w-full h-full p-4">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'betting' && <BettingLobby />}
          {currentView === 'derivatives' && <Derivatives />}
        </div>
      </main>
    );
  }

  // Auth 登入畫面
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