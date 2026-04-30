'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'
import Image from 'next/image'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('motivo') === 'inativo') {
      setError('Sua conta está inativa. Entre em contato com o administrador.')
    }
  }, [searchParams])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('E-mail ou senha incorretos.'); setLoading(false); return }
    window.location.href = '/dashboard'
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
      {/* Glow de fundo */}
      <div style={{position:'fixed',top:'15%',left:'50%',transform:'translateX(-50%)',width:'500px',height:'400px',background:'radial-gradient(ellipse,rgba(99,102,241,0.10) 0%,transparent 70%)',pointerEvents:'none'}}/>

      <div className="fade-up" style={{width:'340px',background:'var(--bg-card)',border:'1px solid var(--border-md)',borderRadius:'16px',padding:'36px',backdropFilter:'blur(16px)'}}>

        {/* Logo + nome */}
        <div style={{textAlign:'center',marginBottom:'28px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'12px',marginBottom:'12px'}}>
            <div style={{
              width:'48px',height:'48px',borderRadius:'12px',
              background:'var(--bg-card)',
              border:'1px solid var(--border-md)',
              display:'flex',alignItems:'center',justifyContent:'center',padding:'8px',
              boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
            }}>
              <Image src="/logo.png" alt="Poiema" width={32} height={32} style={{objectFit:'contain',filter:'brightness(0) invert(1) opacity(0.9)'}}/>
            </div>
            <div style={{textAlign:'left'}}>
              <div style={{fontSize:'20px',fontWeight:'700',color:'var(--text-1)',lineHeight:1,letterSpacing:'-0.02em'}}>Poiema</div>
              <div style={{fontSize:'11px',color:'var(--text-3)',marginTop:'3px',letterSpacing:'0.02em'}}>Gestoque</div>
            </div>
          </div>
          <div style={{width:'40px',height:'1px',background:'var(--border-md)',margin:'0 auto 12px'}}/>
          <div style={{fontSize:'13px',color:'var(--text-3)',marginBottom:'24px'}}>Entre na sua conta</div>
        </div>

        <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:'14px'}}>
          <div>
            <label style={{display:'block',fontSize:'12px',color:'var(--text-2)',marginBottom:'6px',fontWeight:'500'}}>E-mail</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required/>
          </div>
          <div>
            <label style={{display:'block',fontSize:'12px',color:'var(--text-2)',marginBottom:'6px',fontWeight:'500'}}>Senha</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/>
          </div>

          {error && (
            <div style={{padding:'10px 12px',borderRadius:'8px',background:'var(--empty-dim)',border:'1px solid rgba(239,68,68,0.2)',fontSize:'13px',color:'var(--empty)'}}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            padding:'11px',marginTop:'4px',
            background:loading?'var(--bg-3)':'var(--brand)',
            color:'#fff',border:'none',borderRadius:'8px',
            fontSize:'14px',fontWeight:'600',
            cursor:loading?'not-allowed':'pointer',
            transition:'all 0.15s',
            letterSpacing:'-0.01em',
          }}>
            {loading?'Entrando...':'Entrar'}
          </button>
        </form>

        <div style={{marginTop:'20px',textAlign:'center',fontSize:'11px',color:'var(--text-3)'}}>
          Sistema de Gestão de Estoque
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
