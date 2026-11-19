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
      background: 'radial-gradient(ellipse at 60% 0%, var(--brand-dim) 0%, transparent 60%), var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      fontFamily: "'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: '420px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-md)',
        borderRadius: '20px', padding: '48px 36px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
        <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-1)', letterSpacing: '-0.02em', marginBottom: '12px' }}>
          Cadastro recebido
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: '1.6', marginBottom: '32px' }}>
          Seu acesso está aguardando liberação por um administrador.
          Assim que aprovado, você receberá acesso completo ao sistema.
        </div>
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          background: 'var(--brand-dim)', border: '1px solid var(--border-md)',
          fontSize: '12px', color: 'var(--brand-light)', marginBottom: '28px', lineHeight: '1.5',
        }}>
          Após a aprovação, será necessário fazer login novamente para que as permissões sejam atualizadas.
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 24px',
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: '10px', fontSize: '13px', color: 'var(--text-3)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Sair da conta
        </button>
      </div>
    </div>
  )
}
