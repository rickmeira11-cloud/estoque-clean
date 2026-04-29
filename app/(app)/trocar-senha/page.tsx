'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/hooks/useProfile'

export default function TrocarSenhaPage() {
  const { profile } = useProfile()
  const router = useRouter()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string|null>(null)

  async function handleSubmit() {
    if (!novaSenha || novaSenha.length < 6) { setError('A senha deve ter pelo menos 6 caracteres'); return }
    if (novaSenha !== confirmar) { setError('As senhas não coincidem'); return }
    setSaving(true); setError(null)
    const sb = createClient()
    const { error: err } = await sb.auth.updateUser({ password: novaSenha })
    if (err) { setError(err.message); setSaving(false); return }
    // Marcar must_change_password = false
    await sb.from('profiles').update({ must_change_password: false }).eq('id', profile!.id)
    router.push('/dashboard')
  }

  const L = { display:'block' as const, fontSize:'12px', color:'var(--text-3)', marginBottom:'6px' }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-1)', padding:'20px' }}>
      <div style={{ width:'100%', maxWidth:'400px' }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ fontSize:'32px', marginBottom:'12px' }}>🔐</div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'var(--text-1)', marginBottom:'8px' }}>Troque sua senha</h1>
          <p style={{ fontSize:'14px', color:'var(--text-3)', lineHeight:'1.5' }}>
            Por segurança, defina uma nova senha antes de continuar.
          </p>
        </div>

        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-md)', borderRadius:'16px', padding:'28px' }}>
          {error && (
            <div style={{ marginBottom:'16px', padding:'10px 14px', borderRadius:'8px', background:'var(--empty-dim)', fontSize:'13px', color:'var(--empty)' }}>{error}</div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <label style={L}>Nova senha</label>
              <input
                type="password"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoFocus
              />
            </div>
            <div>
              <label style={L}>Confirmar senha</label>
              <input
                type="password"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                placeholder="Digite a senha novamente"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ width:'100%', marginTop:'20px', padding:'12px', background:'var(--brand)', color:'#fff', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'600', cursor:saving?'not-allowed':'pointer', opacity:saving?0.7:1 }}>
            {saving ? 'Salvando...' : 'Definir nova senha'}
          </button>
        </div>
      </div>
    </div>
  )
}
