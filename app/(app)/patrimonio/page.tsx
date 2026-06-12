'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

type Patrimonio = {
  id: string
  name: string
  description: string | null
  category: string | null
  serial_number: string | null
  barcode: string | null
  acquisition_date: string | null
  acquisition_value: number | null
  useful_life_years: number
  depreciation_rate: number
  location_id: string | null
  physical_location: string | null
  ministry_id: string | null
  quantity: number
  nfe_key: string | null
  nfe_file_url: string | null
  status: 'ativo' | 'em_manutencao' | 'emprestado' | 'baixado'
  notes: string | null
  is_active: boolean
  ministry?: { name: string } | null
  location?: { name: string } | null
}

type Manutencao = {
  id: string
  date: string
  description: string
  cost: number | null
  performed_by: string | null
  next_maintenance_date: string | null
}

type Movimentacao = {
  id: string
  type: string
  responsible_person: string | null
  expected_return_date: string | null
  actual_return_date: string | null
  notes: string | null
  created_at: string
  from_ministry?: { name: string } | null
  to_ministry?: { name: string } | null
}

const L: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: '500',
  color: 'var(--text-3)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em'
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  ativo:          { label: 'Ativo',          color: 'var(--ok)',    bg: 'var(--ok-dim)' },
  em_manutencao:  { label: 'Em manutenção',  color: 'var(--low)',   bg: 'var(--low-dim)' },
  emprestado:     { label: 'Emprestado',     color: 'var(--info)',  bg: 'var(--info-dim)' },
  baixado:        { label: 'Baixado',        color: 'var(--empty)', bg: 'var(--empty-dim)' },
}

