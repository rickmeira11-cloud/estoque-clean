'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

type NFeItem = {
  cEAN: string
  xProd: string
  qCom: number
  vUnCom: number
  uCom: string
  cProd: string
  matched?: { id: string; name: string } | null
  selectedProductId?: string
}

type NFeData = {
  supplier: string
  cnpj: string
  nNF: string
  dhEmi: string
  items: NFeItem[]
}

type Product = { id: string; name: string; barcode: string | null; unit: string | null }

const L: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: '500',
  color: 'var(--text-3)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em'
}

function parseNFe(xmlText: string): NFeData | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'application/xml')

    const get = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent || ''

    const supplier = get('xNome')
    const cnpj     = get('CNPJ')
    const nNF      = get('nNF')
    const dhEmi    = get('dhEmi')

    const detNodes = doc.getElementsByTagName('det')
    const items: NFeItem[] = []

    for (let i = 0; i < detNodes.length; i++) {
      const det  = detNodes[i]
      const prod = det.getElementsByTagName('prod')[0]
      if (!prod) continue

      const getText = (tag: string) => prod.getElementsByTagName(tag)[0]?.textContent || ''

      items.push({
        cEAN:   getText('cEAN'),
        xProd:  getText('xProd'),
        qCom:   parseFloat(getText('qCom')) || 0,
        vUnCom: parseFloat(getText('vUnCom')) || 0,
        uCom:   getText('uCom'),
        cProd:  getText('cProd'),
      })
    }

    return { supplier, cnpj, nNF, dhEmi, items }
  } catch {
    return null
  }
}

