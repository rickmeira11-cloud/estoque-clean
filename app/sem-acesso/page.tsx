'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
export default function SemAcessoPage() {
  const router = useRouter()
  async function handleLogout() { await createClient().auth.signOut(); router.push('/login') }
  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{maxWidth:'380px',width:'100%',textAlign:'center',background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'16px',padding:'40px 32px'}}>
        <div style={{fontSize:'36px',marginBottom:'16px'}}>🔒</div>
        <h1 style={{fontSize:'17px',fontWeight:'600',color:'var(--text-1)',marginBottom:'10px'}}>Aguardando acesso</h1>
        <p style={{fontSize:'13px',color:'var(--text-3)',lineHeight:'1.6',marginBottom:'24px'}}>Sua conta ainda não foi vinculada a uma igreja. Entre em contato com o administrador.</p>
        <button onClick={handleLogout} style={{width:'100%',padding:'10px',background:'transparent',border:'1px solid var(--border)',borderRadius:'8px',fontSize:'13px',color:'var(--text-2)',cursor:'pointer'}}>Sair da conta</button>
      </div>
    </div>
  )
}
