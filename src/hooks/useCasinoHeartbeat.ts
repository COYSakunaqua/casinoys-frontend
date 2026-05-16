'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { apiFetchPath } from '@/lib/api'
import { useStore, Match } from '@/store/useStore'

const HEARTBEAT_MS = 15_000

function mapMatchesFromApi(rows: Record<string, unknown>[]): Match[] {
  return rows.map((m) => ({
    id: String(m.id),
    home_team: String(m.home_team ?? m.home ?? 'Home'),
    away_team: String(m.away_team ?? m.away ?? 'Away'),
    home_odds: Number(m.home_odds ?? 2),
    away_odds: Number(m.away_odds ?? 2),
    draw_odds: m.draw_odds != null ? Number(m.draw_odds) : undefined,
    is_active: Boolean(m.is_active ?? true),
  }))
}

async function fetchUserProfile(accessToken: string) {
  const res = await fetch(apiFetchPath('/api/user/profile'), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  return res.json() as Promise<{
    balance?: number
    bank?: number
    vip_level?: number
    vipLevel?: number
  }>
}

export function useCasinoHeartbeat() {
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const setUserData = useStore((s) => s.setUserData)
  const setActiveMatches = useStore((s) => s.setActiveMatches)
  const addMarqueeMessage = useStore((s) => s.addMarqueeMessage)

  const wasBloodMoonRef = useRef(false)

  // Auth session persistence + profile hydrate
  useEffect(() => {
    let mounted = true

    const hydrateProfile = async (accessToken: string) => {
      try {
        const profile = await fetchUserProfile(accessToken)
        if (!mounted || !profile) return
        const balance = profile.balance ?? profile.bank ?? 0
        const vip = profile.vip_level ?? profile.vipLevel ?? 0
        setUserData(balance, vip)
      } catch (err) {
        console.error('[CasinoHeartbeat] profile sync failed', err)
      }
    }

    const bootstrapSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!mounted) return

      if (session?.user) {
        setUser(session.user)
        await hydrateProfile(session.access_token)
      } else {
        setUser(null)
        wasBloodMoonRef.current = false
      }
    }

    bootstrapSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (session?.user) {
        setUser(session.user)
        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'INITIAL_SESSION'
        ) {
          await hydrateProfile(session.access_token)
        }
      } else {
        setUser(null)
        wasBloodMoonRef.current = false
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [setUser, setUserData])

  // Background heartbeat — only when authenticated
  useEffect(() => {
    if (!user) return

    const runHeartbeat = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const authHeaders: HeadersInit = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}

        const [matchesRes, treasuryRes] = await Promise.all([
          fetch(apiFetchPath('/api/betting/matches')),
          fetch(apiFetchPath('/api/internal/treasury'), { headers: authHeaders }),
        ])

        if (matchesRes.ok) {
          const rows = await matchesRes.json()
          if (Array.isArray(rows) && rows.length > 0) {
            setActiveMatches(mapMatchesFromApi(rows))
          }
        }

        if (treasuryRes.ok) {
          const treasury = await treasuryRes.json()
          const isBloodMoon =
            Number(treasury.current_m0) >= Number(treasury.threshold) &&
            Number(treasury.threshold) > 0

          if (isBloodMoon && !wasBloodMoonRef.current) {
            addMarqueeMessage(
              '⚠️ 國庫狂熱已點火！所有 All-in 賠率 +60%！'
            )
          }
          wasBloodMoonRef.current = isBloodMoon
        }
      } catch (err) {
        console.error('[CasinoHeartbeat] poll failed', err)
      }
    }

    runHeartbeat()
    const intervalId = setInterval(runHeartbeat, HEARTBEAT_MS)

    return () => clearInterval(intervalId)
  }, [user, setActiveMatches, addMarqueeMessage])
}