// Calcular valor depreciado
function valorAtualUnitario(p: Patrimonio): number {
  if (!p.acquisition_value || !p.acquisition_date) return p.acquisition_value || 0
  const anos = (Date.now() - new Date(p.acquisition_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  const valor = p.acquisition_value * Math.pow(1 - p.depreciation_rate / 100, anos)
  return Math.max(valor, p.acquisition_value * 0.1) // valor residual mínimo de 10%
}

// Valor total atual = unitario depreciado × quantidade
function valorAtual(p: Patrimonio): number {
  return valorAtualUnitario(p) * (p.quantity || 1)
}

// Valor total de aquisicao = unitario × quantidade
function valorAquisicaoTotal(p: Patrimonio): number {
  return (p.acquisition_value || 0) * (p.quantity || 1)
}

const blank = {
  name: '', description: '', category: '', serial_number: '', barcode: '',
  acquisition_date: '', acquisition_value: '', useful_life_years: '5', depreciation_rate: '20',
  location_id: '', physical_location: '', ministry_id: '', notes: '', supplier: '', quantity: '1', nfe_key: '', nfe_file_url: '',
}

export default function PatrimonioPage() {
  const { profile, isAdmin } = useProfile()
  const [items,      setItems]      = useState<Patrimonio[]>([])
  const [locations,  setLocations]  = useState<{ id: string; name: string }[]>([])
  const [ministries, setMinistries] = useState<{ id: string; name: string }[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [editItem,   setEditItem]   = useState<Patrimonio | null>(null)
  const [form,       setForm]       = useState(blank)
  const [saving,     setSaving]     = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [formError,  setFormError]  = useState<string | null>(null)
  const [success,    setSuccess]    = useState('')
  const [search,     setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [detail,     setDetail]     = useState<Patrimonio | null>(null)
  const [emprestimos, setEmprestimos] = useState<any[]>([])
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (profile?.church_id) loadBase() }, [profile?.church_id])

  async function loadBase() {
    setLoading(true)
    const sb = createClient()
    const [{ data: pats }, { data: locs }, { data: mins }] = await Promise.all([
      sb.from('patrimonio')
        .select('*,ministry:ministries(name),location:locations(name)')
        .eq('church_id', profile!.church_id)
        .eq('is_active', true)
        .order('name'),
      sb.from('locations').select('id,name').eq('church_id', profile!.church_id).eq('is_active', true).order('name'),
      sb.from('ministries').select('id,name').eq('church_id', profile!.church_id).order('name'),
    ])
    if (pats) setItems(pats as Patrimonio[])
    if (locs) setLocations(locs)
    if (mins) setMinistries(mins)

    // Carregar emprestimos pendentes (sem devolucao registrada)
    const { data: emps } = await sb
      .from('patrimonio_movimentacoes')
      .select('id,patrimonio_id,responsible_person,expected_return_date,created_at,patrimonio:patrimonio(name,status)')
      .eq('church_id', profile!.church_id)
      .eq('type', 'emprestimo')
      .order('expected_return_date', { ascending: true })
    if (emps) {
      // Filtrar apenas os que ainda estao emprestados
      const pendentes = emps.filter((e: any) => e.patrimonio?.status === 'emprestado')
      setEmprestimos(pendentes)
    }

    setLoading(false)
  }

  function openNew() {
    setEditItem(null); setForm(blank); setFormError(null); setShowModal(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  function openEdit(p: Patrimonio) {
    setEditItem(p)
    setForm({
      name: p.name, description: p.description || '', category: p.category || '',
      serial_number: p.serial_number || '', barcode: p.barcode || '',
      acquisition_date: p.acquisition_date || '', acquisition_value: p.acquisition_value ? String(p.acquisition_value) : '',
      useful_life_years: String(p.useful_life_years), depreciation_rate: String(p.depreciation_rate),
      location_id: p.location_id || '', physical_location: p.physical_location || '',
      ministry_id: p.ministry_id || '', notes: p.notes || '', supplier: (p as any).supplier || '', quantity: String(p.quantity || 1), nfe_key: (p as any).nfe_key || '', nfe_file_url: (p as any).nfe_file_url || '',
    })
    setFormError(null); setShowModal(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function handleUploadNfe(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const sb = createClient()
    const ext = file.name.split('.').pop()
    const fileName = profile!.church_id + '/' + Date.now() + '.' + ext
    const { error } = await sb.storage.from('patrimonio-nfe').upload(fileName, file, { upsert: true })
    if (error) { setFormError('Erro ao enviar arquivo: ' + error.message); setUploading(false); return }
    const { data } = sb.storage.from('patrimonio-nfe').getPublicUrl(fileName)
    setForm(f => ({ ...f, nfe_file_url: data.publicUrl }))
    setUploading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Nome é obrigatório'); return }
    setSaving(true); setFormError(null)
    const sb = createClient()
    const payload = {
      church_id:         profile!.church_id,
      name:              form.name.trim(),
      description:       form.description || null,
      category:          form.category || null,
      serial_number:     form.serial_number || null,
      barcode:           form.barcode || null,
      acquisition_date:  form.acquisition_date || null,
      acquisition_value: form.acquisition_value ? parseFloat(form.acquisition_value) : null,
      useful_life_years: parseInt(form.useful_life_years) || 5,
      depreciation_rate: parseFloat(form.depreciation_rate) || 20,
      location_id:       form.location_id || null,
      physical_location: form.physical_location || null,
      ministry_id:       form.ministry_id || null,
      notes:             form.notes || null,
      supplier:          form.supplier || null,
      quantity:          parseInt(form.quantity) || 1,
      nfe_key:           form.nfe_key || null,
      nfe_file_url:      form.nfe_file_url || null,
    }

    if (editItem) {
      const { error } = await sb.from('patrimonio').update(payload).eq('id', editItem.id)
      if (error) { setFormError(error.message); setSaving(false); return }
      setSuccess('Bem atualizado!')
    } else {
      const { error } = await sb.from('patrimonio').insert(payload)
      if (error) { setFormError(error.message); setSaving(false); return }
      setSuccess('Bem cadastrado!')
    }

    setShowModal(false); setForm(blank); setEditItem(null)
    setTimeout(() => setSuccess(''), 3000)
    await loadBase()
    setSaving(false)
  }

  async function handleDelete(p: Patrimonio) {
    if (!confirm(`Excluir "${p.name}" do patrimônio?`)) return
    await createClient().from('patrimonio').update({ is_active: false }).eq('id', p.id)
    setSuccess('Bem removido!')
    setTimeout(() => setSuccess(''), 3000)
    await loadBase()
  }

  async function exportDepreciacao() {
    const { utils, writeFile } = await import('xlsx')
    const rows = items.map(p => {
      const qtd = p.quantity || 1
      const vUnit = p.acquisition_value || 0
      const vAquisTotal = vUnit * qtd
      const vAtualTotal = valorAtual(p)
      const anos = p.acquisition_date ? ((Date.now() - new Date(p.acquisition_date).getTime()) / (1000*60*60*24*365.25)) : 0
      return {
        'Bem': p.name,
        'Categoria': p.category || '—',
        'Ministério': p.ministry?.name || '—',
        'Qtd': qtd,
        'Status': STATUS_CFG[p.status].label,
        'Data aquisição': p.acquisition_date ? new Date(p.acquisition_date).toLocaleDateString('pt-BR') : '—',
        'Valor unit.': vUnit ? 'R$ ' + vUnit.toFixed(2) : '—',
        'Valor aquisição total': vAquisTotal ? 'R$ ' + vAquisTotal.toFixed(2) : '—',
        'Anos de uso': anos.toFixed(1),
        'Taxa depreciação': p.depreciation_rate + '%',
        'Valor atual': 'R$ ' + vAtualTotal.toFixed(2),
        'Depreciação acumulada': 'R$ ' + (vAquisTotal - vAtualTotal).toFixed(2),
      }
    })
    const ws = utils.json_to_sheet(rows)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Depreciação')
    ws['!cols'] = Object.keys(rows[0]||{}).map(k => ({ wch: Math.max(k.length, 14) }))
    writeFile(wb, 'patrimonio-depreciacao-' + new Date().toISOString().split('T')[0] + '.xlsx')
  }

  async function exportDepreciacaoPDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })
    const church = profile?.church?.name || 'Poiema'
    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

    doc.setFillColor(17,17,19); doc.rect(0,0,297,30,'F')
    doc.setTextColor(250,250,250); doc.setFontSize(16); doc.setFont('helvetica','bold')
    doc.text('Relatório de Depreciação — Patrimônio', 14, 12)
    doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(161,161,170)
    doc.text(church + ' · Gerado em ' + today, 14, 20)

    const totalAq = items.reduce((s,p) => s + valorAquisicaoTotal(p), 0)
    const totalAt = items.reduce((s,p) => s + valorAtual(p), 0)
    doc.text('Valor total de aquisição: R$ ' + totalAq.toFixed(2) + '  ·  Valor atual: R$ ' + totalAt.toFixed(2) + '  ·  Depreciação: R$ ' + (totalAq-totalAt).toFixed(2), 14, 26)

    const head = [['Bem','Categoria','Qtd','Aquisição','Valor aquis.','Anos','Taxa','Valor atual','Depreciado']]
    const body = items.map(p => {
      const vAquisTotal = valorAquisicaoTotal(p)
      const vAtualTotal = valorAtual(p)
      const anos = p.acquisition_date ? ((Date.now() - new Date(p.acquisition_date).getTime()) / (1000*60*60*24*365.25)) : 0
      return [
        p.name, p.category || '—', p.quantity || 1,
        p.acquisition_date ? new Date(p.acquisition_date).toLocaleDateString('pt-BR') : '—',
        'R$ ' + vAquisTotal.toFixed(2), anos.toFixed(1), p.depreciation_rate + '%',
        'R$ ' + vAtualTotal.toFixed(2), 'R$ ' + (vAquisTotal - vAtualTotal).toFixed(2),
      ]
    })

    autoTable(doc, {
      head, body, startY: 34,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [99,102,241], textColor: [255,255,255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248,248,250] },
    })

    doc.save('patrimonio-depreciacao-' + new Date().toISOString().split('T')[0] + '.pdf')
  }

  const filtered = items.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalAquisicao = items.reduce((s, p) => s + valorAquisicaoTotal(p), 0)
  const totalAtual = items.reduce((s, p) => s + valorAtual(p), 0)

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>

  // Se há um item em detalhe, mostrar a ficha
  if (detail) return <PatrimonioDetalhe item={detail} ministries={ministries} onBack={() => { setDetail(null); loadBase() }} onEdit={(p) => { setDetail(null); openEdit(p) }} isAdmin={isAdmin} profile={profile}/>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em' }}>Patrimônio</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>Gestão de bens imobilizados</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {items.length > 0 && (
            <>
              <button onClick={exportDepreciacao} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: '#1a6e3c', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                Excel
              </button>
              <button onClick={exportDepreciacaoPDF} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: '#b91c1c', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                PDF
              </button>
            </>
          )}
          {isAdmin && (
            <button onClick={openNew} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
              + Novo bem
            </button>
          )}
        </div>
      </div>

      {success && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '8px', background: 'var(--ok-dim)', color: 'var(--ok)', fontSize: '13px', fontWeight: '500' }}>
          ✓ {success}
        </div>
      )}

      {/* Alertas de emprestimos pendentes */}
      {emprestimos.length > 0 && (() => {
        const hoje = new Date(); hoje.setHours(0,0,0,0)
        const vencidos = emprestimos.filter(e => e.expected_return_date && new Date(e.expected_return_date) < hoje)
        const proximos = emprestimos.filter(e => {
          if (!e.expected_return_date) return false
          const d = new Date(e.expected_return_date)
          const diff = (d.getTime() - hoje.getTime()) / (1000*60*60*24)
          return diff >= 0 && diff <= 7
        })
        if (vencidos.length === 0 && proximos.length === 0 && emprestimos.length === 0) return null
        return (
          <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {vencidos.length > 0 && (
              <div style={{ padding: '12px 16px', borderRadius: 'var(--radius)', background: 'var(--empty-dim)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--empty)', marginBottom: '6px' }}>
                  🔴 {vencidos.length} empréstimo(s) com devolução vencida
                </div>
                {vencidos.map(e => (
                  <div key={e.id} style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
                    <strong>{e.patrimonio?.name}</strong> — {e.responsible_person} · venceu em {new Date(e.expected_return_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </div>
                ))}
              </div>
            )}
            {proximos.length > 0 && (
              <div style={{ padding: '12px 16px', borderRadius: 'var(--radius)', background: 'var(--low-dim)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--low)', marginBottom: '6px' }}>
                  🟡 {proximos.length} devolução(ões) nos próximos 7 dias
                </div>
                {proximos.map(e => (
                  <div key={e.id} style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
                    <strong>{e.patrimonio?.name}</strong> — {e.responsible_person} · devolver até {new Date(e.expected_return_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Cards resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', borderTop: '2px solid var(--brand)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>Total de bens</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-1)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>{items.length}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', borderTop: '2px solid var(--ok)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>Valor de aquisição</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--ok)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>R$ {totalAquisicao.toFixed(2)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', borderTop: '2px solid var(--low)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>Valor atual (depreciado)</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--low)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>R$ {totalAtual.toFixed(2)}</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar bem..." style={{ flex: 1, minWidth: '180px' }}/>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ minWidth: '140px' }}>
          <option value="all">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="em_manutencao">Em manutenção</option>
          <option value="emprestado">Emprestado</option>
          <option value="baixado">Baixado</option>
        </select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-3)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏛️</div>
          <div>{items.length === 0 ? 'Nenhum bem cadastrado ainda.' : 'Nenhum bem encontrado com os filtros.'}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {filtered.map(p => {
            const st = STATUS_CFG[p.status]
            return (
              <div key={p.id} onClick={() => setDetail(p)}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', cursor: 'pointer', transition: 'transform 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)', minWidth: 0 }}>{p.name}{p.quantity > 1 && <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '400' }}> ×{p.quantity}</span>}</div>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: st.bg, color: st.color, fontWeight: '600', flexShrink: 0, marginLeft: '8px' }}>{st.label}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {p.category && <span>📁 {p.category}</span>}
                  {p.ministry?.name && <span>👥 {p.ministry.name}</span>}
                  {p.physical_location && <span>📍 {p.physical_location}</span>}
                </div>
                {p.acquisition_value && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-3)' }}>Valor atual:</span>
                    <span style={{ color: 'var(--low)', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>R$ {valorAtual(p).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de cadastro */}
      {showModal && (
        <div ref={formRef} style={{ background: 'var(--bg-card)', border: '1px solid var(--brand)', borderRadius: 'var(--radius)', padding: '24px', marginTop: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '18px' }}>{editItem ? 'Editar bem' : 'Novo bem'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={L}>Nome *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Projetor Epson, Mesa de Som..."/>
            </div>
            <div><label style={L}>Categoria</label><input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Áudio, Vídeo, Mobiliário..."/></div>
            <div><label style={L}>Nº de série</label><input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}/></div>
            <div><label style={L}>Código de barras</label><input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}/></div>
            <div><label style={L}>Data de aquisição</label><input type="date" value={form.acquisition_date} onChange={e => setForm(f => ({ ...f, acquisition_date: e.target.value }))}/></div>
            <div><label style={L}>Valor de aquisição (R$)</label><input type="number" step="0.01" value={form.acquisition_value} onChange={e => setForm(f => ({ ...f, acquisition_value: e.target.value }))}/></div>
            <div><label style={L}>Vida útil (anos)</label><input type="number" value={form.useful_life_years} onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))}/></div>
            <div><label style={L}>Quantidade</label><input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}/></div>
            <div><label style={L}>Depreciação anual (%)</label><input type="number" step="0.1" value={form.depreciation_rate} onChange={e => setForm(f => ({ ...f, depreciation_rate: e.target.value }))}/></div>
            <div>
              <label style={L}>Depósito</label>
              <select value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div><label style={L}>Localização física</label><input value={form.physical_location} onChange={e => setForm(f => ({ ...f, physical_location: e.target.value }))} placeholder="Ex: Sala de som, Auditório..."/></div>
            <div><label style={L}>Fornecedor</label><input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Onde foi adquirido"/></div>
            <div><label style={L}>Chave da NF-e</label><input value={form.nfe_key} onChange={e => setForm(f => ({ ...f, nfe_key: e.target.value.replace(/\D/g, '').slice(0,44) }))} placeholder="44 dígitos" style={{ fontFamily:'var(--font-mono)', fontSize:'12px' }}/></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={L}>Foto / arquivo da nota fiscal</label>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                <input type="file" accept="image/*,.pdf,.xml" onChange={handleUploadNfe} style={{ fontSize:'12px' }}/>
                {uploading && <span style={{ fontSize:'12px', color:'var(--text-3)' }}>Enviando...</span>}
                {form.nfe_file_url && (
                  <>
                    <a href={form.nfe_file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:'12px', color:'var(--brand-light)' }}>✓ Ver arquivo</a>
                    <button type="button" onClick={() => setForm(f => ({ ...f, nfe_file_url: '' }))} style={{ fontSize:'12px', color:'var(--empty)', background:'none', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'6px', padding:'3px 10px', cursor:'pointer' }}>Remover arquivo</button>
                  </>
                )}
              </div>
            </div>
            <div>
              <label style={L}>Ministério responsável</label>
              <select value={form.ministry_id} onChange={e => setForm(f => ({ ...f, ministry_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {ministries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}><label style={L}>Observações</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/></div>
          </div>
          {formError && <div style={{ marginBottom: '12px', color: 'var(--empty)', fontSize: '13px' }}>{formError}</div>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowModal(false); setEditItem(null) }} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>{saving ? 'Salvando...' : editItem ? 'Atualizar' : 'Cadastrar'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente de detalhe (ficha do bem) ───────────────────────
function PatrimonioDetalhe({ item, ministries, onBack, onEdit, isAdmin, profile }: {
  item: Patrimonio; ministries: { id: string; name: string }[]; onBack: () => void; onEdit: (p: Patrimonio) => void; isAdmin: boolean; profile: any
}) {
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [showManut, setShowManut] = useState(false)
  const [showEmprestimo, setShowEmprestimo] = useState(false)
  const [mForm, setMForm] = useState({ date: '', description: '', cost: '', performed_by: '', next_maintenance_date: '' })
  const [eForm, setEForm] = useState({ responsible_person: '', expected_return_date: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [item.id])

  async function load() {
    const sb = createClient()
    const [{ data: manut }, { data: movs }] = await Promise.all([
      sb.from('patrimonio_manutencoes').select('*').eq('patrimonio_id', item.id).order('date', { ascending: false }),
      sb.from('patrimonio_movimentacoes').select('*,from_ministry:ministries!patrimonio_movimentacoes_from_ministry_id_fkey(name),to_ministry:ministries!patrimonio_movimentacoes_to_ministry_id_fkey(name)').eq('patrimonio_id', item.id).order('created_at', { ascending: false }),
    ])
    if (manut) setManutencoes(manut as Manutencao[])
    if (movs) setMovimentacoes(movs as Movimentacao[])
  }

  async function saveManutencao() {
    if (!mForm.date || !mForm.description) return
    setSaving(true)
    const sb = createClient()
    await sb.from('patrimonio_manutencoes').insert({
      patrimonio_id: item.id, church_id: profile.church_id,
      date: mForm.date, description: mForm.description,
      cost: mForm.cost ? parseFloat(mForm.cost) : null,
      performed_by: mForm.performed_by || null,
      next_maintenance_date: mForm.next_maintenance_date || null,
      created_by: profile.id,
    })
    setShowManut(false); setMForm({ date: '', description: '', cost: '', performed_by: '', next_maintenance_date: '' })
    await load(); setSaving(false)
  }

  async function saveEmprestimo() {
    if (!eForm.responsible_person) return
    setSaving(true)
    const sb = createClient()
    await sb.from('patrimonio_movimentacoes').insert({
      patrimonio_id: item.id, church_id: profile.church_id, type: 'emprestimo',
      responsible_person: eForm.responsible_person,
      expected_return_date: eForm.expected_return_date || null,
      notes: eForm.notes || null, created_by: profile.id,
    })
    await sb.from('patrimonio').update({ status: 'emprestado' }).eq('id', item.id)
    setShowEmprestimo(false); setEForm({ responsible_person: '', expected_return_date: '', notes: '' })
    await load(); setSaving(false)
  }

  async function devolverEmprestimo() {
    const sb = createClient()
    await sb.from('patrimonio_movimentacoes').insert({
      patrimonio_id: item.id, church_id: profile.church_id, type: 'devolucao',
      actual_return_date: new Date().toISOString().split('T')[0], created_by: profile.id,
    })
    await sb.from('patrimonio').update({ status: 'ativo' }).eq('id', item.id)
    await load()
  }

  const anos = item.acquisition_date ? ((Date.now() - new Date(item.acquisition_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : 0
  const qtd = item.quantity || 1
  const vUnitarioAtual = valorAtualUnitario(item)
  const vAtual = vUnitarioAtual * qtd
  const vAquisicaoTotal = (item.acquisition_value || 0) * qtd
  const depreciado = vAquisicaoTotal - vAtual

  return (
    <div>
      <button onClick={onBack} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>← Voltar</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600' }}>{item.name}</h1>
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '13px', color: 'var(--text-3)', flexWrap: 'wrap' }}>
            {item.category && <span>📁 {item.category}</span>}
            {item.ministry?.name && <span>👥 {item.ministry.name}</span>}
            {item.physical_location && <span>📍 {item.physical_location}</span>}
            <span style={{ padding: '0 8px', borderRadius: '99px', background: STATUS_CFG[item.status].bg, color: STATUS_CFG[item.status].color, fontWeight: '600' }}>{STATUS_CFG[item.status].label}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isAdmin && <button onClick={() => onEdit(item)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: 'pointer', fontSize: '13px' }}>Editar</button>}
          <button onClick={() => setShowManut(true)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: 'pointer', fontSize: '13px' }}>+ Manutenção</button>
          {item.status === 'emprestado' ? (
            <button onClick={devolverEmprestimo} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--ok)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Registrar devolução</button>
          ) : (
            <button onClick={() => setShowEmprestimo(true)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--info)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Emprestar</button>
          )}
        </div>
      </div>

      {/* Cards de valor */}
      {item.acquisition_value && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: '600' }}>Valor de aquisição</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--ok)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>R$ {vAquisicaoTotal.toFixed(2)}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
              {qtd > 1 ? `R$ ${item.acquisition_value.toFixed(2)} × ${qtd} un` : ''}
              {item.acquisition_date && (qtd > 1 ? ' · ' : '') + new Date(item.acquisition_date).toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: '600' }}>Valor atual</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--low)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>R$ {vAtual.toFixed(2)}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>{qtd > 1 ? `R$ ${vUnitarioAtual.toFixed(2)}/un · ` : ''}{anos.toFixed(1)} anos · {item.depreciation_rate}%/ano</div>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: '600' }}>Depreciação acumulada</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--empty)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>R$ {depreciado.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Informações adicionais */}
      {((item as any).supplier || (item as any).nfe_key || (item as any).nfe_file_url || item.serial_number) && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-2)' }}>Informações de aquisição</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '13px' }}>
            {(item as any).supplier && (
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '3px' }}>Fornecedor</div>
                <div style={{ color: 'var(--text-1)' }}>{(item as any).supplier}</div>
              </div>
            )}
            {item.serial_number && (
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '3px' }}>Nº de série</div>
                <div style={{ color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>{item.serial_number}</div>
              </div>
            )}
            {(item as any).nfe_key && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '3px' }}>Chave da NF-e</div>
                <div style={{ color: 'var(--text-1)', fontFamily: 'var(--font-mono)', fontSize: '11px', wordBreak: 'break-all' }}>{(item as any).nfe_key}</div>
              </div>
            )}
            {(item as any).nfe_file_url && (
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '3px' }}>Nota fiscal</div>
                <a href={(item as any).nfe_file_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--brand-light)', textDecoration: 'none', fontSize: '13px' }}>
                  📎 Ver arquivo da nota
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form manutenção */}
      {showManut && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--low)', borderRadius: 'var(--radius)', padding: '18px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '14px' }}>Registrar manutenção</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <div><label style={L}>Data *</label><input type="date" value={mForm.date} onChange={e => setMForm(f => ({ ...f, date: e.target.value }))}/></div>
            <div><label style={L}>Custo (R$)</label><input type="number" step="0.01" value={mForm.cost} onChange={e => setMForm(f => ({ ...f, cost: e.target.value }))}/></div>
            <div><label style={L}>Realizada por</label><input value={mForm.performed_by} onChange={e => setMForm(f => ({ ...f, performed_by: e.target.value }))}/></div>
            <div><label style={L}>Próxima manutenção</label><input type="date" value={mForm.next_maintenance_date} onChange={e => setMForm(f => ({ ...f, next_maintenance_date: e.target.value }))}/></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={L}>Descrição *</label><input value={mForm.description} onChange={e => setMForm(f => ({ ...f, description: e.target.value }))}/></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowManut(false)} style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
            <button onClick={saveManutencao} disabled={saving} style={{ padding: '7px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--low)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Salvar</button>
          </div>
        </div>
      )}

      {/* Form empréstimo */}
      {showEmprestimo && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--info)', borderRadius: 'var(--radius)', padding: '18px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '14px' }}>Registrar empréstimo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <div><label style={L}>Responsável *</label><input value={eForm.responsible_person} onChange={e => setEForm(f => ({ ...f, responsible_person: e.target.value }))} placeholder="Nome de quem está levando"/></div>
            <div><label style={L}>Devolução prevista</label><input type="date" value={eForm.expected_return_date} onChange={e => setEForm(f => ({ ...f, expected_return_date: e.target.value }))}/></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={L}>Observação</label><input value={eForm.notes} onChange={e => setEForm(f => ({ ...f, notes: e.target.value }))}/></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowEmprestimo(false)} style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
            <button onClick={saveEmprestimo} disabled={saving} style={{ padding: '7px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--info)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Registrar</button>
          </div>
        </div>
      )}

      {/* Histórico de manutenções */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Histórico de manutenções</h3>
        {manutencoes.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-3)', padding: '20px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>Nenhuma manutenção registrada</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {manutencoes.map(m => (
              <div key={m.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)' }}>{m.description}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                    {new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    {m.performed_by && ` · ${m.performed_by}`}
                    {m.next_maintenance_date && ` · próxima: ${new Date(m.next_maintenance_date + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                  </div>
                </div>
                {m.cost != null && <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--empty)', fontFamily: 'var(--font-mono)' }}>R$ {m.cost.toFixed(2)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico de movimentações */}
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>Histórico de movimentações</h3>
        {movimentacoes.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-3)', padding: '20px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>Nenhuma movimentação registrada</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {movimentacoes.map(mv => (
              <div key={mv.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)', textTransform: 'capitalize' }}>
                    {mv.type === 'emprestimo' ? '📤 Empréstimo' : mv.type === 'devolucao' ? '📥 Devolução' : mv.type}
                    {mv.responsible_person && ` — ${mv.responsible_person}`}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{new Date(mv.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                {mv.expected_return_date && <div style={{ fontSize: '11px', color: 'var(--low)', marginTop: '4px' }}>Devolução prevista: {new Date(mv.expected_return_date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>}
                {mv.notes && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{mv.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
