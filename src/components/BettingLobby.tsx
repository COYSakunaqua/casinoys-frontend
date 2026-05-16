'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { supabase } from '@/lib/supabase'
import { apiFetchPath } from '@/lib/api'

type Toast = { id: number; message: string; variant: 'error' | 'success' }

export default function BettingLobby() {
  const {
    balance,
    activeMatches,
    optimisticBet,
    syncBalance,
    setCurrentView,
    setActiveMatches,
  } = useStore()

  const [isActionLocked, setIsActionLocked] = useState(false)
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const [betAmount, setBetAmount] = useState(100)
  const [allInByMatch, setAllInByMatch] = useState<Record<string, boolean>>({})
  const [selectedOptionByMatch, setSelectedOptionByMatch] = useState<
    Record<string, string>
  >({})
  const [isBloodMoon, setIsBloodMoon] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, variant: 'error' | 'success' = 'error') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  useEffect(() => {
    const loadLobbyData = async () => {
      try {
        const [treasuryRes, matchesRes] = await Promise.all([
          fetch(apiFetchPath('/api/internal/treasury')),
          fetch(apiFetchPath('/api/betting/matches')),
        ])

        if (treasuryRes.ok) {
          const treasury = await treasuryRes.json()
          const fever =
            treasury.current_m0 >= treasury.threshold && treasury.threshold > 0
          setIsBloodMoon(fever)
        }

        if (matchesRes.ok) {
          const rows = await matchesRes.json()
          if (Array.isArray(rows) && rows.length > 0) {
            setActiveMatches(
              rows.map((m: Record<string, unknown>) => ({
                id: String(m.id),
                home_team: String(m.home_team ?? m.home ?? 'Home'),
                away_team: String(m.away_team ?? m.away ?? 'Away'),
                home_odds: Number(m.home_odds ?? 2),
                away_odds: Number(m.away_odds ?? 2),
                draw_odds:
                  m.draw_odds != null ? Number(m.draw_odds) : undefined,
                is_active: Boolean(m.is_active ?? true),
              }))
            )
          }
        }
      } catch (err) {
        console.error('Failed to load betting lobby', err)
      }
    }

    loadLobbyData()
    const interval = setInterval(loadLobbyData, 30000)
    return () => clearInterval(interval)
  }, [setActiveMatches])

  const withActionLock = async (action: () => Promise<void>) => {
    if (isActionLocked) return
    setIsActionLocked(true)
    try {
      await action()
    } finally {
      setTimeout(() => setIsActionLocked(false), 2000)
    }
  }

  const revertBalance = (fallbackBalance: number) => {
    syncBalance(fallbackBalance)
  }

  const resolveBetAmount = (matchId: string) =>
    allInByMatch[matchId] ? balance : betAmount

  const selectOption = (matchId: string, optionId: string) => {
    setSelectedOptionByMatch((prev) => ({ ...prev, [matchId]: optionId }))
  }

  const handleConfirmBet = (matchId: string) => {
    const optionId = selectedOptionByMatch[matchId]
    if (!optionId) {
      showToast('Please select an option')
      return
    }
    handlePlaceBet(matchId, optionId)
  }

  const handlePlaceBet = (matchId: string, optionId: string) => {
    const amount = resolveBetAmount(matchId)
    const isAllIn = !!allInByMatch[matchId]

    if (amount <= 0 || balance < amount) {
      showToast('餘額不足，無法下注。')
      return
    }

    withActionLock(async () => {
      const prevBalance = balance
      optimisticBet(amount)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(apiFetchPath('/api/betting/place_bet'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            match_id: matchId,
            option_id: optionId,
            amount,
            is_all_in: isAllIn,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          syncBalance(data.new_bank)
          showToast('下注成功！', 'success')
          setSelectedOptionByMatch((prev) => {
            const next = { ...prev }
            delete next[matchId]
            return next
          })
          setExpandedMatchId(null)
        } else {
          const err = await res.json().catch(() => ({ detail: '下注失敗' }))
          const detail = String(err.detail ?? '下注失敗')
          revertBalance(prevBalance)
          if (detail.includes('Anti-Arbitrage') || detail.includes('403')) {
            showToast('防套利觸發：每場賽事僅能下注一次。')
          } else if (detail.includes('insufficient') || detail.includes('Invalid amount')) {
            showToast('餘額不足或金額無效。')
          } else if (detail.includes('All-in')) {
            showToast('全押需使用完整餘額。')
          } else {
            showToast(`下注失敗: ${detail}`)
          }
        }
      } catch {
        revertBalance(prevBalance)
        showToast('網路錯誤，無法連接至伺服器。')
      }
    })
  }

  const toggleAllIn = (matchId: string, checked: boolean) => {
    setAllInByMatch((prev) => ({ ...prev, [matchId]: checked }))
    if (checked) setBetAmount(balance)
  }

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
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-lg border shadow-lg font-mono text-sm max-w-md text-center ${
              toast.variant === 'error'
                ? 'bg-red-950/90 border-red-500/60 text-red-200'
                : 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
            }`}
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 uppercase tracking-wider">
            The Odds Exchange
          </h2>
          {isBloodMoon && (
            <p className="text-xs font-mono text-red-500 mt-1 animate-pulse font-bold">
              BLOOD MOON — ALL-IN +60% ODDS BOOST ACTIVE
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCurrentView('dashboard')}
          className="px-4 py-2 bg-gray-800 text-gray-300 rounded text-sm hover:bg-gray-700 transition"
        >
          Return to Dashboard
        </button>
      </motion.div>

      <div className="flex items-center justify-between bg-gray-900/80 border border-gray-800 rounded-lg px-5 py-3">
        <span className="text-xs text-gray-500 font-mono uppercase tracking-widest">
          Available Bank
        </span>
        <motion.span
          key={balance}
          initial={{ scale: 1.15, color: '#fff' }}
          animate={{ scale: 1, color: '#4ade80' }}
          className="font-mono font-bold text-xl text-green-400"
        >
          ${balance.toLocaleString()}
        </motion.span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-col gap-4"
      >
        <h3 className="text-sm font-bold text-gray-400 tracking-widest border-b border-gray-800 pb-2 uppercase">
          Active Markets
        </h3>

        {activeMatches.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex flex-col items-center justify-center rounded-xl border border-cyan-500/15 bg-black/40 px-8 py-16 text-center shadow-[inset_0_0_40px_rgba(34,211,238,0.03)]"
          >
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 rounded-xl border border-cyan-500/10 pointer-events-none"
            />
            <span className="text-4xl mb-4 opacity-60">⚠️</span>
            <p className="text-sm font-mono font-bold text-gray-500 uppercase tracking-widest animate-pulse">
              系統盤口冷卻中
            </p>
            <p className="text-xs font-mono text-gray-600 mt-2 tracking-wider">
              NO ACTIVE MATCHES
            </p>
            <p className="text-[10px] text-gray-700 font-mono mt-4 max-w-xs">
              心跳引擎運作中 · 新賽事上架後將自動同步
            </p>
          </motion.div>
        ) : (
          activeMatches.map((match) => {
            const isExpanded = expandedMatchId === match.id
            const isAllIn = !!allInByMatch[match.id]
            const effectiveAmount = resolveBetAmount(match.id)
            const selectedOptionId = selectedOptionByMatch[match.id]
            const drawOdds = match.draw_odds ?? 3.2

            return (
              <motion.div
                key={match.id}
                layout
                className={`bg-gray-900 border rounded-xl overflow-hidden transition-shadow ${
                  isAllIn
                    ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                    : 'border-gray-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedMatchId(isExpanded ? null : match.id)
                  }
                  className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors text-left"
                >
                  <span className="font-bold text-lg">
                    {match.home_team}{' '}
                    <span className="text-gray-500 text-sm font-normal">vs</span>{' '}
                    {match.away_team}
                  </span>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    className="flex items-center gap-3 text-gray-500 text-xs font-mono shrink-0"
                  >
                    <span className="text-blue-400">{match.home_odds.toFixed(2)}</span>
                    <span className="text-gray-600">{drawOdds.toFixed(2)}</span>
                    <span className="text-purple-400">{match.away_odds.toFixed(2)}</span>
                    <span>▼</span>
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key={`panel-${match.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="border-t border-gray-800 bg-black/50 overflow-hidden"
                    >
                      <div className="p-4 flex flex-col gap-4">
                        {isAllIn && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-950/40 border border-red-500/40"
                          >
                            <span className="text-red-400 font-black text-xs tracking-widest animate-pulse">
                              +60% ODDS BOOST
                            </span>
                            <span className="text-red-500/80 text-[10px] font-mono uppercase">
                              Blood Moon All-In
                            </span>
                          </motion.div>
                        )}

                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="grid grid-cols-3 gap-3"
                        >
                          <OptionButton
                            label={match.home_team}
                            odds={match.home_odds}
                            isSelected={selectedOptionId === match.home_team}
                            disabled={isActionLocked}
                            tone="home"
                            onSelect={() =>
                              selectOption(match.id, match.home_team)
                            }
                          />
                          <OptionButton
                            label="Draw"
                            odds={drawOdds}
                            isSelected={selectedOptionId === 'Draw'}
                            disabled={isActionLocked}
                            tone="draw"
                            onSelect={() => selectOption(match.id, 'Draw')}
                          />
                          <OptionButton
                            label={match.away_team}
                            odds={match.away_odds}
                            isSelected={selectedOptionId === match.away_team}
                            disabled={isActionLocked}
                            tone="away"
                            onSelect={() =>
                              selectOption(match.id, match.away_team)
                            }
                          />
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 }}
                          className="flex items-center justify-between bg-gray-900 p-2 rounded-lg border border-gray-800"
                        >
                          <span className="text-xs text-gray-400 uppercase tracking-wider">
                            Bet Amount
                          </span>
                          <input
                            type="number"
                            value={isAllIn ? balance : betAmount}
                            onChange={(e) =>
                              setBetAmount(Number(e.target.value))
                            }
                            disabled={isAllIn || isActionLocked}
                            className="bg-transparent text-right font-mono text-lg outline-none text-white w-32 disabled:opacity-50"
                            min={1}
                          />
                        </motion.div>

                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isAllIn}
                            onChange={(e) =>
                              toggleAllIn(match.id, e.target.checked)
                            }
                            disabled={isActionLocked}
                            className="w-4 h-4 accent-red-500 rounded border-gray-600 bg-gray-800"
                          />
                          <span className="text-sm text-gray-300 font-mono">
                            ALL-IN (${balance.toLocaleString()})
                          </span>
                        </label>

                        {effectiveAmount > 0 && selectedOptionId && (
                          <p className="text-[10px] text-emerald-600/80 font-mono text-center">
                            {selectedOptionId} · Stake $
                            {effectiveAmount.toLocaleString()}
                            {isAllIn ? ' · FULL BALANCE' : ''}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => handleConfirmBet(match.id)}
                          disabled={isActionLocked}
                          className="w-full py-3 rounded-lg font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.08)] hover:shadow-[0_0_20px_rgba(52,211,153,0.2)]"
                        >
                          {isActionLocked ? 'LOCKED' : 'Confirm Bet'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })
        )}
      </motion.div>
    </motion.div>
  )
}

function OptionButton({
  label,
  odds,
  isSelected,
  disabled,
  tone,
  onSelect,
}: {
  label: string
  odds: number
  isSelected: boolean
  disabled: boolean
  tone: 'home' | 'away' | 'draw'
  onSelect: () => void
}) {
  const baseTone = {
    home: 'border-blue-600/40 text-blue-300 bg-blue-600/10 hover:bg-blue-600/25',
    away: 'border-purple-600/40 text-purple-300 bg-purple-600/10 hover:bg-purple-600/25',
    draw: 'border-gray-600/40 text-gray-300 bg-gray-700/20 hover:bg-gray-700/35',
  }[tone]

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg border font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        isSelected
          ? 'border-emerald-400 text-emerald-300 bg-emerald-500/15 shadow-[0_0_18px_rgba(52,211,153,0.45)] ring-2 ring-emerald-400/80 scale-[1.02]'
          : baseTone
      }`}
    >
      <span className="text-sm truncate max-w-full px-1 leading-tight">
        {label}
      </span>
      <span
        className={`font-mono text-sm ${isSelected ? 'text-emerald-400' : ''}`}
      >
        {odds.toFixed(2)}
      </span>
    </button>
  )
}
