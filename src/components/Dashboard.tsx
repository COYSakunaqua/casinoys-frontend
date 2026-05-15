'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { supabase } from '@/lib/supabase'
import { TrendingUp, Zap, ChevronRight } from 'lucide-react'

const ACTIVITY_SLIDES = [
  {
    tag: 'LIVE',
    title: 'Blood Moon Protocol',
    body: '國庫 M0 達標時觸發全服狂熱 — All-In 額外 +60% 賠率增益。',
    accent: 'from-red-600/20 to-orange-600/10 border-red-500/30 text-red-300',
  },
  {
    tag: 'NEW',
    title: 'The Odds Exchange',
    body: '三向盤口已上線：主隊 / 平局 / 客隊，即時樂觀結算。',
    accent: 'from-emerald-600/20 to-cyan-600/10 border-emerald-500/30 text-emerald-300',
  },
  {
    tag: 'VIP',
    title: 'Derivatives Vault',
    body: '盲盒期貨與 75% 提前套現 — 控制你的風險敞口。',
    accent: 'from-purple-600/20 to-amber-600/10 border-purple-500/30 text-purple-300',
  },
]

export default function Dashboard() {
  const { setCurrentView, addMarqueeMessage, vipLevel } = useStore()

  const [treasury, setTreasury] = useState({
    current_m0: 0,
    threshold: 0,
    percentage: 0,
    fever_count: 1,
  })
  const [slideIndex, setSlideIndex] = useState(0)

  const isBloodMoon =
    treasury.current_m0 >= treasury.threshold && treasury.threshold > 0

  useEffect(() => {
    const fetchTreasury = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const res = await fetch(`${apiUrl}/api/internal/treasury`)
        if (res.ok) setTreasury(await res.json())
      } catch (err) {
        console.error('Failed to fetch treasury', err)
      }
    }

    fetchTreasury()
    const interval = setInterval(fetchTreasury, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIndex((i) => (i + 1) % ACTIVITY_SLIDES.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('public:Bets')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Bets' },
        (payload) => {
          const bet = payload.new
          if (bet.is_mystery_box && bet.odds >= 3.0) {
            const uuid = bet.app_uuid as string
            const maskedId = uuid
              ? `${uuid.substring(0, 4)}***${uuid.slice(-4)}`
              : '神秘玩家'
            addMarqueeMessage(
              `🔥 玩家 ${maskedId} 剛剛抽出核動力盲盒，獲得 ${bet.odds}x 爆擊倍率！`
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [addMarqueeMessage])

  const slide = ACTIVITY_SLIDES[slideIndex]

  return (
    <div className="max-w-6xl mx-auto w-full flex flex-col gap-8 py-4 px-2 sm:px-4">
      {/* Hero / main visual */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl border p-8 sm:p-12 ${
          isBloodMoon
            ? 'border-red-500/40 bg-gradient-to-br from-red-950/40 via-black to-black shadow-[0_0_40px_rgba(239,68,68,0.15)]'
            : 'border-cyan-500/20 bg-gradient-to-br from-gray-900/80 via-black to-black shadow-[0_0_40px_rgba(34,211,238,0.08)]'
        }`}
      >
        <motion.div
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className={`absolute inset-0 pointer-events-none ${
            isBloodMoon
              ? 'bg-[radial-gradient(ellipse_at_top,_rgba(239,68,68,0.12),transparent_60%)]'
              : 'bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.1),transparent_60%)]'
          }`}
        />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center max-w-2xl mx-auto"
        >
          <p className="text-xs font-mono tracking-[0.3em] text-gray-500 uppercase mb-3">
            CasinOYS V5 Command Deck
          </p>
          <h1
            className={`text-4xl sm:text-6xl font-black tracking-tighter mb-4 ${
              isBloodMoon
                ? 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500'
            }`}
          >
            {isBloodMoon ? 'BLOOD MOON' : 'WELCOME BACK'}
          </h1>
          <p className="text-gray-400 font-mono text-sm sm:text-base leading-relaxed">
            {isBloodMoon
              ? '狂熱已點燃。全服稅收減免與 All-In 增益現已生效。'
              : 'Neural link stable. Select your battlefield below.'}
          </p>
          {vipLevel > 0 && (
            <span className="inline-block mt-4 text-xs font-mono text-yellow-400 border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 rounded-full">
              VIP {vipLevel} OPERATIVE
            </span>
          )}
        </motion.div>
      </motion.section>

      {/* Treasury telemetry */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className={`rounded-xl border p-6 relative overflow-hidden ${
          isBloodMoon ? 'border-red-500/50' : 'border-gray-800'
        } bg-gray-900/50`}
      >
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r opacity-60 ${
            isBloodMoon ? 'from-red-600 to-orange-500' : 'from-blue-500 to-purple-600'
          }`}
        />
        <div className="flex justify-between items-end mb-4 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              <h2
                className={`text-lg font-bold uppercase tracking-widest ${
                  isBloodMoon ? 'text-red-500 animate-pulse' : 'text-white'
                }`}
              >
                Global Treasury (M0)
              </h2>
            </div>
            <p className="text-xs text-gray-500 font-mono">
              FEVER: MIN(500k, 10k × {treasury.fever_count}²)
            </p>
          </div>
          <div className="text-right font-mono">
            <span
              className={`text-lg font-bold ${
                isBloodMoon ? 'text-red-400' : 'text-blue-400'
              }`}
            >
              ${treasury.current_m0.toLocaleString()}
            </span>
            <span className="text-gray-500 text-sm">
              {' '}
              / ${treasury.threshold.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="w-full h-4 bg-black rounded-full overflow-hidden border border-gray-700">
          <motion.div
            className={`h-full ${
              isBloodMoon
                ? 'bg-gradient-to-r from-red-600 to-orange-500'
                : 'bg-gradient-to-r from-blue-600 to-purple-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(treasury.percentage, 100)}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </div>
        {isBloodMoon && (
          <p className="text-right text-xs font-mono text-red-500 mt-2 font-bold animate-pulse">
            24H TAX FREE · ALL-IN +60% BUFF
          </p>
        )}
      </motion.section>

      {/* Activity carousel */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" />
          Activity Feed
        </h3>
        <AnimatePresence mode="wait">
          <motion.div
            key={slideIndex}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35 }}
            className={`rounded-xl border p-5 bg-gradient-to-r ${slide.accent}`}
          >
            <span className="text-[10px] font-mono font-bold opacity-80">
              [{slide.tag}]
            </span>
            <h4 className="text-lg font-bold mt-1 mb-2">{slide.title}</h4>
            <p className="text-sm opacity-90 font-mono leading-relaxed">
              {slide.body}
            </p>
          </motion.div>
        </AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center gap-1.5 mt-3"
        >
          {ACTIVITY_SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlideIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === slideIndex
                  ? 'w-6 bg-cyan-400'
                  : 'w-1.5 bg-gray-700 hover:bg-gray-500'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </motion.div>
      </motion.section>

      {/* Giant quick-entry portals */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <button
          type="button"
          onClick={() => setCurrentView('betting')}
          className="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/50 to-black p-8 sm:p-10 text-left transition-all hover:border-emerald-400/60 hover:shadow-[0_0_32px_rgba(52,211,153,0.2)] hover:scale-[1.01]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(52,211,153,0.12),transparent_55%)] pointer-events-none" />
          <p className="text-xs font-mono text-emerald-500/80 uppercase tracking-widest mb-2">
            Tier-1 Sportsbook
          </p>
          <h3 className="text-2xl sm:text-3xl font-black text-emerald-300 mb-2 group-hover:text-emerald-200">
            Betting Lobby
          </h3>
          <p className="text-sm text-gray-500 font-mono max-w-xs mb-6">
            三向盤口 · 樂觀結算 · Blood Moon All-In
          </p>
          <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 uppercase tracking-wider">
            Enter Exchange
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentView('derivatives')}
          className="group relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/50 to-black p-8 sm:p-10 text-left transition-all hover:border-amber-400/40 hover:shadow-[0_0_32px_rgba(168,85,247,0.2)] hover:scale-[1.01]"
        >
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(234,179,8,0.1),transparent_50%)] pointer-events-none"
          />
          <p className="text-xs font-mono text-amber-500/80 uppercase tracking-widest mb-2">
            Futures & Vault
          </p>
          <h3 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-amber-400 mb-2">
            Derivatives
          </h3>
          <p className="text-sm text-gray-500 font-mono max-w-xs mb-6">
            盲盒購買 · 持倉管理 · 75% 提前套現
          </p>
          <span className="inline-flex items-center gap-2 text-sm font-bold text-purple-300 uppercase tracking-wider">
            Open Vault
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
      </motion.section>
    </div>
  )
}
