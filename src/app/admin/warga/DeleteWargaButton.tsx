'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteWargaButton({ id, name }: { id: string, name: string }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    const confirmMessage = `Apakah Anda yakin ingin menghapus warga ${name} beserta semua histori tagihan dan pembayarannya?\n\nAksi ini tidak dapat dibatalkan.`
    
    if (!window.confirm(confirmMessage)) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/warga?id=${id}`, {
        method: 'DELETE',
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghapus warga')
      }
      
      router.refresh()
    } catch (err: any) {
      alert(err.message)
      setIsDeleting(false)
    }
  }

  return (
    <button 
      onClick={handleDelete} 
      disabled={isDeleting}
      className="text-red-600 hover:underline font-semibold text-xs disabled:opacity-50"
      title={`Hapus warga ${name}`}
    >
      {isDeleting ? 'Menghapus...' : 'Hapus'}
    </button>
  )
}
