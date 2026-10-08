'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AguardandoAprovacaoPage() {
  const router = useRouter()

  async function handleLogout() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 60% 0%, rgba(99,102,241,0.12) 0%, transparent 60%), #09090b',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      fontFamily: "'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: '420px',
        background: 'rgba(24,24,27,0.9)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: '20px', padding: '48px 36px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 24px 64px rgba(0,0,0,0.4)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#fafafa', letterSpacing: '-0.02em', marginBottom: '12px' }}>
          Cadastro recebido
        </div>
        <div style={{ fontSize: '14px', color: '#a1a1aa', lineHeight: '1.6', marginBottom: '32px' }}>
          Seu acesso está aguardando liberação por um administrador.
          Assim que aprovado, você receberá acesso completo ao sistema.
        </div>
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          fontSize: '12px', color: '#818cf8', marginBottom: '28px', lineHeight: '1.5',
        }}>
          Após a aprovação, será necessário fazer login novamente para que as permissões sejam atualizadas.
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 24px',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px', fontSize: '13px', color: '#71717a',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Sair da conta
        </button>
      </div>
    </div>
  )
}
