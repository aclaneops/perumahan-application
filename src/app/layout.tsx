import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Perumahan App',
  description: 'Aplikasi Manajemen Tagihan Perumahan',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
