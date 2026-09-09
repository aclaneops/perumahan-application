'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function AutoRefreshResident({ userId }: { userId: string }) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to changes on bills and payments related to this user
    const channel = supabase
      .channel('resident-refresh')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills', filter: `profile_id=eq.${userId}` },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills', filter: `user_id=eq.${userId}` },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `profile_id=eq.${userId}` },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${userId}` },
        () => router.refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router, userId])

  return null
}
