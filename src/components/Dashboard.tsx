'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '@/store/useStore'

export default function Dashboard() {
  const balance = useStore((state) => state.balance)
  const vipLevel = useStore((state) => state.vipLevel)
  
  const [isActionLocked, setIsActionLocked] = useState(false)
  const [treasury, setTreasury] = useState({ current_m0: 0, threshold: 0, percentage: 0, fever_count: 1 })

  useEffect(() => {
    const fetchTreasury = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${apiUrl}/api/internal/treasury`);
        if (res.ok) {
          const data = await res.json();
          setTreasury(data);
        }
      } catch (err) {
        console.error("Failed to fetch treasury stats", err);
      }
    };
    fetchTreasury();
    // 設置 30 秒輪詢更新國庫
    const interval = setInterval(fetchTreasury, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = () => {
    if (isActionLocked) return;
    setIsActionLocked(true);
    setTimeout(() => setIsActionLocked(false), 2000);
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <nav className="w-full bg-gray-900/80 backdrop-blur-md border-b border-gray-800 p-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 tracking-tighter">
              CasinOYS
            </h1>
            <span className="bg-yellow-500/20 text-yellow-500 text-xs font-bold px-2 py-1 rounded border border-yellow-500/50">
              VIP {vipLevel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-mono uppercase">Bank</span>
            <span className="text-green-400 font-mono font-bold text-xl">${balance.toLocaleString()}</span>
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col gap-8">
        <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600 opacity-50" />
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-xl font-bold uppercase text-white tracking-widest">Global Treasury (M0)</h2>
              <p className="text-xs text-gray-500 font-mono mt-1">FEVER IGNITION THRESHOLD: MIN(500k, 10k × {treasury.fever_count}²)</p>
            </div>
            <div className="text-right">
              <span className="text-blue-400 font-mono text-lg font-bold">${treasury.current_m0.toLocaleString()}</span>
              <span className="text-gray-500 font-mono text-sm"> / ${treasury.threshold.toLocaleString()}</span>
            </div>
          </div>
          <div className="w-full h-6 bg-black rounded-full overflow-hidden border border-gray-700 shadow-inner">
            <motion.div 
              className="h-full bg-gradient-to-r from-blue-600 to-purple-500 relative"
              initial={{ width: 0 }}
              animate={{ width: `${treasury.percentage}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[stripes_1s_linear_infinite]" />
            </motion.div>
          </div>
          <p className="text-right text-xs font-mono text-gray-500 mt-2">IGNITION READY: {treasury.percentage.toFixed(1)}%</p>
        </div>

        <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px]">
          <h3 className="text-2xl font-bold mb-6 text-gray-300 tracking-widest">CASINO FLOOR</h3>
          <button
            onClick={handleAction}
            disabled={isActionLocked}
            className={`px-12 py-4 rounded-lg font-black text-lg uppercase tracking-widest transition-all ${
              isActionLocked 
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed scale-95' 
              : 'bg-white text-black hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:scale-105'
            }`}
          >
            {isActionLocked ? 'SYSTEM LOCKED (2S)' : 'PLACE BLIND BOX ORDER'}
          </button>
          <p className="text-gray-500 text-xs mt-6 max-w-md text-center font-mono">
            * 物理限購防禦已啟用 (VIP × 2) * <br/>
            單向 Debouncer 鎖定機制：阻斷連點攻擊，保護併發結算。
          </p>
        </div>
      </div>
    </main>
  )
}