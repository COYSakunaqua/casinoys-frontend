'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, Match, Bet } from '@/store/useStore'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const { 
    balance, 
    vipLevel, 
    activeMatches, 
    myBets, 
    marqueeMessages,
    optimisticBet, 
    optimisticCashout, 
    syncBalance,
    setActiveMatches,
    setMyBets,
    addMarqueeMessage
  } = useStore()
  
  const [isActionLocked, setIsActionLocked] = useState(false)
  const [treasury, setTreasury] = useState({ current_m0: 0, threshold: 0, percentage: 0, fever_count: 1 })
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)
  const [betAmount, setBetAmount] = useState<number>(100)

  const isBloodMoon = treasury.current_m0 >= treasury.threshold && treasury.threshold > 0;

  // 初始化 API 資料載入
  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const treasuryRes = await fetch(`${apiUrl}/api/internal/treasury`);
        if (treasuryRes.ok) setTreasury(await treasuryRes.json());

        // Mock Data 保留供 UI 測試
        if (activeMatches.length === 0) {
          setActiveMatches([
            { id: "m1", home_team: "Tottenham", away_team: "Arsenal", home_odds: 2.1, away_odds: 1.8, is_active: true },
            { id: "m2", home_team: "Real Madrid", away_team: "Barcelona", home_odds: 1.9, away_odds: 2.0, is_active: true }
          ]);
        }
        if (myBets.length === 0) {
          setMyBets([
            { id: "b1", match_id: "m1", team_selected: "Tottenham", amount: 500, expected_payout: 1050, status: "pending" }
          ]);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 30000); 
    return () => clearInterval(interval);
  }, []);

  // Supabase Realtime 監聽器
  useEffect(() => {
    const channel = supabase.channel('public:Bets')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Bets' }, (payload) => {
        const bet = payload.new;
        if (bet.is_mystery_box && bet.odds >= 3.0) {
          const uuid = bet.app_uuid as string;
          const maskedId = uuid ? `${uuid.substring(0, 4)}***${uuid.slice(-4)}` : "神秘玩家";
          addMarqueeMessage(`🔥 玩家 ${maskedId} 剛剛抽出核動力盲盒，獲得 ${bet.odds}x 爆擊倍率！`);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // 封裝安全鎖機制 (2秒 Debouncer)
  const withActionLock = async (action: () => Promise<void>) => {
    if (isActionLocked) return;
    setIsActionLocked(true);
    try {
      await action();
    } finally {
      setTimeout(() => setIsActionLocked(false), 2000);
    }
  }

  // 🔫 真實打擊：盲盒 API
  const handleBuyMysteryBox = () => {
    withActionLock(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        
        const res = await fetch(`${apiUrl}/api/betting/mystery_box`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          syncBalance(data.new_bank); // 使用伺服器算好的最新餘額同步
        } else {
          const err = await res.json();
          alert(`購買失敗: ${err.detail}`);
        }
      } catch (error) {
        console.error("API 錯誤", error);
        alert("網路錯誤，無法連接至伺服器。");
      }
    });
  };

  // 🔫 真實打擊：常規盤口下注 API
  const handlePlaceBet = (matchId: string, team: string) => {
    withActionLock(async () => {
      if (balance < betAmount) {
        alert("餘額不足");
        return;
      }
      
      const prevBalance = balance;
      optimisticBet(betAmount); // 樂觀更新：瞬間扣款
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/betting/place_bet`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            match_id: matchId,
            option_id: team,
            amount: betAmount,
            is_all_in: false
          })
        });

        if (res.ok) {
          const data = await res.json();
          syncBalance(data.new_bank);
        } else {
          const err = await res.json();
          alert(`下注失敗: ${err.detail}`);
          syncBalance(prevBalance); // 失敗回滾餘額
        }
      } catch (error) {
        syncBalance(prevBalance); // 失敗回滾餘額
        alert("網路錯誤，無法連接至伺服器。");
      }
    });
  }

  // 🔫 真實打擊：期貨套現 API
  const handleCashout = (betId: string, expectedPayout: number) => {
    withActionLock(async () => {
      const prevBets = [...myBets];
      optimisticCashout(expectedPayout); // 樂觀更新：瞬間加錢
      setMyBets(myBets.filter(b => b.id !== betId)); // 樂觀更新：瞬間移除訂單

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/betting/cashout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ bet_id: betId })
        });

        if (res.ok) {
          const data = await res.json();
          syncBalance(data.new_bank);
        } else {
          const err = await res.json();
          alert(`套現失敗: ${err.detail}`);
          // 失敗回滾
          setMyBets(prevBets);
          syncBalance(balance - Math.floor(expectedPayout * 0.75));
        }
      } catch (error) {
        alert("網路錯誤，無法連接至伺服器。");
        setMyBets(prevBets);
      }
    });
  }

  const marqueeText = marqueeMessages.map(m => m.text).join(' ✦ ');

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans">
      <nav className="w-full bg-gray-900/80 backdrop-blur-md border-b border-gray-800 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className={`text-2xl font-black tracking-tighter transition-colors ${isBloodMoon ? 'text-red-500 drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]' : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600'}`}>
              CasinOYS
            </h1>
            <span className="bg-yellow-500/20 text-yellow-500 text-xs font-bold px-2 py-1 rounded border border-yellow-500/50">
              VIP {vipLevel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-mono uppercase">Bank</span>
            <motion.span 
              key={balance} 
              initial={{ scale: 1.2, color: "#fff" }}
              animate={{ scale: 1, color: "#4ade80" }}
              className="font-mono font-bold text-xl"
            >
              ${balance.toLocaleString()}
            </motion.span>
          </div>
        </div>
      </nav>

      <div className="w-full bg-red-900/20 border-b border-red-900/50 overflow-hidden py-1.5 flex items-center">
        <div className="w-full flex whitespace-nowrap">
          <motion.div
            animate={{ x: ["100vw", "-100%"] }}
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
            className="text-xs font-mono tracking-widest text-red-400 font-bold"
          >
            {marqueeText}
          </motion.div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className={`w-full bg-gray-900 border rounded-xl p-6 relative overflow-hidden transition-colors ${isBloodMoon ? 'border-red-500/50 shadow-[0_0_20px_rgba(255,0,0,0.2)]' : 'border-gray-800'}`}>
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r opacity-50 ${isBloodMoon ? 'from-red-600 to-orange-500' : 'from-blue-500 to-purple-600'}`} />
            <div className="flex justify-between items-end mb-4">
              <div>
                <h2 className={`text-xl font-bold uppercase tracking-widest ${isBloodMoon ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {isBloodMoon ? 'BLOOD MOON ACTIVE' : 'Global Treasury (M0)'}
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-1">FEVER THRESHOLD: MIN(500k, 10k × {treasury.fever_count}²)</p>
              </div>
              <div className="text-right">
                <span className={`font-mono text-lg font-bold ${isBloodMoon ? 'text-red-400' : 'text-blue-400'}`}>
                  ${treasury.current_m0.toLocaleString()}
                </span>
                <span className="text-gray-500 font-mono text-sm"> / ${treasury.threshold.toLocaleString()}</span>
              </div>
            </div>
            <div className="w-full h-6 bg-black rounded-full overflow-hidden border border-gray-700 shadow-inner">
              <motion.div 
                className={`h-full relative ${isBloodMoon ? 'bg-gradient-to-r from-red-600 to-orange-500' : 'bg-gradient-to-r from-blue-600 to-purple-500'}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(treasury.percentage, 100)}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[stripes_1s_linear_infinite]" />
              </motion.div>
            </div>
            {isBloodMoon && <p className="text-right text-xs font-mono text-red-500 mt-2 font-bold animate-pulse">24H TAX FREE | ALL-IN +60% BUFF</p>}
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold text-gray-300 tracking-widest border-b border-gray-800 pb-2">SPORTSBOOK</h3>
            {activeMatches.map((match) => (
              <div key={match.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button 
                  onClick={() => setExpandedMatchId(expandedMatchId === match.id ? null : match.id)}
                  className="w-full p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-lg">{match.home_team} <span className="text-gray-500 text-sm font-normal">vs</span> {match.away_team}</span>
                  </div>
                  <div className="flex gap-4 font-mono text-sm">
                    <span className="text-blue-400">{match.home_odds.toFixed(2)}</span>
                    <span className="text-purple-400">{match.away_odds.toFixed(2)}</span>
                  </div>
                </button>

                <AnimatePresence>
                  {expandedMatchId === match.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-800 bg-black/50 overflow-hidden"
                    >
                      <div className="p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between bg-gray-900 p-2 rounded-lg border border-gray-800">
                          <span className="text-xs text-gray-400 uppercase tracking-wider">Bet Amount</span>
                          <input 
                            type="number" 
                            value={betAmount} 
                            onChange={(e) => setBetAmount(Number(e.target.value))}
                            className="bg-transparent text-right font-mono text-lg outline-none text-white w-32"
                            min="1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={() => handlePlaceBet(match.id, match.home_team)}
                            disabled={isActionLocked}
                            className="bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600/50 text-blue-400 py-3 rounded-lg font-bold transition-all disabled:opacity-50"
                          >
                            {match.home_team} ({match.home_odds})
                          </button>
                          <button 
                            onClick={() => handlePlaceBet(match.id, match.away_team)}
                            disabled={isActionLocked}
                            className="bg-purple-600/20 hover:bg-purple-600/40 border border-purple-600/50 text-purple-400 py-3 rounded-lg font-bold transition-all disabled:opacity-50"
                          >
                            {match.away_team} ({match.away_odds})
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center relative">
             <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent pointer-events-none" />
            <h3 className="text-xl font-bold mb-4 text-gray-300 tracking-widest">MYSTERY BOX</h3>
            <button
              onClick={handleBuyMysteryBox}
              disabled={isActionLocked}
              className={`w-full py-4 rounded-lg font-black text-sm uppercase tracking-widest transition-all ${
                isActionLocked 
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed scale-95' 
                : 'bg-white text-black hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:scale-105'
              }`}
            >
              {isActionLocked ? 'LOCKED' : 'PURCHASE BOX'}
            </button>
            <p className="text-gray-500 text-xs mt-4 text-center font-mono">
              限購額度: {vipLevel * 2}
            </p>
          </div>

          <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col h-full">
            <h3 className="text-xl font-bold mb-4 text-gray-300 tracking-widest border-b border-gray-800 pb-2">DERIVATIVES</h3>
            <p className="text-xs text-gray-500 font-mono mb-4">EARLY CASHOUT (75% DISCOUNT APPLIED)</p>
            
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-2">
              {myBets.length === 0 ? (
                <p className="text-center text-sm text-gray-600 py-8">NO ACTIVE CONTRACTS</p>
              ) : (
                myBets.map(bet => (
                  <div key={bet.id} className="bg-black border border-gray-800 rounded-lg p-3 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm truncate">{bet.team_selected}</span>
                      <span className="text-green-400 font-mono text-sm">${bet.expected_payout}</span>
                    </div>
                    <div className="flex justify-between items-end mt-2">
                      <span className="text-xs text-gray-500 font-mono">Stake: ${bet.amount}</span>
                      <button 
                        onClick={() => handleCashout(bet.id, bet.expected_payout)}
                        disabled={isActionLocked}
                        className="bg-red-500/10 hover:bg-red-500/30 text-red-500 border border-red-500/50 px-3 py-1 rounded text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        CASHOUT ${(bet.expected_payout * 0.75).toFixed(0)}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </main>
  )
}