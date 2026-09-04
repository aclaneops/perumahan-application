'use client'

export default function PrintButton() {
  return (
    <button 
      onClick={() => window.print()} 
      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
    >
      <span>🖨️</span> Cetak Laporan
    </button>
  )
}
