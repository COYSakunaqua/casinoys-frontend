'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, Bet } from '@/store/useStore'
import { supabase } from '@/lib/supabase'
import { apiFetchPath } from '@/lib/api'
import confetti from 'canvas-confetti'

type Toast = {
  id: number
  message: string
  variant: 'error' | 'success' | 'jackpot'
}

function isMysteryBox(bet: Bet) {
  return bet.match_id === 'sys_mystery' || bet.team_selected === 'sys_random'
}

function resolveBetStatus(raw: unknown): Bet['status'] {
  if (raw === 'cashed_out' || raw === 2) return 'cashed_out'
  if (raw === 'settled' || raw === 1) return 'settled'
  if (raw === 'pending' || raw === 0) return 'pending'
  if (typeof raw === 'number' && raw !== 0) {
    return raw === 2 ? 'cashed_out' : 'settled'
  }
  return 'pending'
}

function mapBetsFromApi(rows: Record<string, unknown>[]): Bet[] {
  return rows.map((b) => ({
    id: String(b.id),
    match_id: String(b.match_id ?? ''),
    team_selected: String(b.team_selected ?? b.option_id ?? '—'),
    amount: Number(b.amount ?? 0),
    expected_payout: Number(b.expected_payout ?? 0),
    status: resolveBetStatus(b.status),
  }))
}

type PositionsTab = 'active' | 'history'

