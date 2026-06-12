'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

type Rule = {
  id: string; name: string; weekday: number; description: string | null; is_active: boolean
  frequency: 'semanal' | 'quinzenal' | 'mensal'; anchor_date: string | null; month_week: number | null; lead_days: number
}

const WEEKDAYS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
const FREQ_LABEL: Record<string,string> = { semanal:'Semanal', quinzenal:'Quinzenal', mensal:'Mensal' }
const WEEK_LABEL: Record<number,string> = { 1:'1ª', 2:'2ª', 3:'3ª', 4:'4ª', [-1]:'Última' }
const L: React.CSSProperties = { display:'block', fontSize:'11px', fontWeight:'500', color:'var(--text-3)', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.05em' }

export default function EventosRecorrentesPage() {
  const { profile, isAdmin } = useProfile()
  const [rules,    setRules]    = useState<Rule[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name,     setName]     = useState('')
  const [weekday,  setWeekday]  = useState('0')
  const [freq,     setFreq]     = useState('semanal')
  const [anchor,   setAnchor]   = useState('')
  const [monthWeek,setMonthWeek]= useState('1')
  const [leadDays, setLeadDays] = useState('2')
  const [desc,     setDesc]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [success,  setSuccess]  = useState('')

  useEffect(() => { if (profile?.church_id) load() }, [profile?.church_id])

  async function load() {
    setLoading(true)
    const { data } = await createClient().from('recurring_events').select('*').eq('church_id', profile!.church_id).order('weekday')
    if (data) setRules(data as Rule[])
    setLoading(false)
  }

  function resetForm() {
    setName(''); setWeekday('0'); setFreq('semanal'); setAnchor(''); setMonthWeek('1'); setLeadDays('2'); setDesc('')
  }

  async function handleSave() {
    if (!name.trim()) return
    if (freq === 'quinzenal' && !anchor) { setSuccess(''); alert('Para quinzenal, informe a data base'); return }
    setSaving(true)
    await createClient().from('recurring_events').insert({
      church_id: profile!.church_id, name: name.trim(), weekday: parseInt(weekday),
      frequency: freq, anchor_date: freq === 'quinzenal' ? anchor : null,
      month_week: freq === 'mensal' ? parseInt(monthWeek) : null,
      lead_days: parseInt(leadDays) || 2, description: desc || null,
    })
    setShowForm(false); resetForm()
    setSuccess('Regra criada!'); setTimeout(() => setSuccess(''), 3000)
    await load(); setSaving(false)
  }

  async function toggle(r: Rule) {
    await createClient().from('recurring_events').update({ is_active: !r.is_active }).eq('id', r.id)
    await load()
  }

  async function remove(r: Rule) {
    if (!confirm('Excluir a regra "' + r.name + '"?')) return
    await createClient().from('recurring_events').delete().eq('id', r.id)
    setSuccess('Regra excluída!'); setTimeout(() => setSuccess(''), 3000)
    await load()
  }

  function ruleDescription(r: Rule): string {
    if (r.frequency === 'semanal') return 'Toda ' + WEEKDAYS[r.weekday]
    if (r.frequency === 'quinzenal') return 'A cada 15 dias (' + WEEKDAYS[r.weekday] + ')'
    if (r.frequency === 'mensal') return (WEEK_LABEL[r.month_week || 1] || '') + ' ' + WEEKDAYS[r.weekday] + ' do mês'
    return ''
  }

  if (loading) return <div style={{ padding:'40px', textAlign:'center', color:'var(--text-3)' }}>Carregando...</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'600', letterSpacing:'-0.02em' }}>Eventos Recorrentes</h1>
          <p style={{ fontSize:'13px', color:'var(--text-3)', marginTop:'4px' }}>Regras para gerar eventos automaticamente</p>
        </div>
        {isAdmin && <button onClick={() => { resetForm(); setShowForm(true) }} style={{ padding:'8px 18px', borderRadius:'var(--radius-sm)', background:'var(--brand)', color:'#fff', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'500' }}>+ Nova regra</button>}
      </div>

      {success && <div style={{ marginBottom:'16px', padding:'10px 16px', borderRadius:'8px', background:'var(--ok-dim)', color:'var(--ok)', fontSize:'13px', fontWeight:'500' }}>✓ {success}</div>}

      <div style={{ marginBottom:'20px', padding:'12px 16px', borderRadius:'var(--radius)', background:'var(--info-dim)', border:'1px solid rgba(96,165,250,0.2)', fontSize:'13px', color:'var(--text-2)' }}>
        💡 Os eventos são criados automaticamente com a antecedência configurada. Para datas avulsas (ex: batismos), cadastre direto em <strong>Eventos</strong>.
      </div>

      {showForm && (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'20px', marginBottom:'20px' }}>
          <h3 style={{ fontSize:'14px', fontWeight:'600', marginBottom:'16px' }}>Nova regra recorrente</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'12px', marginBottom:'12px' }}>
            <div style={{ gridColumn:'1 / -1' }}><label style={L}>Nome do evento *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Culto de Domingo, Curso de Líderes..."/></div>
            <div>
              <label style={L}>Frequência *</label>
              <select value={freq} onChange={e => setFreq(e.target.value)}>
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal (15 dias)</option>
                <option value="mensal">Mensal</option>
              </select>
            </div>
            <div>
              <label style={L}>Dia da semana *</label>
              <select value={weekday} onChange={e => setWeekday(e.target.value)}>
                {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            {freq === 'quinzenal' && (
              <div>
                <label style={L}>Data base (1ª ocorrência) *</label>
                <input type="date" value={anchor} onChange={e => setAnchor(e.target.value)}/>
              </div>
            )}
            {freq === 'mensal' && (
              <div>
                <label style={L}>Qual ocorrência no mês *</label>
                <select value={monthWeek} onChange={e => setMonthWeek(e.target.value)}>
                  <option value="1">1ª do mês</option>
                  <option value="2">2ª do mês</option>
                  <option value="3">3ª do mês</option>
                  <option value="4">4ª do mês</option>
                  <option value="-1">Última do mês</option>
                </select>
              </div>
            )}
            <div>
              <label style={L}>Antecedência (dias)</label>
              <input type="number" min="0" value={leadDays} onChange={e => setLeadDays(e.target.value)}/>
            </div>
            <div style={{ gridColumn:'1 / -1' }}><label style={L}>Descrição</label><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Opcional"/></div>
          </div>
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', background:'transparent', border:'1px solid var(--border)', color:'var(--text-2)', cursor:'pointer', fontSize:'13px' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ padding:'8px 18px', borderRadius:'var(--radius-sm)', background:'var(--brand)', color:'#fff', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'500' }}>{saving ? 'Salvando...' : 'Criar regra'}</button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', color:'var(--text-3)' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>🔁</div>
          <div>Nenhuma regra recorrente cadastrada.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {rules.map(r => (
            <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', borderRadius:'var(--radius)', background:'var(--bg-card)', border:`1px solid ${r.is_active ? 'var(--border)' : 'rgba(255,255,255,0.04)'}`, opacity:r.is_active?1:0.55, gap:'12px', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'14px', fontWeight:'600', color:'var(--text-1)' }}>{r.name}</span>
                  <span style={{ fontSize:'11px', padding:'2px 10px', borderRadius:'99px', background:'var(--brand-dim)', color:'var(--brand-light)', fontWeight:'600' }}>{FREQ_LABEL[r.frequency]}</span>
                  {!r.is_active && <span style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'99px', background:'var(--bg-3)', color:'var(--text-3)' }}>Pausada</span>}
                </div>
                <div style={{ fontSize:'12px', color:'var(--text-3)', marginTop:'3px' }}>
                  {ruleDescription(r)} · cria {r.lead_days} dia(s) antes
                  {r.description && ' · ' + r.description}
                </div>
              </div>
              {isAdmin && (
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  <button onClick={() => toggle(r)} style={{ padding:'5px 12px', borderRadius:'6px', background:'transparent', border:'1px solid var(--border)', color:r.is_active?'var(--low)':'var(--ok)', cursor:'pointer', fontSize:'11px' }}>{r.is_active ? 'Pausar' : 'Ativar'}</button>
                  <button onClick={() => remove(r)} style={{ padding:'5px 12px', borderRadius:'6px', background:'transparent', border:'1px solid rgba(239,68,68,0.3)', color:'var(--empty)', cursor:'pointer', fontSize:'11px' }}>✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}