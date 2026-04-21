'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null)
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) { setError('E-mail ou senha incorretos.'); setLoading(false); return }
    router.push('/dashboard'); router.refresh()
  }
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
      <div style={{position:'fixed',top:'20%',left:'50%',transform:'translateX(-50%)',width:'500px',height:'300px',background:'radial-gradient(ellipse,rgba(91,60,245,0.12) 0%,transparent 70%)',pointerEvents:'none'}}/>
      <div className="fade-up" style={{width:'340px',background:'var(--bg-card)',border:'1px solid var(--border-md)',borderRadius:'16px',padding:'36px',backdropFilter:'blur(16px)'}}>
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{width:'44px',height:'44px',borderRadius:'12px',background:'var(--brand)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',fontWeight:'700',color:'#fff',margin:'0 auto 12px'}}>P</div>
          <div style={{fontSize:'18px',fontWeight:'600',color:'var(--text-1)'}}>Poiema Estoque</div>
          <div style={{fontSize:'13px',color:'var(--text-3)',marginTop:'4px'}}>Entre na sua conta</div>
        </div>
        <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:'14px'}}>
          <div><label style={{display:'block',fontSize:'12px',color:'var(--text-2)',marginBottom:'6px'}}>E-mail</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required/></div>
          <div><label style={{display:'block',fontSize:'12px',color:'var(--text-2)',marginBottom:'6px'}}>Senha</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/></div>
          {error&&<div style={{padding:'10px 12px',borderRadius:'8px',background:'var(--empty-dim)',border:'1px solid rgba(239,68,68,0.2)',fontSize:'13px',color:'var(--empty)'}}>{error}</div>}
          <button type="submit" disabled={loading} style={{padding:'10px',background:loading?'var(--bg-3)':'var(--brand)',color:'#fff',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:loading?'not-allowed':'pointer',marginTop:'4px'}}>{loading?'Entrando...':'Entrar'}</button>
        </form>
      </div>
    </div>
  )
}
