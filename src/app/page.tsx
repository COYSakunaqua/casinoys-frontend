"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Coins, ShieldAlert, Zap, LogOut } from "lucide-react";

export default function Home() {
  const { balance, isWalletConnected, user, setUser, optimisticBet, logout } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 1. 初始化：監聽 Supabase 登入狀態
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserBalance(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserBalance(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  // 2. 資料庫讀取：改用 maybeSingle 避免報錯
  const fetchUserBalance = async (userId: string) => {
    const { data, error } = await supabase
      .from('Users') 
      .select('bank')
      .eq('user_id', userId)
      .maybeSingle(); // 戰術修正：找不到資料時回傳 null，不噴 error

    if (data) {
      useStore.getState().setBalance(data.bank);
    } else {
      // 如果找不到資料或是報錯，統一歸零，保持 UI 穩定
      if (error) console.error("資料庫查詢異常:", error.message);
      useStore.getState().setBalance(0);
    }
  };

  const handleEmailAuth = async (isSignUp: boolean) => {
    setLoading(true);
    try {
      const { error } = isSignUp 
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      
      if (error) alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6">
      
      {/* 導航列 */}
      <nav className="absolute top-0 w-full p-6 flex justify-between items-center border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-md z-10">
        <div className="font-bold text-xl tracking-tighter text-red-500 flex items-center gap-2">
          <ShieldAlert className="w-6 h-6" />
          CasinOYS V5
        </div>
        
        {isWalletConnected && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-neutral-900 px-4 py-2 rounded-full border border-neutral-800">
              <Coins className="w-4 h-4 text-yellow-400" />
              <motion.span 
                key={balance}
                initial={{ scale: 1.2, color: "#ef4444" }}
                animate={{ scale: 1, color: "#ffffff" }}
                className="font-mono font-bold"
              >
                {balance.toLocaleString()}
              </motion.span>
            </div>
            <button onClick={logout} className="p-2 hover:bg-neutral-800 rounded-full transition-colors">
              <LogOut className="w-5 h-5 text-neutral-400 hover:text-white" />
            </button>
          </div>
        )}
      </nav>

      {/* 核心內容區 */}
      <div className="flex flex-col items-center mt-10 w-full max-w-md z-0">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full text-center">
          
          {!isWalletConnected ? (
            <div className="bg-neutral-900 p-8 rounded-2xl border border-neutral-800 shadow-2xl">
              <h1 className="text-3xl font-black mb-2 tracking-tight">Identity <span className="text-red-500">Link.</span></h1>
              <p className="text-neutral-400 mb-8 text-sm">Access the high-frequency settlement network.</p>
              
              <div className="space-y-4 text-left">
                <input 
                  type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500"
                />
                <input 
                  type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500"
                />
                <div className="flex gap-2 pt-2">
                  <button onClick={() => handleEmailAuth(false)} disabled={loading} className="flex-1 bg-white text-black font-bold py-3 rounded-lg hover:bg-neutral-200">
                    {loading ? "..." : "Login"}
                  </button>
                  <button onClick={() => handleEmailAuth(true)} disabled={loading} className="flex-1 bg-neutral-800 text-white font-bold py-3 rounded-lg hover:bg-neutral-700">
                    Sign Up
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-5xl font-black mb-6 tracking-tight">System <span className="text-red-500">Armed.</span></h1>
              <p className="text-neutral-400 mb-10 text-sm">Operator: {user?.email}<br/>Zero Latency Execution enabled.</p>
              
              {/* 測試按鈕：目前僅改變前端數值，下一步教你同步回資料庫 */}
              <button 
                onClick={() => optimisticBet(500)}
                className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-red-600 rounded-xl hover:bg-red-500"
              >
                <Zap className="w-5 h-5 mr-2 group-hover:scale-110" />
                Test 0-Latency Bet (-500)
              </button>
            </div>
          )}

        </motion.div>
      </div>
    </main>
  );
}