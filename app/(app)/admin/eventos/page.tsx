'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

type Event = { id: string; name: string; event_date: string | null; description: string | null; is_active: boolean }

const L: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: '500', color: 'var(--text-3)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }

export default function EventosPage() {
  const { profile, isAdmin } = useProfile()
  const [events,   setEvents]   = useState<Event[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Event | null>(null)
  const [name,     setName]     = useState('')
  const [date,     setDate]     = useState('')
  const [desc,     setDesc]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState('')
  const formRef = useRef<HTMLDivElement>(null)
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id])

  async function load() {
    setLoading(true)
    const { data } = await createClient().from('events').select('*').eq('church_id', profile!.church_id).order('event_date', { ascending: false })
    if (data) setEvents(data as Event[])
    setLoading(false)
  }

  function openNew() { setEditItem(null); setName(''); setDate(''); setDesc(''); setError(null); setShowForm(true); setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth' }); firstRef.current?.focus() }, 100) }
  function openEdit(ev: Event) { setEditItem(ev); setName(ev.name); setDate(ev.event_date || ''); setDesc(ev.description || ''); setError(null); setShowForm(true); setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth' }); firstRef.current?.focus() }, 100) }

  async function handleSave() {
    if (!name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true); setError(null)
    const sb = createClient()
    const payload = { church_id: profile!.church_id, name: name.trim(), event_date: date || null, description: desc || null }
    if (editItem) {
      const { error: err } = await sb.from('events').update(payload).eq('id', editItem.id)
      if (err) { setError(err.message); setSaving(false); return }
      setSuccess('Evento atualizado!')
    } else {
      const { error: err } = await sb.from('events').insert(payload)
      if (err) { setError(err.message); setSaving(false); return }
      setSuccess('Evento criado!')
    }
    setShowForm(false); setName(''); setDate(''); setDesc(''); setEditItem(null)
    setTimeout(() => setSuccess(''), 3000)
    await load(); setSaving(false)
  }

  async function handleToggle(ev: Event) { await createClient().from('events').update({ is_active: !ev.is_active }).eq('id', ev.id); await load() }
  async function handleDelete(ev: Event) { if (!confirm(`Excluir "${ev.name}"?`)) return; await createClient().from('events').delete().eq('id', ev.id); setSuccess('Evento excluído!'); setTimeout(() => setSuccess(''), 3000); await load() }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'600', letterSpacing:'-0.02em' }}>Eventos</h1>
          <p style={{ fontSize:'13px', color:'var(--text-3)', marginTop:'4px' }}>Gerencie os eventos para vincular movimentações</p>
        </div>
        {isAdmin && <button onClick={openNew} style={{ padding:'8px 18px', borderRadius:'var(--radius-sm)', background:'var(--brand)', color:'#fff', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'500' }}>+ Novo evento</button>}
      </div>

      {success && <div style={{ marginBottom:'16px', padding:'10px 16px', borderRadius:'8px', background:'var(--ok-dim)', color:'var(--ok)', fontSize:'13px', fontWeight:'500' }}>✓ {success}</div>}

      {showForm && (
        <div ref={formRef} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'20px', marginBottom:'20px' }}>
          <h3 style={{ fontSize:'14px', fontWeight:'600', marginBottom:'16px' }}>{editItem ? 'Editar evento' : 'Novo evento'}</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
            <div><label style={L}>Nome *</label><input ref={firstRef} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Culto Domingo, Retiro Jovens..."/></div>
            <div><label style={L}>Data do evento</label><input type="date" value={date} onChange={e => setDate(e.target.value)}/></div>
          </div>
          <div style={{ marginBottom:'12px' }}><label style={L}>Descrição</label><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Opcional"/></div>
          {error && <div style={{ marginBottom:'10px', color:'var(--empty)', fontSize:'13px' }}>{error}</div>}
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditItem(null) }} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', background:'transparent', border:'1px solid var(--border)', color:'var(--text-2)', cursor:'pointer', fontSize:'13px' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ padding:'8px 18px', borderRadius:'var(--radius-sm)', background:'var(--brand)', color:'#fff', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'500' }}>{saving ? 'Salvando...' : editItem ? 'Atualizar' : 'Criar'}</button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', color:'var(--text-3)' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>📅</div>
          <div>Nenhum evento cadastrado ainda.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {events.map(ev => (
            <div key={ev.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', borderRadius:'var(--radius)', background:'var(--bg-card)', border:`1px solid ${ev.is_active ? 'var(--border)' : 'rgba(255,255,255,0.04)'}`, opacity:ev.is_active?1:0.6, gap:'12px', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'14px', fontWeight:'600', color:'var(--text-1)' }}>{ev.name}</span>
                  {!ev.is_active && <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'99px', background:'var(--bg-3)', color:'var(--text-3)' }}>Inativo</span>}
                </div>
                <div style={{ fontSize:'12px', color:'var(--text-3)', marginTop:'3px', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                  {ev.event_date && <span>📅 {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}</span>}
                  {ev.description && <span>· {ev.description}</span>}
                </div>
              </div>
              {isAdmin && (
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  <button onClick={() => handleToggle(ev)} style={{ padding:'5px 10px', borderRadius:'6px', background:'transparent', border:'1px solid var(--border)', color:'var(--text-3)', cursor:'pointer', fontSize:'11px' }}>{ev.is_active ? 'Desativar' : 'Ativar'}</button>
                  <button onClick={() => openEdit(ev)} style={{ padding:'5px 10px', borderRadius:'6px', background:'transparent', border:'1px solid var(--border)', color:'var(--text-3)', cursor:'pointer', fontSize:'11px' }}>Editar</button>
                  <button onClick={() => handleDelete(ev)} style={{ padding:'5px 10px', borderRadius:'6px', background:'transparent', border:'1px solid rgba(239,68,68,0.3)', color:'var(--empty)', cursor:'pointer', fontSize:'11px' }}>✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}