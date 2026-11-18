import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Poiema · Gestão de Estoque',
  description: 'Sistema de gestão de estoque para igrejas Poiema',
  themeColor: '#09090b',
  viewport: { width:'device-width', initialScale:1, maximumScale:1 },
  manifest: '/manifest.json',
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
      <head>
        {/* Anti-flash: aplica tema antes do primeiro paint. Prioridade: localStorage > 'light' */}
        <script dangerouslySetInnerHTML={{__html: `(function(){try{var t=localStorage.getItem('gestoque_theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})()`}}/>
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{__html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js')
                .then(r => console.log('SW ok:', r.scope))
                .catch(e => console.log('SW erro:', e));
            });
          }
        `}}/>
      </body>
    </html>
  )
}
