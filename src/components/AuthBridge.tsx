'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { supabase } from '@/lib/supabase'

export default function AuthBridge() {
  const [keyInput, setKeyInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [dropData, setDropData] = useState<{rank: number, vip: number, old_bank: number, bonus: number, bank: number} | null>(null)
  
  const setUserData = useStore((state) => state.setUserData)
  const setHasEnteredCasino = useStore((state) => state.setHasEnteredCasino)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 4) setKeyInput(value);
  }

  const handleBind = async () => {
    if (keyInput.length !== 4) {
      setError("請輸入完整的 4 位數驗證碼"); return;
    }
    setLoading(true); setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("請先透過 Email 登入 Web 帳號。");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const response = await fetch(`${apiUrl}/api/economy/app-bind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ code: keyInput })
      });

      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        throw new Error("伺服器路由異常，請檢查 API 前綴。");
      }

      if (!response.ok) throw new Error(data.detail || "Verification failed");

      setUserData(data.new_bank, data.new_vip);
      setDropData({ rank: data.rank, vip: data.new_vip, old_bank: data.old_bank, bonus: data.bonus, bank: data.new_bank });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (success && dropData) {
    return (
      <motion.div 
        initial={{ scale: 0.9, rotateY: -90, opacity: 0 }}
        animate={{ scale: 1, rotateY: 0, opacity: 1 }}
        transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
        className="p-8 bg-gradient-to-br from-gray-900 to-black border border-green-500/30 rounded-xl w-full shadow-[0_0_30px_rgba(34,197,94,0.15)] text-center"
      >
        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 mb-2">
          AIRDROP SECURED
        </h2>
        <div className="bg-gray-800/50 p-6 rounded-lg mt-6 border border-gray-700 shadow-inner">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
            <div className="text-left">
              <p className="text-xs text-gray-500 uppercase tracking-widest">Legacy Rank</p>
              <p className="text-2xl font-bold text-white">#{dropData.rank}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-widest">V5 Status</p>
              <p className="text-2xl font-bold text-yellow-500">VIP {dropData.vip}</p>
            </div>
          </div>
          <div className="space-y-3 text-sm font-mono">
            {/* 視覺抹除效果 */}
            <div className="flex justify-between text-gray-600 line-through opacity-80">
              <span>LEGACY CAPITAL (WIPED):</span>
              <span>${dropData.old_bank.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-green-400">
              <span>GENESIS BONUS:</span>
              <span>+${dropData.bonus.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xl text-white font-bold pt-4 mt-2 border-t border-gray-700">
              <span>STARTING BALANCE:</span>
              <span className="text-green-400">${dropData.bank.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setHasEnteredCasino(true)}
          className="mt-8 w-full py-4 bg-white text-black font-black text-xl rounded-lg hover:bg-gray-200 transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:shadow-[0_0_30px_rgba(255,255,255,0.6)]"
        >
          ENTER CASINO
        </motion.button>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-gray-900 border border-gray-800 rounded-xl w-full shadow-2xl">
      <h2 className="text-2xl font-bold text-white mb-2 text-center">Initialize V5 Profile</h2>
      <p className="text-xs text-gray-400 mb-6 text-center font-mono tracking-widest">NEURAL LINK & GENESIS AIRDROP</p>
      <div className="space-y-4">
        <input 
          type="text" inputMode="numeric" maxLength={4} value={keyInput} onChange={handleInputChange} placeholder="ENTER 4-DIGIT CODE"
          className="w-full bg-black text-white border border-gray-700 px-4 py-3 rounded outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-center text-2xl tracking-widest"
          disabled={loading}
        />
        {error && <p className="text-red-400 text-xs bg-red-900/20 p-2 rounded text-center border border-red-500/30">{error}</p>}
        <button
          onClick={handleBind} disabled={loading || keyInput.length !== 4}
          className={`w-full py-3 rounded font-bold tracking-widest transition-all ${loading || keyInput.length !== 4 ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200'}`}
        >
          {loading ? 'SYNCHRONIZING...' : 'CLAIM GENESIS AIRDROP'}
        </button>
      </div>
    </motion.div>
  )
}