export default function Derivatives() {
  const {
    myBets,
    betHistory,
    balance,
    vipLevel,
    optimisticCashout,
    syncBalance,
    setMyBets,
    setBetHistory,
    setCurrentView,
    addMarqueeMessage,
  } = useStore()

  const [isActionLocked, setIsActionLocked] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [positionsTab, setPositionsTab] = useState<PositionsTab>('active')
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  const showToast = useCallback(
    (message: string, variant: Toast['variant'] = 'error') => {
      const id = Date.now()
      setToasts((prev) => [...prev, { id, message, variant }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, variant === 'jackpot' ? 6000 : 4500)
    },
    []
  )

  const fetchMyBets = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(apiFetchPath('/api/betting/my_bets'), {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (res.ok) {
      const rows = await res.json()
      if (Array.isArray(rows)) {
        setMyBets(mapBetsFromApi(rows))
      }
    }
    return res.ok
  }, [setMyBets])

  const fetchBetHistory = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(apiFetchPath('/api/betting/history'), {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (res.ok) {
      const rows = await res.json()
      if (Array.isArray(rows)) {
        setBetHistory(mapBetsFromApi(rows))
      }
    }
    return res.ok
  }, [setBetHistory])

  useEffect(() => {
    if (positionsTab !== 'history') return
    const loadHistory = async () => {
      setIsHistoryLoading(true)
      try {
        const ok = await fetchBetHistory()
        if (!ok) showToast('無法載入歷史戰績。')
      } catch (err) {
        console.error('Failed to fetch bet history', err)
        showToast('無法載入歷史戰績。')
      } finally {
        setIsHistoryLoading(false)
      }
    }
    loadHistory()
  }, [positionsTab, fetchBetHistory, showToast])

  useEffect(() => {
    const load = async () => {
      try {
        const ok = await fetchMyBets()
        if (!ok) showToast('無法載入持倉資料。')
      } catch (err) {
        console.error('Failed to fetch my bets', err)
        showToast('無法載入持倉資料。')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [fetchMyBets, showToast])

  const withActionLock = async (action: () => Promise<void>) => {
    if (isActionLocked) return
    setIsActionLocked(true)
    try {
      await action()
    } finally {
      setTimeout(() => setIsActionLocked(false), 2000)
    }
  }

  const triggerJackpotEffect = () => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.8 }, // 從畫面偏下方往上噴
      colors: ['#39FF14', '#FFD700', '#FFFFFF'], // 霓虹綠、金色、純白
      zIndex: 9999
    })
  }

  const handleBuyMysteryBox = () => {
    withActionLock(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`${apiUrl()}/api/betting/mystery_box`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
        })

        if (res.ok) {
          const data = await res.json()
          syncBalance(data.new_bank)
          const multiplier = Number(data.multiplier ?? 0)
          const finalOdds = Number(data.final_odds ?? 0)

          // 核心：倍率大於等於 3 時引爆全螢幕特效
          if (multiplier >= 3) {
            triggerJackpotEffect()
          }

          showToast(
            `📦 盲盒開啟！獲得 ${multiplier}x 賠率增益！最終賠率 ${finalOdds}x`,
            'jackpot'
          )
          if (multiplier >= 3) {
            addMarqueeMessage(
              `📦 神秘玩家剛剛購入核動力盲盒 — ${multiplier}x 倍率 / ${finalOdds}x 最終賠率！`
            )
          }
          await fetchMyBets()
        } else {
          const err = await res.json().catch(() => ({ detail: '購買失敗' }))
          const detail = String(err.detail ?? '')
          if (res.status === 403 || detail.toLowerCase().includes('limit')) {
            showToast(`⚠️ 今日盲盒限購已達上限。${detail}`)
          } else if (
            res.status === 400 ||
            detail.toLowerCase().includes('insufficient')
          ) {
            showToast('⚠️ 餘額不足，無法購買盲盒。')
          } else {
            showToast(detail || '盲盒購買失敗')
          }
        }
      } catch {
        showToast('網路錯誤，無法連接至伺服器。')
      }
    })
  }

  const handleCashout = (betId: string, expectedPayout: number) => {
    const discountedPayout = Math.floor(expectedPayout * 0.75)

    withActionLock(async () => {
      const prevBalance = balance
      const prevBets = [...myBets]

      optimisticCashout(expectedPayout)
      setMyBets(myBets.filter((b) => b.id !== betId))

      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`${apiUrl()}/api/betting/cashout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ bet_id: betId }),
        })

        if (res.ok) {
          const data = await res.json()
          syncBalance(data.new_bank)
          
          // 核心：套現成功引爆全螢幕特效
          triggerJackpotEffect()
          
          showToast(`套現成功 +$${discountedPayout.toLocaleString()}`, 'success')
          await fetchBetHistory()
        } else {
          const err = await res.json().catch(() => ({ detail: '套現失敗' }))
          setMyBets(prevBets)
          syncBalance(prevBalance)
          showToast(String(err.detail ?? '套現失敗'))
        }
      } catch {
        setMyBets(prevBets)
        syncBalance(prevBalance)
        showToast('網路錯誤，無法連接至伺服器。')
      }
    })
  }

  const mysteryBoxes = myBets.filter(isMysteryBox)
  const sportsBets = myBets.filter((b) => !isMysteryBox(b))

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-4xl mx-auto w-full flex flex-col gap-6 relative"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-xl border-2 shadow-2xl font-mono text-sm max-w-lg text-center ${
              toast.variant === 'error'
                ? 'bg-red-950/95 border-red-500/60 text-red-200'
                : toast.variant === 'jackpot'
                  ? 'bg-gradient-to-r from-purple-950/95 via-amber-950/95 to-purple-950/95 border-amber-400/70 text-amber-100 shadow-[0_0_40px_rgba(234,179,8,0.35)] scale-105'
                  : 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
            }`}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600 uppercase tracking-wider">
            Derivatives Center
          </h2>
          <p className="text-xs text-gray-500 font-mono mt-1 tracking-widest uppercase">
            Active contracts & mystery boxes · 75% early cashout
          </p>
        </motion.div>
        <button
          type="button"
          onClick={() => setCurrentView('dashboard')}
          className="px-4 py-2 bg-gray-800 text-gray-300 rounded text-sm hover:bg-gray-700 transition"
        >
          Return to Dashboard
        </button>
      </div>

      <motion.section
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-950/60 via-black to-amber-950/30 p-6 sm:p-8"
      >
        <motion.div
          animate={{ opacity: [0.2, 0.45, 0.2] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.15),transparent_70%)] pointer-events-none"
        />
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
        >
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <p className="text-[10px] font-mono text-amber-400/90 uppercase tracking-[0.25em] mb-2">
              ◈ Encrypted Vault
            </p>
            <h3 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-fuchsia-300 to-amber-400">
              Buy Mystery Box
            </h3>
            <p className="text-xs text-gray-500 font-mono mt-2 max-w-sm">
              隨機倍率期貨合約 · 每日限購 max(2, VIP×2) · 當前額度{' '}
              {Math.max(2, vipLevel * 2)}
            </p>
          </motion.div>
          <button
            type="button"
            onClick={handleBuyMysteryBox}
            disabled={isActionLocked}
            className={`shrink-0 px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all border-2 ${
              isActionLocked
                ? 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed scale-95'
                : 'bg-gradient-to-r from-purple-600 to-amber-500 text-black border-amber-300/50 shadow-[0_0_28px_rgba(168,85,247,0.45)] hover:shadow-[0_0_40px_rgba(234,179,8,0.5)] hover:scale-105'
            }`}
          >
            {isActionLocked ? '◈ LOCKED ◈' : '◈ UNSEAL BOX ◈'}
          </button>
        </motion.div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative flex border-b border-gray-800/80"
        >
          {(
            [
              { id: 'active' as const, label: 'Active Positions (當前持倉)' },
              { id: 'history' as const, label: 'History (歷史戰績)' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPositionsTab(tab.id)}
              className={`relative flex-1 py-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors ${
                positionsTab === tab.id
                  ? 'text-cyan-300'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {tab.label}
              {positionsTab === tab.id && (
                <motion.span
                  layoutId="derivatives-tab-underline"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {positionsTab === 'active' ? (
            <motion.div
              key="active-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex flex-col gap-6"
            >
              {isLoading ? (
                <motion.div className="bg-gray-900/30 border border-gray-800/60 rounded-lg p-8 text-center text-gray-500 font-mono animate-pulse">
                  SYNCING DERIVATIVES LEDGER...
                </motion.div>
              ) : myBets.length === 0 ? (
                <EmptyState
                  icon="📭"
                  message="無活耀部位，去盤口尋找獵物吧。"
                  actionLabel="前往 Betting Lobby"
                  onAction={() => setCurrentView('betting')}
                />
              ) : (
                <>
                  {mysteryBoxes.length > 0 && (
                    <section className="flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-yellow-500/90 tracking-widest border-b border-yellow-500/20 pb-2 uppercase">
                        Mystery Boxes
                      </h3>
                      <AnimatePresence mode="popLayout">
                        {mysteryBoxes.map((bet) => (
                          <BetCard
                            key={bet.id}
                            bet={bet}
                            isActionLocked={isActionLocked}
                            onCashout={handleCashout}
                            variant="mystery"
                          />
                        ))}
                      </AnimatePresence>
                    </section>
                  )}

                  {sportsBets.length > 0 && (
                    <section className="flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-gray-400 tracking-widest border-b border-gray-800 pb-2 uppercase">
                        Sportsbook Positions
                      </h3>
                      <AnimatePresence mode="popLayout">
                        {sportsBets.map((bet) => (
                          <BetCard
                            key={bet.id}
                            bet={bet}
                            isActionLocked={isActionLocked}
                            onCashout={handleCashout}
                            variant="sports"
                          />
                        ))}
                      </AnimatePresence>
                    </section>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="history-tab"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex flex-col gap-3"
            >
              {isHistoryLoading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-gray-900/30 border border-gray-800/60 rounded-lg p-8 text-center text-gray-500 font-mono animate-pulse"
                >
                  LOADING COMBAT LOG...
                </motion.div>
              ) : betHistory.length === 0 ? (
                <EmptyState icon="📭" message="尚無戰鬥紀錄。" />
              ) : (
                <AnimatePresence mode="popLayout">
                  {betHistory.map((bet) => (
                    <HistoryBetCard key={bet.id} bet={bet} />
                  ))}
                </AnimatePresence>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  )
}

function EmptyState({
  icon,
  message,
  actionLabel,
  onAction,
}: {
  icon: string
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-xl border border-gray-700/40 bg-gray-950/40 px-8 py-12 text-center shadow-[inset_0_0_24px_rgba(34,211,238,0.02)]"
    >
      <span className="text-3xl mb-3 opacity-40 grayscale">{icon}</span>
      <p className="text-sm font-mono text-gray-500 max-w-xs">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-emerald-500/90 border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/15 hover:border-emerald-500/40 transition-all"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  )
}

function HistoryBetCard({ bet }: { bet: Bet }) {
  const label = isMysteryBox(bet) ? 'MYSTERY BOX' : bet.team_selected
  const isCashedOut = bet.status === 'cashed_out'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="bg-black/60 border border-gray-800/80 rounded-xl p-4 flex justify-between items-center gap-4"
    >
      <div className="min-w-0">
        <span className="font-bold text-sm text-gray-400 truncate block">
          {label}
        </span>
        <span className="text-xs text-gray-600 font-mono">
          Stake: ${bet.amount.toLocaleString()} · Payout $
          {bet.expected_payout.toLocaleString()}
        </span>
      </div>
      <span
        className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded border ${
          isCashedOut
            ? 'text-emerald-400/90 border-emerald-500/30 bg-emerald-500/10'
            : 'text-gray-500 border-gray-600/40 bg-gray-800/40'
        }`}
      >
        {isCashedOut ? 'CASHED OUT' : 'SETTLED'}
      </span>
    </motion.div>
  )
}

function BetCard({
  bet,
  isActionLocked,
  onCashout,
  variant,
}: {
  bet: Bet
  isActionLocked: boolean
  onCashout: (betId: string, expectedPayout: number) => void
  variant: 'mystery' | 'sports'
}) {
  const discountedPayout = Math.floor(bet.expected_payout * 0.75)
  const label = variant === 'mystery' ? 'MYSTERY BOX' : bet.team_selected

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, height: 0 }}
      transition={{ duration: 0.2 }}
      className={`bg-black border rounded-xl p-4 flex flex-col gap-3 ${
        variant === 'mystery'
          ? 'border-yellow-500/30 shadow-[0_0_12px_rgba(234,179,8,0.08)]'
          : 'border-gray-800'
      }`}
    >
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-start gap-4"
      >
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-1 min-w-0"
        >
          <span
            className={`font-bold text-sm truncate ${
              variant === 'mystery' ? 'text-yellow-400' : 'text-white'
            }`}
          >
            {label}
          </span>
          <span className="text-xs text-gray-500 font-mono">
            Stake: ${bet.amount.toLocaleString()}
          </span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-right shrink-0"
        >
          <span className="text-[10px] text-gray-500 font-mono uppercase block">
            Expected Payout
          </span>
          <span className="text-green-400 font-mono font-bold">
            ${bet.expected_payout.toLocaleString()}
          </span>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex justify-between items-center pt-2 border-t border-gray-800/80"
      >
        <span className="text-xs text-gray-600 font-mono">
          Cashout (75%): ${discountedPayout.toLocaleString()}
        </span>
        <button
          type="button"
          onClick={() => onCashout(bet.id, bet.expected_payout)}
          disabled={isActionLocked}
          className="bg-red-500/10 hover:bg-red-500/30 text-red-400 border border-red-500/50 px-4 py-2 rounded-lg text-xs font-bold tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isActionLocked ? 'LOCKED' : 'Cashout (75%)'}
        </button>
      </motion.div>
    </motion.div>
  )
}