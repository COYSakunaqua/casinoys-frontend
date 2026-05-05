import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

export interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_odds: number;
  away_odds: number;
  is_active: boolean;
}

export interface Bet {
  id: string;
  match_id: string;
  team_selected: string;
  amount: number;
  expected_payout: number;
  status: 'pending' | 'cashed_out' | 'settled';
}

export interface MarqueeMessage {
  id: string;
  text: string;
  timestamp: number;
}

interface CasinoState {
  balance: number;
  vipLevel: number;
  user: User | null;
  isWalletConnected: boolean;
  hasEnteredCasino: boolean;
  
  // 盤口與歷史訂單狀態
  activeMatches: Match[];
  myBets: Bet[];
  marqueeMessages: MarqueeMessage[];
  
  setUser: (user: User | null) => void;
  setUserData: (amount: number, vip: number) => void;
  setHasEnteredCasino: (entered: boolean) => void; 
  
  // 樂觀更新引擎
  optimisticBet: (amount: number) => void;
  optimisticCashout: (expectedPayout: number) => void;
  syncBalance: (realBalance: number) => void; 
  
  // 資料載入與狀態更新
  setActiveMatches: (matches: Match[]) => void;
  setMyBets: (bets: Bet[]) => void;
  addMarqueeMessage: (text: string) => void;
  
  logout: () => Promise<void>;
}

export const useStore = create<CasinoState>((set) => ({
  balance: 0,
  vipLevel: 0,
  user: null,
  isWalletConnected: false,
  hasEnteredCasino: false,
  activeMatches: [],
  myBets: [],
  marqueeMessages: [
    { id: 'sys-1', text: 'SYSTEM: 歡迎來到 CasinOYS V5 測試大廳 | 國庫狂熱點火監控中...', timestamp: Date.now() }
  ],

  setUser: (user) => set({ user, isWalletConnected: !!user }),
  setUserData: (amount, vip) => set({ balance: amount, vipLevel: vip }),
  setHasEnteredCasino: (entered) => set({ hasEnteredCasino: entered }),
  
  // 樂觀更新：下注瞬間扣款
  optimisticBet: (amount) => set((state) => ({ balance: state.balance - amount })),
  
  // 樂觀更新：套現瞬間入帳 (75折)
  optimisticCashout: (expectedPayout) => set((state) => ({ balance: state.balance + Math.floor(expectedPayout * 0.75) })),
  
  // 真實數據同步 (防呆回滾)
  syncBalance: (realBalance) => set({ balance: realBalance }),
  
  setActiveMatches: (matches) => set({ activeMatches: matches }),
  setMyBets: (bets) => set({ myBets: bets }),
  
  // 跑馬燈寫入 (保留最新 5 條訊息避免記憶體擁擠)
  addMarqueeMessage: (text) => set((state) => {
    const newMsg = { id: Math.random().toString(36).substring(7), text, timestamp: Date.now() };
    return { marqueeMessages: [newMsg, ...state.marqueeMessages].slice(0, 5) };
  }),

  logout: async () => {
    await supabase.auth.signOut();
    set({ 
      user: null, 
      isWalletConnected: false, 
      balance: 0, 
      vipLevel: 0, 
      hasEnteredCasino: false,
      activeMatches: [],
      myBets: []
    });
  }
}))