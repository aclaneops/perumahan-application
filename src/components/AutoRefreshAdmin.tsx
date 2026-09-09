'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function AutoRefreshAdmin() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to all changes on bills and payments since admin needs to see everything
    const channel = supabase
      .channel('admin-refresh')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills' },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => router.refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router])

  return null
}
