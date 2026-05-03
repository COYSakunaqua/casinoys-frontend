import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface CasinoState {
  balance: number;
  vipLevel: number;
  user: User | null;
  isWalletConnected: boolean;
  hasEnteredCasino: boolean; 
  
  setUser: (user: User | null) => void;
  setUserData: (amount: number, vip: number) => void;
  setHasEnteredCasino: (entered: boolean) => void; 
  optimisticBet: (amount: number) => void;
  logout: () => Promise<void>;
}

export const useStore = create<CasinoState>((set) => ({
  balance: 0,
  vipLevel: 0,
  user: null,
  isWalletConnected: false,
  hasEnteredCasino: false,

  setUser: (user) => set({ user, isWalletConnected: !!user }),
  setUserData: (amount, vip) => set({ balance: amount, vipLevel: vip }),
  setHasEnteredCasino: (entered) => set({ hasEnteredCasino: entered }),
  optimisticBet: (amount) => set((state) => ({ balance: state.balance - amount })),
  
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isWalletConnected: false, balance: 0, vipLevel: 0, hasEnteredCasino: false });
  }
}))