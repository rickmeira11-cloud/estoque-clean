'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { mapRowPlanilha } from '@/lib/patrimonio-planilha'

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

// Formatar valor no padrao brasileiro: R$ 1.000,00
function fmtBRL(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return 'R$ 0,00'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
  const [viewMode, setViewMode] = useState<'cards' | 'lista'>(() => {
    if (typeof window === 'undefined') return 'cards'
    try { return localStorage.getItem('patrimonio_view') === 'lista' ? 'lista' : 'cards' } catch { return 'cards' }
  })
  const [detail,     setDetail]     = useState<Patrimonio | null>(null)
  const [returnToDetailId, setReturnToDetailId] = useState<string | null>(null)
  const [emprestimos, setEmprestimos] = useState<any[]>([])
  const [importPreview, setImportPreview] = useState<any[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [pendingChanges, setPendingChanges] = useState<any[]>([])
  const [showPending, setShowPending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)

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

    // Carregar propostas de alteração pendentes (sync planilha)
    const { data: pend } = await sb
      .from('patrimonio_pending_changes')
      .select('*')
      .eq('church_id', profile!.church_id)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
    setPendingChanges(pend || [])

    setLoading(false)
    return (pats as Patrimonio[]) || []
  }

  function openNew() {
    setEditItem(null); setForm(blank); setFormError(null); setShowModal(true)
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
      try { await sb.from('audit_log').insert({ church_id: profile!.church_id, action: 'update_patrimonio', entity: 'patrimonio', description: 'Editou ' + payload.name }) } catch (_) {}
    } else {
      const { error } = await sb.from('patrimonio').insert(payload)
      if (error) { setFormError(error.message); setSaving(false); return }
      setSuccess('Bem cadastrado!')
    }

    setShowModal(false); setForm(blank); setEditItem(null)
    setTimeout(() => setSuccess(''), 3000)
    const items2 = await loadBase()
    if (returnToDetailId) {
      const reopened = (items2 || []).find((x: Patrimonio) => x.id === returnToDetailId)
      if (reopened) setDetail(reopened)
      setReturnToDetailId(null)
    }
    setSaving(false)
  }

  async function handleDelete(p: Patrimonio) {
    if (!confirm(`Excluir "${p.name}" do patrimônio?`)) return
    await createClient().from('patrimonio').update({ is_active: false }).eq('id', p.id)
    setSuccess('Bem removido!')
    setTimeout(() => setSuccess(''), 3000)
    await loadBase()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportMsg('')
    const Papa = (await import('papaparse')).default
    const text = await file.text()
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })

    // Mapear colunas da planilha (mesmo parser usado pelo sync — lib/patrimonio-planilha)
    const rows = (parsed.data as any[])
      .map(mapRowPlanilha)
      .filter(r => r.external_id && r.name) // ignorar linhas sem ID ou nome

    // Mapa de items existentes por external_id
    const byExternalId = new Map(items.filter(i => (i as any).external_id).map(i => [(i as any).external_id, i]))
    // Mapa por Nome+Modelo (normalizado) para detectar possiveis duplicatas
    const normalize = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
    const byNomeModelo = new Map<string, any>()
    items.forEach(i => {
      const key = normalize(i.name) + '|' + normalize(i.description || '')
      byNomeModelo.set(key, i)
    })

    const preview = rows.map(r => {
      // 1. Se external_id ja existe -> atualizar
      if (byExternalId.has(r.external_id)) {
        return { ...r, action: 'atualizar', warning: false, selected: true }
      }
      // 2. Se nao existe por ID mas existe Nome+Modelo igual -> possivel duplicata
      const keyNM = normalize(r.name) + '|' + normalize(r.description || '')
      if (byNomeModelo.has(keyNM)) {
        return { ...r, action: 'criar', warning: true, selected: false } // desmarcado por padrao
      }
      // 3. Novo item limpo
      return { ...r, action: 'criar', warning: false, selected: true }
    })

    setImportPreview(preview)
    e.target.value = ''
  }

  async function confirmImport() {
    if (!importPreview) return
    setImporting(true)
    const sb = createClient()
    let criados = 0, atualizados = 0

    for (const row of importPreview.filter((r: any) => r.selected)) {
      const payload = {
        church_id:         profile!.church_id,
        external_id:       row.external_id,
        name:              row.name,
        quantity:          row.quantity,
        description:       row.description || null,
        serial_number:     row.serial_number || null,
        barcode:           row.barcode || null,
        acquisition_date:  row.acquisition_date,
        acquisition_value: row.acquisition_value,
        useful_life_years: row.useful_life_years,
        depreciation_rate: row.depreciation_rate,
        nfe_key:           row.nfe_key || null,
        supplier:          row.supplier || null,
      }

      if (row.action === 'atualizar') {
        const existing = items.find(i => (i as any).external_id === row.external_id)
        if (existing) {
          await sb.from('patrimonio').update(payload).eq('id', existing.id)
          atualizados++
        }
      } else {
        await sb.from('patrimonio').insert(payload)
        criados++
      }
    }

    setImportMsg(criados + ' criado(s), ' + atualizados + ' atualizado(s)')
    setImportPreview(null)
    setImporting(false)
    await loadBase()
    setTimeout(() => setImportMsg(''), 5000)
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
        'Valor unit.': vUnit ? fmtBRL(vUnit) : '—',
        'Valor aquisição total': vAquisTotal ? fmtBRL(vAquisTotal) : '—',
        'Anos de uso': anos.toFixed(1),
        'Taxa depreciação': p.depreciation_rate + '%',
        'Valor atual': fmtBRL(vAtualTotal),
        'Depreciação acumulada': fmtBRL(vAquisTotal - vAtualTotal),
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
    doc.text('Valor total de aquisição: ' + fmtBRL(totalAq) + '  ·  Valor atual: ' + fmtBRL(totalAt) + '  ·  Depreciação: ' + fmtBRL(totalAq-totalAt), 14, 26)

    const head = [['Bem','Categoria','Qtd','Aquisição','Valor aquis.','Anos','Taxa','Valor atual','Depreciado']]
    const body = items.map(p => {
      const vAquisTotal = valorAquisicaoTotal(p)
      const vAtualTotal = valorAtual(p)
      const anos = p.acquisition_date ? ((Date.now() - new Date(p.acquisition_date).getTime()) / (1000*60*60*24*365.25)) : 0
      return [
        p.name, p.category || '—', p.quantity || 1,
        p.acquisition_date ? new Date(p.acquisition_date).toLocaleDateString('pt-BR') : '—',
        fmtBRL(vAquisTotal), anos.toFixed(1), p.depreciation_rate + '%',
        fmtBRL(vAtualTotal), fmtBRL(vAquisTotal - vAtualTotal),
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

  // ── Sync com a planilha (propostas de alteração) ──
  async function verificarPlanilha() {
    setSyncing(true); setSyncMsg('')
    try {
      const res = await fetch('/api/patrimonio/sync-planilha', { method: 'POST' })
      const json = await res.json()
      if (!json.ok) {
        setSyncMsg('Erro: ' + (json.error || 'falha na verificação'))
      } else {
        setSyncMsg(json.novas + ' nova(s), ' + json.atualizadas + ' atualizada(s) · ' + json.total_pendentes + ' pendente(s)')
        await loadBase()
        if (json.total_pendentes > 0) setShowPending(true)
      }
    } catch (e: any) {
      setSyncMsg('Erro: ' + e.message)
    }
    setSyncing(false)
    setTimeout(() => setSyncMsg(''), 6000)
  }

  // Aplica a proposta no Gestoque (insert/update em patrimonio). Não mexe no status.
  async function aplicarNoGestoque(prop: any, sb: any) {
    const pd = prop.proposed_data || {}
    if (prop.change_type === 'criar') {
      const extId = pd.external_id || prop.external_id
      const dados = {
        name:              pd.name,
        quantity:          pd.quantity ?? 1,
        description:       pd.description ?? null,
        serial_number:     pd.serial_number ?? null,
        barcode:           pd.barcode ?? null,
        acquisition_date:  pd.acquisition_date ?? null,
        acquisition_value: pd.acquisition_value ?? null,
        useful_life_years: pd.useful_life_years ?? 5,
        depreciation_rate: pd.depreciation_rate ?? 20,
        nfe_key:           pd.nfe_key ?? null,
        supplier:          pd.supplier ?? null,
        ministry_id:       pd.ministry_id ?? null,
      }
      // Idempotência: se já existe um bem ativo com esse external_id, atualiza em vez de duplicar.
      let existingId: string | null = null
      if (extId) {
        const { data: ex } = await sb.from('patrimonio')
          .select('id')
          .eq('church_id', profile!.church_id)
          .eq('external_id', extId)
          .eq('is_active', true)
          .maybeSingle()
        existingId = ex?.id || null
      }
      if (existingId) {
        await sb.from('patrimonio').update(dados).eq('id', existingId)
      } else {
        await sb.from('patrimonio').insert({ church_id: profile!.church_id, external_id: extId, ...dados })
      }
    } else if (prop.change_type === 'atualizar' && prop.patrimonio_id) {
      const upd: any = {}
      for (const f of (prop.diff_fields || [])) upd[f] = pd[f] ?? null
      await sb.from('patrimonio').update(upd).eq('id', prop.patrimonio_id)
    }
    // 'sumiu_planilha': nada em patrimonio — só resolve o status depois
  }

  async function aprovarProposta(prop: any) {
    setResolvingId(prop.id)
    const sb = createClient()
    await aplicarNoGestoque(prop, sb)
    await sb.from('patrimonio_pending_changes')
      .update({ status: 'aprovado', resolved_at: new Date().toISOString(), resolved_by: profile!.id })
      .eq('id', prop.id)
    setResolvingId(null)
    await loadBase()
  }

  async function rejeitarProposta(prop: any) {
    setResolvingId(prop.id)
    const sb = createClient()
    await sb.from('patrimonio_pending_changes')
      .update({ status: 'rejeitado', resolved_at: new Date().toISOString(), resolved_by: profile!.id })
      .eq('id', prop.id)
    setResolvingId(null)
    await loadBase()
  }

  // ── Ações em massa ──
  async function aprovarEmLote(props: any[]) {
    if (props.length === 0) return
    const sb = createClient()
    setBulkProgress({ done: 0, total: props.length })
    const ids: string[] = []
    for (let i = 0; i < props.length; i++) {
      await aplicarNoGestoque(props[i], sb)
      ids.push(props[i].id)
      setBulkProgress({ done: i + 1, total: props.length })
    }
    // Marca o status de todas em uma única query
    await sb.from('patrimonio_pending_changes')
      .update({ status: 'aprovado', resolved_at: new Date().toISOString(), resolved_by: profile!.id })
      .in('id', ids)
    setBulkProgress(null)
    setSelectedIds(new Set())
    await loadBase()
  }

  async function rejeitarEmLote(props: any[]) {
    if (props.length === 0) return
    const sb = createClient()
    setBulkProgress({ done: props.length, total: props.length })
    await sb.from('patrimonio_pending_changes')
      .update({ status: 'rejeitado', resolved_at: new Date().toISOString(), resolved_by: profile!.id })
      .in('id', props.map(p => p.id))
    setBulkProgress(null)
    setSelectedIds(new Set())
    await loadBase()
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    setSelectedIds(prev => prev.size === pendingChanges.length ? new Set() : new Set(pendingChanges.map(p => p.id)))
  }

  const CAMPO_LABEL: Record<string, string> = {
    name: 'Nome', quantity: 'Quantidade', description: 'Descrição', serial_number: 'Nº de série',
    barcode: 'Cód. de barras', acquisition_date: 'Data de aquisição', acquisition_value: 'Valor',
    useful_life_years: 'Vida útil', depreciation_rate: 'Depreciação anual', nfe_key: 'Nº da NF',
    supplier: 'Fornecedor', ministry_id: 'Ministério',
  }

  function displayCampo(f: string, v: any): string {
    if (v === null || v === undefined || v === '') return '—'
    if (f === 'acquisition_value') return fmtBRL(Number(v))
    if (f === 'acquisition_date') return new Date(v + 'T12:00:00').toLocaleDateString('pt-BR')
    if (f === 'depreciation_rate') return v + '%'
    if (f === 'ministry_id') { const m = ministries.find(x => x.id === v); return m ? m.name : String(v) }
    return String(v)
  }

  function changeView(v: 'cards' | 'lista') {
    setViewMode(v)
    try { localStorage.setItem('patrimonio_view', v) } catch {}
  }

  const filtered = items.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalAquisicao = items.reduce((s, p) => s + valorAquisicaoTotal(p), 0)
  const totalAtual = items.reduce((s, p) => s + valorAtual(p), 0)

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>

  return (
    <div>
      {detail ? (
        <PatrimonioDetalhe item={detail} ministries={ministries} onBack={() => { setDetail(null); loadBase() }} onEdit={(p) => { setReturnToDetailId(p.id); openEdit(p) }} isAdmin={isAdmin} profile={profile}/>
      ) : (
      <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em' }}>Patrimônio</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>Gestão de bens imobilizados</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {pendingChanges.length > 0 && (
            <button onClick={() => setShowPending(true)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--low-dim)', border: '1px solid var(--low)', color: 'var(--low)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              🔔 Mudanças pendentes ({pendingChanges.length})
            </button>
          )}
          {isAdmin && (
            <button onClick={verificarPlanilha} disabled={syncing} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: 'pointer', fontSize: '13px' }}>
              {syncing ? 'Verificando...' : '🔄 Verificar planilha agora'}
            </button>
          )}
          {isAdmin && (
            <label style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: 'pointer', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              📥 Importar planilha
              <input type="file" accept=".csv" onChange={handleImportFile} style={{ display: 'none' }}/>
            </label>
          )}
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

      {syncMsg && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '8px', background: 'var(--bg-3)', color: 'var(--text-2)', fontSize: '13px' }}>
          {syncMsg}
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
          <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--ok)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>{fmtBRL(totalAquisicao)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', borderTop: '2px solid var(--low)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>Valor atual (depreciado)</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--low)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>{fmtBRL(totalAtual)}</div>
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
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          <button onClick={() => changeView('cards')} style={{ padding: '8px 12px', background: viewMode === 'cards' ? 'var(--brand)' : 'transparent', color: viewMode === 'cards' ? '#fff' : 'var(--text-2)', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Cards</button>
          <button onClick={() => changeView('lista')} style={{ padding: '8px 12px', background: viewMode === 'lista' ? 'var(--brand)' : 'transparent', color: viewMode === 'lista' ? '#fff' : 'var(--text-2)', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Lista</button>
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-3)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏛️</div>
          <div>{items.length === 0 ? 'Nenhum bem cadastrado ainda.' : 'Nenhum bem encontrado com os filtros.'}</div>
        </div>
      ) : viewMode === 'lista' ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-3)' }}>
                {['Nome', 'Categoria', 'Ministério', 'Status', 'Valor atual', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: i === 4 ? 'right' : 'left', fontSize: '10px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const st = STATUS_CFG[p.status]
                return (
                  <tr key={p.id} onClick={() => setDetail(p)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px', fontWeight: '500', color: 'var(--text-1)' }}>{p.name}{p.quantity > 1 && <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '400' }}> ×{p.quantity}</span>}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-2)' }}>{p.category || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-2)' }}>{p.ministry?.name || '—'}</td>
                    <td style={{ padding: '10px 14px' }}><span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: st.bg, color: st.color, fontWeight: '600', whiteSpace: 'nowrap' }}>{st.label}</span></td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--low)', fontWeight: '600', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{p.acquisition_value ? fmtBRL(valorAtual(p)) : '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-3)' }}>›</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
                    <span style={{ color: 'var(--low)', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{fmtBRL(valorAtual(p))}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de preview da importacao */}
      {importPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '24px', maxWidth: '900px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Prévia da importação</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '99px', background: 'var(--ok-dim)', color: 'var(--ok)', fontWeight: '600' }}>{importPreview.filter(r => r.action === 'criar' && r.selected).length} novos</span>
                <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '99px', background: 'var(--low-dim)', color: 'var(--low)', fontWeight: '600' }}>{importPreview.filter(r => r.action === 'atualizar' && r.selected).length} atualizações</span>
                {importPreview.some(r => r.warning) && <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '99px', background: 'rgba(245,158,11,0.15)', color: 'var(--low)', fontWeight: '600' }}>⚠️ {importPreview.filter(r => r.warning).length} possíveis duplicatas</span>}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-3)', position: 'sticky', top: 0 }}>
                    {['', 'ID', 'Nome', 'Modelo', 'Qtd', 'Valor', 'Ação'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: r.warning ? 'rgba(245,158,11,0.06)' : 'transparent' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="checkbox" checked={r.selected} onChange={() => {
                          setImportPreview(prev => prev!.map((x, xi) => xi === i ? { ...x, selected: !x.selected } : x))
                        }}/>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{r.external_id}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-1)' }}>
                        {r.name}
                        {r.warning && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--low)' }}>⚠️ já existe similar</span>}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-3)', fontSize: '11px' }}>{r.description || '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{r.quantity}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--ok)' }}>{r.acquisition_value ? fmtBRL(r.acquisition_value) : '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: r.action === 'criar' ? 'var(--ok-dim)' : 'var(--low-dim)', color: r.action === 'criar' ? 'var(--ok)' : 'var(--low)', fontWeight: '600' }}>
                          {r.action === 'criar' ? 'Novo' : 'Atualizar'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setImportPreview(null)} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
              <button onClick={confirmImport} disabled={importing} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                {importing ? 'Importando...' : 'Confirmar ' + importPreview.filter(r => r.selected).length + ' selecionado(s)'}
              </button>
            </div>
          </div>
        </div>
      )}

      </>
      )}

      {/* Modal de cadastro/edição — overlay flutuante, aparece sobre a lista ou a ficha */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--brand)', borderRadius: 'var(--radius)', padding: '24px', maxWidth: '760px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
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
            <button onClick={() => { setShowModal(false); setEditItem(null); if (returnToDetailId) { const r = items.find(x => x.id === returnToDetailId); if (r) setDetail(r); setReturnToDetailId(null) } }} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>{saving ? 'Salvando...' : editItem ? 'Atualizar' : 'Cadastrar'}</button>
          </div>
        </div>
        </div>
      )}

      {/* Modal de propostas de alteração da planilha — overlay, aparece sobre lista ou ficha */}
      {showPending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '24px', maxWidth: '760px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Mudanças pendentes da planilha ({pendingChanges.length})</h3>
              <button onClick={() => setShowPending(false)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px' }}>Fechar</button>
            </div>
            {pendingChanges.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>Nenhuma mudança pendente. 🎉</div>
            ) : (
              <>
              {/* Barra de ações em massa */}
              {isAdmin && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-2)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedIds.size === pendingChanges.length && pendingChanges.length > 0} onChange={toggleSelectAll} disabled={!!bulkProgress}/>
                    Selecionar todas
                  </label>
                  {selectedIds.size > 0 && <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{selectedIds.size} selecionada(s)</span>}
                  <div style={{ flex: 1 }}/>
                  {bulkProgress ? (
                    <span style={{ fontSize: '13px', color: 'var(--low)', fontWeight: '600' }}>Aplicando {bulkProgress.done}/{bulkProgress.total}...</span>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button onClick={() => { if (confirm('Aprovar as ' + selectedIds.size + ' propostas selecionadas?')) aprovarEmLote(pendingChanges.filter(p => selectedIds.has(p.id))) }} disabled={selectedIds.size === 0} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: selectedIds.size === 0 ? 'var(--bg-3)' : 'var(--brand)', color: selectedIds.size === 0 ? 'var(--text-3)' : '#fff', border: 'none', cursor: selectedIds.size === 0 ? 'default' : 'pointer', fontSize: '12px', fontWeight: '500' }}>Aprovar selecionadas</button>
                      <button onClick={() => { if (confirm('Rejeitar as ' + selectedIds.size + ' propostas selecionadas?')) rejeitarEmLote(pendingChanges.filter(p => selectedIds.has(p.id))) }} disabled={selectedIds.size === 0} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--border)', color: selectedIds.size === 0 ? 'var(--text-3)' : 'var(--text-2)', cursor: selectedIds.size === 0 ? 'default' : 'pointer', fontSize: '12px' }}>Rejeitar selecionadas</button>
                      <button onClick={() => { if (confirm('Aprovar TODAS as ' + pendingChanges.length + ' propostas pendentes?')) aprovarEmLote(pendingChanges) }} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--ok-dim)', color: 'var(--ok)', border: '1px solid var(--ok)', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Aprovar todas</button>
                      <button onClick={() => { if (confirm('Rejeitar TODAS as ' + pendingChanges.length + ' propostas pendentes?')) rejeitarEmLote(pendingChanges) }} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--empty-dim)', color: 'var(--empty)', border: '1px solid var(--empty)', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Rejeitar todas</button>
                    </div>
                  )}
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingChanges.map((prop) => {
                  const pd = prop.proposed_data || {}
                  const cd = prop.current_data || {}
                  const cfg = prop.change_type === 'criar'
                    ? { label: 'Novo item', color: 'var(--ok)', bg: 'var(--ok-dim)' }
                    : prop.change_type === 'atualizar'
                    ? { label: 'Atualização', color: 'var(--low)', bg: 'var(--low-dim)' }
                    : { label: 'Sumiu da planilha', color: 'var(--empty)', bg: 'var(--empty-dim)' }
                  return (
                    <div key={prop.id} style={{ border: '1px solid ' + (selectedIds.has(prop.id) ? 'var(--brand)' : 'var(--border)'), borderRadius: 'var(--radius)', padding: '14px', background: 'var(--bg-card)' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
                        {isAdmin && (
                          <input type="checkbox" checked={selectedIds.has(prop.id)} onChange={() => toggleSelected(prop.id)} disabled={!!bulkProgress} style={{ marginTop: '3px' }}/>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: cfg.bg, color: cfg.color, fontWeight: '600' }}>{cfg.label}</span>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)', marginTop: '6px' }}>{pd.name || cd.name || '—'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>ID {prop.external_id}</div>
                        </div>
                      </div>

                      {prop.change_type === 'criar' && (
                        <div style={{ fontSize: '12px', color: 'var(--text-2)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px' }}>
                          <div><span style={{ color: 'var(--text-3)' }}>Qtd:</span> {pd.quantity ?? 1}</div>
                          <div><span style={{ color: 'var(--text-3)' }}>Valor:</span> {displayCampo('acquisition_value', pd.acquisition_value)}</div>
                          <div><span style={{ color: 'var(--text-3)' }}>Ministério:</span> {displayCampo('ministry_id', pd.ministry_id)}</div>
                          {pd.description && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-3)' }}>Descrição:</span> {pd.description}</div>}
                        </div>
                      )}

                      {prop.change_type === 'atualizar' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(prop.diff_fields || []).map((f: string) => (
                            <div key={f} style={{ fontSize: '12px' }}>
                              <span style={{ color: 'var(--text-3)' }}>{CAMPO_LABEL[f] || f}:</span>{' '}
                              <span style={{ color: 'var(--empty)', textDecoration: 'line-through' }}>{displayCampo(f, cd[f])}</span>
                              {' → '}
                              <span style={{ color: 'var(--ok)', fontWeight: '600' }}>{displayCampo(f, pd[f])}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {prop.change_type === 'sumiu_planilha' && (
                        <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                          Este item existe no Gestoque mas <strong>sumiu da planilha</strong>. Aprovar apenas marca como revisado — nada é apagado ou inativado.
                        </div>
                      )}

                      {isAdmin && (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                          <button onClick={() => rejeitarProposta(prop)} disabled={resolvingId === prop.id || !!bulkProgress} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px' }}>Rejeitar</button>
                          <button onClick={() => aprovarProposta(prop)} disabled={resolvingId === prop.id || !!bulkProgress} style={{ padding: '6px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>{resolvingId === prop.id ? '...' : 'Aprovar'}</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              </>
            )}
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

  // Excluir = inativar (nunca delete físico) + registrar no audit_log
  async function excluirBem() {
    if (!confirm('Excluir "' + item.name + '" do patrimônio?')) return
    const sb = createClient()
    await sb.from('patrimonio').update({ is_active: false }).eq('id', item.id)
    try { await sb.from('audit_log').insert({ church_id: profile.church_id, action: 'deactivate_patrimonio', entity: 'patrimonio', description: 'Inativou ' + item.name + ' do patrimônio' }) } catch (_) {}
    onBack()
  }

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

  async function gerarTermo() {
    // Buscar o emprestimo ativo mais recente
    const empAtivo = movimentacoes.find(mv => mv.type === 'emprestimo')
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ format: 'a4' })
    const church = profile?.church?.name || 'Poiema'
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

    // Cabecalho
    doc.setFontSize(16); doc.setFont('helvetica','bold')
    doc.text('TERMO DE RESPONSABILIDADE', 105, 25, { align: 'center' })
    doc.setFontSize(11); doc.setFont('helvetica','normal')
    doc.text(church, 105, 33, { align: 'center' })
    doc.setDrawColor(200,200,200); doc.line(20, 38, 190, 38)

    // Corpo
    let y = 50
    doc.setFontSize(11)
    const responsavel = empAtivo?.responsible_person || '_______________________________'
    const devolucao = empAtivo?.expected_return_date ? new Date(empAtivo.expected_return_date + 'T12:00:00').toLocaleDateString('pt-BR') : '____/____/______'

    const texto = [
      'Eu, ' + responsavel + ', declaro ter recebido o(s)',
      'bem(ns) abaixo descrito(s), de propriedade de ' + church + ',',
      'comprometendo-me a zelar pela sua conservacao e a devolve-lo(s) na',
      'data acordada, em perfeitas condicoes de uso.',
    ]
    texto.forEach(linha => { doc.text(linha, 20, y); y += 7 })

    y += 8
    // Dados do bem
    doc.setFont('helvetica','bold'); doc.text('DADOS DO BEM', 20, y); y += 8
    doc.setFont('helvetica','normal')
    const dados = [
      ['Bem:', item.name],
      ['Categoria:', item.category || '-'],
      ['Quantidade:', String(item.quantity || 1)],
      ['Numero de serie:', item.serial_number || '-'],
      ['Valor de referencia:', item.acquisition_value ? fmtBRL(item.acquisition_value * (item.quantity||1)) : '-'],
      ['Data de emprestimo:', hoje],
      ['Devolucao prevista:', devolucao],
    ]
    dados.forEach(([label, val]) => {
      doc.setFont('helvetica','bold'); doc.text(label, 20, y)
      doc.setFont('helvetica','normal'); doc.text(String(val), 70, y)
      y += 7
    })

    // Assinaturas
    y += 25
    doc.line(25, y, 95, y)
    doc.line(115, y, 185, y)
    y += 6
    doc.setFontSize(9)
    doc.text('Responsavel pelo emprestimo', 30, y)
    doc.text('Responsavel pelo patrimonio', 120, y)

    y += 20
    doc.setFontSize(10)
    doc.text('Local e data: _________________________, ' + hoje, 20, y)

    doc.save('termo-responsabilidade-' + item.name.replace(/[^a-zA-Z0-9]/g,'-') + '.pdf')
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
          {isAdmin && <button onClick={excluirBem} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--empty-dim)', border: '1px solid var(--empty)', color: 'var(--empty)', cursor: 'pointer', fontSize: '13px' }}>Excluir</button>}
          <button onClick={() => setShowManut(true)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: 'pointer', fontSize: '13px' }}>+ Manutenção</button>
          {item.status === 'emprestado' ? (<>
            <button onClick={gerarTermo} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-1)', cursor: 'pointer', fontSize: '13px' }}>📄 Termo</button>
            <button onClick={devolverEmprestimo} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--ok)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Registrar devolução</button>
          </>) : (
            <button onClick={() => setShowEmprestimo(true)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--info)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Emprestar</button>
          )}
        </div>
      </div>

      {/* Cards de valor */}
      {item.acquisition_value && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: '600' }}>Valor de aquisição</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--ok)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>{fmtBRL(vAquisicaoTotal)}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
              {qtd > 1 ? `${fmtBRL(item.acquisition_value)} × ${qtd} un` : ''}
              {item.acquisition_date && (qtd > 1 ? ' · ' : '') + new Date(item.acquisition_date).toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: '600' }}>Valor atual</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--low)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>{fmtBRL(vAtual)}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>{qtd > 1 ? `${fmtBRL(vUnitarioAtual)}/un · ` : ''}{anos.toFixed(1)} anos · {item.depreciation_rate}%/ano</div>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: '600' }}>Depreciação acumulada</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--empty)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>{fmtBRL(depreciado)}</div>
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
                {m.cost != null && <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--empty)', fontFamily: 'var(--font-mono)' }}>{fmtBRL(m.cost)}</span>}
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
