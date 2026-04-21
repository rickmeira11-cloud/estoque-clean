import { TopNav } from '@/components/TopNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <TopNav />
      <main style={{paddingTop:'var(--topbar-h)'}}>
        <div className="page-content" style={{padding:'24px 28px',maxWidth:'1200px',margin:'0 auto'}}>
          {children}
        </div>
      </main>
    </div>
  )
}