export default function NfePage() {
  const { profile } = useProfile()
  const [nfe,       setNfe]       = useState<NFeData | null>(null)
  const [products,  setProducts]  = useState<Product[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [locationId,setLocationId]= useState('')
  const [importing, setImporting] = useState(false)
  const [success,   setSuccess]   = useState('')
  const [error,     setError]     = useState('')
  const [chave,     setChave]     = useState('')
  const [loadingChave, setLoadingChave] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (profile?.church_id) loadBase() }, [profile?.church_id])

  async function loadBase() {
    const sb = createClient()
    const [{ data: prods }, { data: locs }] = await Promise.all([
      sb.from('products').select('id,name,barcode,unit').eq('church_id', profile!.church_id).eq('is_active', true).order('name'),
      sb.from('locations').select('id,name').eq('church_id', profile!.church_id).eq('is_active', true).order('name'),
    ])
    if (prods) setProducts(prods as Product[])
    if (locs)  setLocations(locs)
    if (locs && locs.length === 1) setLocationId(locs[0].id)
  }

  function matchItems(items: NFeItem[]): NFeItem[] {
    return items.map(item => {
      // Tentar casar por EAN primeiro
      if (item.cEAN && item.cEAN !== '0' && item.cEAN !== 'SEM GTIN') {
        const byEan = products.find(p => p.barcode === item.cEAN)
        if (byEan) return { ...item, matched: { id: byEan.id, name: byEan.name }, selectedProductId: byEan.id }
      }
      // Tentar casar por nome (normalizado)
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
      const byName = products.find(p => normalize(p.name) === normalize(item.xProd))
      if (byName) return { ...item, matched: { id: byName.id, name: byName.name }, selectedProductId: byName.id }
      // Tentar casar por nome parcial
      const byPartial = products.find(p =>
        normalize(item.xProd).includes(normalize(p.name)) ||
        normalize(p.name).includes(normalize(item.xProd).slice(0, 6))
      )
      if (byPartial) return { ...item, matched: { id: byPartial.id, name: byPartial.name }, selectedProductId: byPartial.id }
      return { ...item, matched: null, selectedProductId: '' }
    })
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseNFe(text)
      if (!parsed) { setError('XML inválido ou não é uma NF-e válida.'); return }
      parsed.items = matchItems(parsed.items)
      setNfe(parsed)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function fetchByChave() {
    if (chave.replace(/\D/g, '').length !== 44) { setError('Chave deve ter 44 dígitos'); return }
    setLoadingChave(true); setError('')
    try {
      // Tentar buscar XML via API da SEFAZ (ambiente nacional)
      const key = chave.replace(/\D/g, '')
      const res = await fetch(`/api/nfe?chave=${key}`)
      const data = await res.json()
      if (data.xml) {
        const parsed = parseNFe(data.xml)
        if (!parsed) { setError('Não foi possível processar o XML retornado.'); return }
        parsed.items = matchItems(parsed.items)
        setNfe(parsed)
      } else {
        setError(data.error || 'Não foi possível consultar a NF-e. Faça o upload do XML manualmente.')
      }
    } catch {
      setError('Erro ao consultar SEFAZ. Faça o upload do XML manualmente.')
    }
    setLoadingChave(false)
  }

  function updateItemProduct(idx: number, productId: string) {
    if (!nfe) return
    const prod = products.find(p => p.id === productId)
    const newItems = nfe.items.map((item, i) =>
      i === idx ? { ...item, selectedProductId: productId, matched: prod ? { id: prod.id, name: prod.name } : null } : item
    )
    setNfe({ ...nfe, items: newItems })
  }

  async function handleImport() {
    if (!nfe) return
    if (!locationId) { setError('Selecione o depósito de destino'); return }
    const toImport = nfe.items.filter(i => i.selectedProductId)
    if (toImport.length === 0) { setError('Nenhum produto selecionado para importar'); return }

    setImporting(true); setError('')
    const sb = createClient()
    const movements = toImport.map(item => ({
      church_id:   profile!.church_id,
      product_id:  item.selectedProductId!,
      type:        'in' as const,
      quantity:    Math.round(item.qCom),
      location_id: locationId,
      unit_cost:   item.vUnCom || null,
      supplier:    nfe.supplier || null,
      note:        `NF-e ${nfe.nNF} — ${item.xProd}`,
    }))

    const { error: err } = await sb.from('stock_movements').insert(movements)
    if (err) { setError(err.message); setImporting(false); return }

    setSuccess(`${toImport.length} item(s) importados com sucesso da NF-e ${nfe.nNF}!`)
    setNfe(null); setChave('')
    if (fileRef.current) fileRef.current.value = ''
    setImporting(false)
    setTimeout(() => setSuccess(''), 5000)
  }

  const matched   = nfe?.items.filter(i => i.matched) || []
  const unmatched = nfe?.items.filter(i => !i.matched) || []
  const selected  = nfe?.items.filter(i => i.selectedProductId) || []

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em' }}>Importar NF-e</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>
          Importe notas fiscais para lançar entradas automaticamente
        </p>
      </div>

      {success && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', background: 'var(--ok-dim)', color: 'var(--ok)', fontSize: '13px', fontWeight: '500' }}>
          ✓ {success}
        </div>
      )}
      {error && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', background: 'var(--empty-dim)', color: 'var(--empty)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {!nfe && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Upload XML */}
          <div style={{ background: 'var(--bg-card)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '32px', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📄</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)', marginBottom: '6px' }}>Upload do XML</div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '16px' }}>Arraste ou clique para selecionar o arquivo .xml da NF-e</div>
            <button style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
              Selecionar arquivo
            </button>
            <input ref={fileRef} type="file" accept=".xml" style={{ display: 'none' }} onChange={handleFile}/>
          </div>

          {/* Chave da nota */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '32px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px', textAlign: 'center' }}>🔑</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)', marginBottom: '6px', textAlign: 'center' }}>Chave da NF-e</div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '16px', textAlign: 'center' }}>Digite os 44 dígitos da chave de acesso</div>
            <input value={chave} onChange={e => setChave(e.target.value.replace(/\D/g, '').slice(0, 44))}
              placeholder="00000000000000000000000000000000000000000000"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.05em', marginBottom: '10px' }}/>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '12px', textAlign: 'center' }}>
              {chave.length}/44 dígitos
            </div>
            <button onClick={fetchByChave} disabled={chave.length !== 44 || loadingChave}
              style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: chave.length === 44 ? 'var(--brand)' : 'var(--bg-3)', color: chave.length === 44 ? '#fff' : 'var(--text-3)', border: 'none', cursor: chave.length === 44 ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: '500' }}>
              {loadingChave ? 'Consultando SEFAZ...' : 'Consultar NF-e'}
            </button>
          </div>
        </div>
      )}

      {nfe && (
        <div>
          {/* Info da NF-e */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '3px solid var(--brand)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)' }}>{nfe.supplier}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '3px' }}>
                CNPJ: {nfe.cnpj} · NF-e nº {nfe.nNF}
                {nfe.dhEmi && ` · ${new Date(nfe.dhEmi).toLocaleDateString('pt-BR')}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ padding: '3px 10px', borderRadius: '99px', background: 'var(--ok-dim)', color: 'var(--ok)', fontSize: '11px', fontWeight: '600' }}>
                {matched.length} casados
              </span>
              {unmatched.length > 0 && (
                <span style={{ padding: '3px 10px', borderRadius: '99px', background: 'var(--low-dim)', color: 'var(--low)', fontSize: '11px', fontWeight: '600' }}>
                  {unmatched.length} não casados
                </span>
              )}
              <button onClick={() => { setNfe(null); if (fileRef.current) fileRef.current.value = '' }}
                style={{ padding: '5px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '12px' }}>
                Cancelar
              </button>
            </div>
          </div>

          {/* Deposito */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={L}>Depósito de destino *</label>
              <select value={locationId} onChange={e => setLocationId(e.target.value)}>
                <option value="">Selecione o depósito...</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>
              <strong style={{ color: 'var(--ok)' }}>{selected.length}</strong> item(s) serão importados
            </div>
            <button onClick={handleImport} disabled={importing || !locationId || selected.length === 0}
              style={{ padding: '10px 24px', borderRadius: 'var(--radius-sm)', background: selected.length > 0 && locationId ? 'var(--ok)' : 'var(--bg-3)', color: selected.length > 0 && locationId ? '#fff' : 'var(--text-3)', border: 'none', cursor: selected.length > 0 && locationId ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: '600' }}>
              {importing ? 'Importando...' : `✓ Importar ${selected.length} item(s)`}
            </button>
          </div>

          {/* Tabela de itens */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-3)' }}>
                  {['Produto na NF-e', 'EAN', 'Qtd', 'Valor unit.', 'Total', 'Produto no Gestoque', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nfe.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: item.selectedProductId ? 'rgba(34,197,94,0.03)' : 'rgba(239,68,68,0.03)' }}>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-1)', maxWidth: '180px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.xProd}>{item.xProd}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      {item.cEAN && item.cEAN !== '0' && item.cEAN !== 'SEM GTIN' ? item.cEAN : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '600', color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
                      {item.qCom} {item.uCom}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--ok)', fontFamily: 'var(--font-mono)' }}>
                      R$ {item.vUnCom.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: 'var(--brand-light)', fontFamily: 'var(--font-mono)' }}>
                      R$ {(item.qCom * item.vUnCom).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 12px', minWidth: '200px' }}>
                      <select value={item.selectedProductId || ''} onChange={e => updateItemProduct(idx, e.target.value)}
                        style={{ fontSize: '12px', padding: '4px 8px' }}>
                        <option value="">— Ignorar item —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {item.selectedProductId ? (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'var(--ok-dim)', color: 'var(--ok)', fontWeight: '600' }}>
                          {item.matched ? '✓ Auto' : '✓ Manual'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'var(--low-dim)', color: 'var(--low)', fontWeight: '600' }}>
                          Ignorado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-3)' }}>
                  <td colSpan={4} style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: 'var(--text-2)' }}>
                    Total da nota ({nfe.items.length} itens)
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '700', color: 'var(--brand-light)', fontFamily: 'var(--font-mono)' }}>
                    R$ {nfe.items.reduce((s, i) => s + i.qCom * i.vUnCom, 0).toFixed(2)}
                  </td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
