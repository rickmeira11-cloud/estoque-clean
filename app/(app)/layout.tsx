'use client'
import { TopNav } from '@/components/TopNav'
import { useProfile } from '@/hooks/useProfile'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

function RedirectIfMustChangePassword() {
  const { profile, loading } = useProfile()
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    if (!loading && profile?.must_change_password && pathname !== '/trocar-senha') {
      router.replace('/trocar-senha')
    }
  }, [profile, loading, pathname])
  return null
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <RedirectIfMustChangePassword />
      <TopNav />
      <main style={{paddingTop:'var(--topbar-h)'}}>
        <div className="page-content" style={{padding:'24px 28px',maxWidth:'1200px',margin:'0 auto'}}>
          {children}
        </div>
      </main>
    </div>
  )
}
