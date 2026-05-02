import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface CasinoState {
  balance: number;
  user: User | null;
  isWalletConnected: boolean;
  
  // 狀態更新
  setUser: (user: User | null) => void;
  setBalance: (amount: number) => void;
  
  // 核心功能
  optimisticBet: (amount: number) => void;
  logout: () => Promise<void>;
}

export const useStore = create<CasinoState>((set) => ({
  balance: 0,
  user: null,
  isWalletConnected: false,

  setUser: (user) => set({ user, isWalletConnected: !!user }),
  setBalance: (amount) => set({ balance: amount }),
  
  optimisticBet: (amount) => set((state) => ({ balance: state.balance - amount })),
  
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isWalletConnected: false, balance: 0 });
  }
}))