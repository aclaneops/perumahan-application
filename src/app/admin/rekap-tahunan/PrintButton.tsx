'use client'

import { useEffect, useState } from 'react'

export default function PrintButton() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) return null

  return (
    <button 
      type="button"
      onClick={() => window.print()}
      className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-bold hover:bg-blue-200 transition shadow-sm text-sm"
    >
      🖨️ Cetak Laporan
    </button>
  )
}
