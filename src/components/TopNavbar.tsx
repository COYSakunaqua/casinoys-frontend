'use client'

import { motion } from 'framer-motion'
import { Coins } from 'lucide-react'
import { useStore, ViewState } from '@/store/useStore'

const NAV_ITEMS: { view: ViewState; label: string }[] = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'betting', label: 'Betting Lobby' },
  { view: 'derivatives', label: 'Derivatives' },
]

export default function TopNavbar() {
  const {
    balance,
    vipLevel,
    currentView,
    setCurrentView,
    marqueeMessages,
  } = useStore()

  const marqueeText =
    marqueeMessages.length > 0
      ? marqueeMessages.map((m) => m.text).join('  ✦  ')
      : 'SYSTEM: CasinOYS V5 online — awaiting telemetry...'

  return (
    <header className="sticky top-0 z-50 w-full flex flex-col">
      {/* Marquee broadcast strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-7 bg-black/90 border-b border-lime-500/20 overflow-hidden flex items-center"
      >
        <div className="w-full flex whitespace-nowrap">
          <motion.div
            animate={{ x: ['100%', '-100%'] }}
            transition={{ repeat: Infinity, duration: 28, ease: 'linear' }}
            className="text-[11px] font-mono tracking-widest font-bold text-lime-400 drop-shadow-[0_0_6px_rgba(163,230,53,0.5)] px-4"
          >
            <span className="text-yellow-400 mr-3">[BROADCAST]</span>
            {marqueeText}
            <span className="text-yellow-400/60 mx-6">✦</span>
            {marqueeText}
          </motion.div>
        </div>
      </motion.div> {/* <--- 艦長，就是這裡！我幫你把剛才漏掉的結尾補上了 */}

      {/* Main command navbar */}
      <nav className="bg-gray-950/75 backdrop-blur-xl border-b border-cyan-500/20 shadow-[0_4px_24px_rgba(34,211,238,0.06)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="shrink-0 cursor-pointer"
            onClick={() => setCurrentView('dashboard')}
          >
            <h1 className="text-lg sm:text-xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 drop-shadow-[0_0_12px_rgba(34,211,238,0.35)]">
              CasinOYS V5
            </h1>
          </motion.div>

          {/* SPA view switcher */}
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1 sm:gap-2 flex-1 justify-center min-w-0"
          >
            {NAV_ITEMS.map(({ view, label }) => {
              const isActive = currentView === view
              return (
                <button
                  key={view}
                  type="button"
                  onClick={() => setCurrentView(view)}
                  className={`relative px-2.5 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                    isActive
                      ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-400/60 shadow-[0_0_16px_rgba(52,211,153,0.45)] ring-1 ring-emerald-400/50'
                      : 'text-gray-400 border border-transparent hover:text-gray-200 hover:bg-gray-800/60 hover:border-gray-700'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-glow"
                      className="absolute inset-0 rounded-lg bg-emerald-400/5 pointer-events-none"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              )
            })}
          </motion.div>

          {/* Balance & VIP */}
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 sm:gap-3 shrink-0"
          >
            <div className="flex items-center gap-1.5 bg-black/50 border border-gray-800 rounded-lg px-2.5 py-1.5">
              <Coins className="w-4 h-4 text-yellow-400 shrink-0" />
              <motion.span
                key={balance}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                className="font-mono font-bold text-sm sm:text-base text-green-400 tabular-nums"
              >
                ${balance.toLocaleString()}
              </motion.span>
            </div>
            <span className="bg-yellow-500/15 text-yellow-400 text-[10px] sm:text-xs font-bold px-2 py-1 rounded border border-yellow-500/40 font-mono whitespace-nowrap">
              VIP: {vipLevel}
            </span>
          </motion.div>
        </div>
      </nav>
    </header>
  )
}