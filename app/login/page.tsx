'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const sb = createClient()
    const { error: err } = await sb.auth.signInWithPassword({ email, password })
    if (err) { setError('E-mail ou senha incorretos.'); setLoading(false); return }
    // Aguardar sessao ser salva
    await new Promise(r => setTimeout(r, 300))
    window.location.href = '/selecionar-igreja'
  }

  async function handleGoogle() {
    setLoading(true); setError('')
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/selecionar-igreja' },
    })
    if (err) { setError('Erro ao iniciar login com Google.'); setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 60% 0%, rgba(99,102,241,0.12) 0%, transparent 60%), radial-gradient(ellipse at 0% 100%, rgba(99,102,241,0.08) 0%, transparent 50%), #09090b',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
    }}>

      {/* Decoração de fundo */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
        }}/>
        <div style={{
          position: 'absolute', bottom: '-20%', left: '-10%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)',
        }}/>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: '380px',
        background: 'rgba(24,24,27,0.9)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: '20px',
        padding: '40px 36px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 24px 64px rgba(0,0,0,0.4), 0 0 80px rgba(99,102,241,0.05)',
        position: 'relative',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 24px rgba(99,102,241,0.15)',
          }}>
            <Image src="/logo.png" alt="Poiema" width={38} height={38}
              style={{ objectFit: 'contain', filter: 'brightness(0) invert(1) opacity(0.9)' }}/>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#fafafa', letterSpacing: '-0.02em' }}>
            Poiema
          </div>
          <div style={{ fontSize: '12px', color: '#71717a', marginTop: '3px', letterSpacing: '0.04em' }}>
            Gestoque
          </div>
        </div>

        {/* Titulo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '15px', color: '#a1a1aa', fontWeight: '400' }}>
            Bem-vindo de volta
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div style={{
            marginBottom: '16px', padding: '10px 14px', borderRadius: '10px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            fontSize: '13px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '7px', fontWeight: '500', letterSpacing: '0.02em' }}>
              E-mail
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#52525b' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                style={{
                  width: '100%', padding: '11px 14px 11px 38px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px', fontSize: '14px', color: '#fafafa',
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '7px', fontWeight: '500', letterSpacing: '0.02em' }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#52525b' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '11px 14px 11px 38px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px', fontSize: '14px', color: '#fafafa',
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px',
              background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(99,102,241,0.3)',
              transition: 'all 0.2s',
              fontFamily: "'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
            }}
            onMouseEnter={e => { if (!loading) { (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.target as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(99,102,241,0.4)' }}}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.transform = 'translateY(0)'; (e.target as HTMLButtonElement).style.boxShadow = loading ? 'none' : '0 4px 16px rgba(99,102,241,0.3)' }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Divisor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }}/>
          <span style={{ fontSize: '11px', color: '#52525b', letterSpacing: '0.04em' }}>ou</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }}/>
        </div>

        {/* Botão Google */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: '100%', padding: '11px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px', fontSize: '14px', color: '#d4d4d8',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            fontFamily: "'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)') }}
          onMouseLeave={e => { (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)') }}
        >
          {/* Google icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Entrar com Google
        </button>

        {/* Rodapé */}
        <div style={{ marginTop: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#3f3f46', letterSpacing: '0.03em' }}>
            Sistema de Gestão de Estoque
          </div>
          <div style={{ fontSize: '10px', color: '#27272a', marginTop: '4px', letterSpacing: '0.02em' }}>
            v1.0 · Poiema
          </div>
        </div>
      </div>
    </div>
  )
}
