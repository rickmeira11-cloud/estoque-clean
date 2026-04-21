import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Poiema · Gestão de Estoque',
  description: 'Sistema de gestão de estoque para igrejas Poiema',
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
