'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const ACTIVE_CHURCH_KEY = 'gestoque_active_church'

export default function SelecionarIgrejaPage() {
  const router = useRouter()
  const [churches, setChurches] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const { data } = await sb
      .from('user_churches')
      .select('church_id, role, church:churches(id,name,city,state,logo_url,is_active)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!data || data.length === 0) { router.replace('/login'); return }

    // Se so tem uma igreja, ir direto
    if (data.length === 1) {
      localStorage.setItem(ACTIVE_CHURCH_KEY, data[0].church_id)
      router.replace('/dashboard')
      return
    }

    setChurches(data.filter((d: any) => d.church?.is_active).map((d: any) => ({
      id: d.church_id,
      name: d.church.name,
      city: d.church.city,
      state: d.church.state,
      logo_url: d.church.logo_url,
      role: d.role,
    })))
    setLoading(false)
  }

  function select(churchId: string) {
    localStorage.setItem(ACTIVE_CHURCH_KEY, churchId)
    router.replace('/dashboard')
  }

  const ROLE_LABEL: Record<string,string> = { super_admin: 'Super Admin', admin: 'Admin', operator: 'Operador', viewer: 'Visualizador' }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#09090b' }}>
      <div style={{ fontSize:'13px', color:'#71717a' }}>Carregando...</div>
    </div>
  )

  return (
    <div style={{
      minHeight:'100vh',
      background:'radial-gradient(ellipse at 60% 0%, rgba(99,102,241,0.12) 0%, transparent 60%), #09090b',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
      fontFamily:"'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
    }}>
      <div style={{ width:'100%', maxWidth:'440px' }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ width:'56px', height:'56px', borderRadius:'14px', background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 0 24px rgba(99,102,241,0.15)' }}>
            <Image src="/logo.png" alt="Poiema" width={32} height={32} style={{ objectFit:'contain', filter:'brightness(0) invert(1) opacity(0.9)' }}/>
          </div>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#fafafa', marginBottom:'6px', letterSpacing:'-0.02em' }}>Selecionar Igreja</h1>
          <p style={{ fontSize:'13px', color:'#71717a' }}>Você tem acesso a múltiplas igrejas. Escolha com qual deseja operar.</p>
        </div>

        {/* Lista de igrejas */}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {churches.map(c => (
            <button key={c.id} onClick={() => select(c.id)} style={{
              width:'100%', padding:'16px 20px',
              background:'rgba(24,24,27,0.9)',
              border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'14px', cursor:'pointer',
              display:'flex', alignItems:'center', gap:'14px',
              textAlign:'left', transition:'all 0.15s',
              backdropFilter:'blur(10px)',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.background = 'rgba(99,102,241,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(24,24,27,0.9)' }}>
              {/* Logo */}
              <div style={{ width:'48px', height:'48px', borderRadius:'12px', background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
                {c.logo_url ? (
                  <img src={c.logo_url} alt={c.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                ) : (
                  <span style={{ fontSize:'20px', fontWeight:'700', color:'#818cf8' }}>{c.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'15px', fontWeight:'600', color:'#fafafa', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                <div style={{ fontSize:'12px', color:'#71717a', marginTop:'2px' }}>
                  {[c.city, c.state].filter(Boolean).join(', ')}
                  {c.city || c.state ? ' · ' : ''}
                  <span style={{ color:'#818cf8' }}>{ROLE_LABEL[c.role] || c.role}</span>
                </div>
              </div>
              {/* Seta */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ))}
        </div>

        <div style={{ textAlign:'center', marginTop:'24px', fontSize:'11px', color:'#3f3f46' }}>
          Gestoque · Sistema de Gestão de Estoque
        </div>
      </div>
    </div>
  )
}
