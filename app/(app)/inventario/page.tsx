'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'

type Inventory = {
  id: string
  name: string
  status: 'open' | 'closed'
  opened_at: string
  closed_at: string | null
  notes: string | null
}

type InventoryItem = {
  id: string
  product_id: string
  location_id: string
  expected_qty: number
  counted_qty: number | null
  difference: number
  product: { name: string; category: string | null; unit: string | null }
  location: { name: string }
}

const L: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: '500',
  color: 'var(--text-3)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em'
}

export default function InventarioFisicoPage() {
  const { profile, isAdmin } = useProfile()
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [selected,    setSelected]    = useState<Inventory | null>(null)
  const [items,       setItems]       = useState<InventoryItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [newName,     setNewName]     = useState('')
  const [newNotes,    setNewNotes]    = useState('')
  const [filterLoc,   setFilterLoc]   = useState('all')
  const [locations,   setLocations]   = useState<{id:string,name:string}[]>([])
  const [scanMode,    setScanMode]    = useState(false)
  const [scanBarcode, setScanBarcode] = useState('')
  const [scanQty,     setScanQty]     = useState('1')
  const [scanMsg,     setScanMsg]     = useState('')
  const [scanError2,  setScanError2]  = useState('')
  const [scanning2,   setScanning2]   = useState(false)
  const videoRef2 = useRef<HTMLVideoElement>(null)
  const streamRef2 = useRef<MediaStream | null>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!profile?.church_id) return
    loadInventories()
  }, [profile?.church_id])


  async function startScannerInv() {
    setScanError2(''); setScanning2(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef2.current = stream
      if (videoRef2.current) {
        videoRef2.current.srcObject = stream
        videoRef2.current.play()
      }
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['ean_13','ean_8','code_128','code_39','qr_code'] })
        const scan = async () => {
          if (!videoRef2.current) return
          try {
            const codes = await detector.detect(videoRef2.current)
            if (codes.length > 0) {
              stopScannerInv()
              setScanBarcode(codes[0].rawValue)
              barcodeInputRef.current?.focus()
            } else { requestAnimationFrame(scan) }
          } catch { requestAnimationFrame(scan) }
        }
        videoRef2.current?.addEventListener('playing', () => requestAnimationFrame(scan))
      } else {
        setScanError2('BarcodeDetector não disponível. Digite o código manualmente.')
        stopScannerInv()
      }
    } catch (e: any) {
      setScanError2('Erro ao acessar câmera: ' + e.message)
      setScanning2(false)
    }
  }

  function stopScannerInv() {
    streamRef2.current?.getTracks().forEach(t => t.stop())
    streamRef2.current = null
    setScanning2(false)
  }

  async function submitScanCount() {
    if (!scanBarcode.trim()) { setScanError2('Informe o código de barras'); return }
    const qty = parseInt(scanQty)
    if (isNaN(qty) || qty < 0) { setScanError2('Quantidade inválida'); return }

    // Buscar produto pelo barcode
    const { data: prod } = await createClient()
      .from('products')
      .select('id,name')
      .eq('church_id', profile!.church_id)
      .eq('barcode', scanBarcode.trim())
      .single()

    if (!prod) { setScanError2('Produto não encontrado para o código: ' + scanBarcode); return }

    // Buscar item do inventario para este produto
    const matchItems = items.filter(i => i.product_id === prod.id)
    if (matchItems.length === 0) { setScanError2('Produto "' + prod.name + '" não está neste inventário'); return }

    // Se tem apenas um deposito, atualizar direto
    if (matchItems.length === 1) {
      await updateCount(matchItems[0].id, qty)
      setScanMsg(prod.name + ' — ' + qty + ' unidades registradas ✓')
      setScanBarcode(''); setScanQty('1'); setScanError2('')
      setTimeout(() => setScanMsg(''), 3000)
    } else {
      // Multiplos depositos — mostrar selecao
      setScanError2('Produto em ' + matchItems.length + ' depósitos. Use a tabela para informar.')
    }
  }

  async function loadInventories() {
    setLoading(true)
    const sb = createClient()
    const [{ data: invs }, { data: locs }] = await Promise.all([
      sb.from('physical_inventories')
        .select('*')
        .eq('church_id', profile!.church_id)
        .order('opened_at', { ascending: false }),
      sb.from('locations')
        .select('id,name')
        .eq('church_id', profile!.church_id)
        .eq('is_active', true)
        .order('name'),
    ])
    if (invs) setInventories(invs as Inventory[])
    if (locs) setLocations(locs)
    setLoading(false)
  }

  async function loadItems(invId: string) {
    const { data } = await createClient()
      .from('physical_inventory_items')
      .select('*,product:products(name,category,unit),location:locations(name)')
      .eq('inventory_id', invId)
      .order('location(name)', { ascending: true })
    if (data) setItems(data as InventoryItem[])
  }

  async function openInventory() {
    if (!newName.trim()) { setError('Informe um nome para o inventário'); return }
    setSaving(true); setError(null)
    const sb = createClient()

    // Criar inventario
    const { data: inv, error: invErr } = await sb
      .from('physical_inventories')
      .insert({
        church_id: profile!.church_id,
        name: newName.trim(),
        notes: newNotes || null,
        opened_by: profile!.id,
        status: 'open',
      })
      .select()
      .single()

    if (invErr || !inv) { setError(invErr?.message || 'Erro ao criar inventário'); setSaving(false); return }

    // Buscar saldo atual por produto/deposito via view
    const { data: balData } = await sb
      .from('product_location_balance')
      .select('product_id,location_id,location_quantity')
      .eq('church_id', profile!.church_id)

    if (balData && balData.length > 0) {
      const itemsToInsert = balData.map((b: any) => ({
        inventory_id: inv.id,
        product_id:   b.product_id,
        location_id:  b.location_id,
        expected_qty: b.location_quantity,
      }))
      await sb.from('physical_inventory_items').insert(itemsToInsert)
    }

    setShowNew(false); setNewName(''); setNewNotes('')
    await loadInventories()
    setSaving(false)
  }

  async function selectInventory(inv: Inventory) {
    setSelected(inv)
    await loadItems(inv.id)
  }

  async function updateCount(itemId: string, qty: number) {
    await createClient()
      .from('physical_inventory_items')
      .update({ counted_qty: qty, counted_by: profile!.id, counted_at: new Date().toISOString() })
      .eq('id', itemId)
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, counted_qty: qty, difference: qty - i.expected_qty } : i))
  }

  async function closeInventory() {
    if (!selected) return
    const uncounted = items.filter(i => i.counted_qty === null).length
    if (uncounted > 0 && !confirm(`${uncounted} item(s) não contado(s). Deseja fechar mesmo assim? Itens não contados serão ignorados.`)) return

    setSaving(true); setError(null)
    const sb = createClient()

    // Gerar ajustes para diferenças
    const diffs = items.filter(i => i.counted_qty !== null && i.difference !== 0)
    if (diffs.length > 0) {
      const adjustments = diffs.map(i => ({
        church_id:   profile!.church_id,
        product_id:  i.product_id,
        location_id: i.location_id,
        type:        'adjustment' as const,
        quantity:    Math.abs(i.difference),
        note:        `Ajuste inventário físico: ${i.difference > 0 ? '+' : ''}${i.difference} un`,
      }))
      // Para ajustes negativos, usar saída
      for (const adj of adjustments) {
        const diff = items.find(i => i.product_id === adj.product_id && i.location_id === adj.location_id)?.difference || 0
        if (diff < 0) {
          await sb.from('stock_movements').insert({ ...adj, type: 'out', quantity: Math.abs(diff) })
        } else {
          await sb.from('stock_movements').insert({ ...adj, type: 'in', quantity: diff })
        }
      }
    }

    // Fechar inventario
    await sb.from('physical_inventories')
      .update({ status: 'closed', closed_by: profile!.id, closed_at: new Date().toISOString() })
      .eq('id', selected.id)

    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
    setSelected(null); setItems([])
    await loadInventories()
    setSaving(false)
  }

  const filteredItems = filterLoc === 'all' ? items : items.filter(i => i.location.name === filterLoc)
  const totalDiffs = items.filter(i => i.counted_qty !== null && i.difference !== 0).length
  const totalCounted = items.filter(i => i.counted_qty !== null).length

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em' }}>Inventário Físico</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>Contagem e reconciliação de estoque</p>
        </div>
        {isAdmin && !selected && (
          <button onClick={() => setShowNew(true)} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
            + Novo inventário
          </button>
        )}
        {selected && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setSelected(null); setItems([]) }} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '13px' }}>
              ← Voltar
            </button>
            {selected.status === 'open' && (
              <button onClick={() => setScanMode(s => !s)} style={{ padding:'8px 16px', borderRadius:'var(--radius-sm)', background:scanMode?'var(--brand)':'var(--bg-3)', color:scanMode?'#fff':'var(--text-2)', border:'1px solid var(--border)', cursor:'pointer', fontSize:'13px', display:'flex', alignItems:'center', gap:'6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M21 9V5a2 2 0 00-2-2h-4M21 15v4a2 2 0 01-2 2h-4M7 12h10"/></svg>
                {scanMode ? 'Fechar scanner' : 'Modo scanner'}
              </button>
            )}
          {selected.status === 'open' && isAdmin && (
              <button onClick={closeInventory} disabled={saving} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--ok)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                {saving ? 'Fechando...' : 'Fechar inventário'}
              </button>
            )}
          </div>
        )}
      </div>

      {success && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', background: 'var(--ok-dim)', color: 'var(--ok)', fontSize: '13px', fontWeight: '500' }}>
          ✓ Inventário fechado! Ajustes aplicados ao estoque.
        </div>
      )}

      {error && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '8px', background: 'var(--empty-dim)', color: 'var(--empty)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Formulario novo inventario */}
      {showNew && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Novo inventário físico</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={L}>Nome *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Inventário Maio 2026"/>
            </div>
            <div>
              <label style={L}>Observações</label>
              <input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Opcional"/>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowNew(false); setNewName(''); setNewNotes('') }} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '13px' }}>
              Cancelar
            </button>
            <button onClick={openInventory} disabled={saving} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
              {saving ? 'Criando...' : 'Abrir inventário'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de inventarios */}
      {!selected && (
        <div>
          {inventories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-3)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
              <div style={{ fontSize: '14px' }}>Nenhum inventário físico realizado ainda.</div>
              {isAdmin && <div style={{ fontSize: '12px', marginTop: '6px' }}>Clique em "+ Novo inventário" para começar.</div>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {inventories.map(inv => (
                <div key={inv.id} onClick={() => selectInventory(inv)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderRadius: 'var(--radius)', background: 'var(--bg-card)', border: `1px solid ${inv.status === 'open' ? 'var(--brand)' : 'var(--border)'}`, cursor: 'pointer', transition: 'transform 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-1)' }}>{inv.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>
                      Aberto em {new Date(inv.opened_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {inv.closed_at && ` · Fechado em ${new Date(inv.closed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                    </div>
                    {inv.notes && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{inv.notes}</div>}
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '600',
                    background: inv.status === 'open' ? 'var(--brand-dim)' : 'var(--bg-3)',
                    color: inv.status === 'open' ? 'var(--brand-light)' : 'var(--text-3)' }}>
                    {inv.status === 'open' ? 'Em andamento' : 'Fechado'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contagem do inventario selecionado */}
      {selected && (
        <div>
          {/* Info + progresso */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-1)' }}>{selected.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '3px' }}>
                  {totalCounted} de {items.length} itens contados · {totalDiffs} diferença(s) encontrada(s)
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select value={filterLoc} onChange={e => setFilterLoc(e.target.value)} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text-1)', fontSize: '12px' }}>
                  <option value="all">Todos os depósitos</option>
                  {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
              </div>
            </div>
            {/* Barra de progresso */}
            <div style={{ marginTop: '12px', height: '4px', borderRadius: '99px', background: 'var(--bg-3)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '99px', background: 'var(--brand)', width: `${items.length > 0 ? (totalCounted / items.length) * 100 : 0}%`, transition: 'width 0.3s' }}/>
            </div>
          </div>

          {/* Painel modo scanner */}
          {scanMode && selected.status === 'open' && (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--brand)', borderRadius:'var(--radius)', padding:'16px', marginBottom:'16px' }}>
              <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--text-1)', marginBottom:'12px', display:'flex', alignItems:'center', gap:'8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-light)" strokeWidth="2"><path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M21 9V5a2 2 0 00-2-2h-4M21 15v4a2 2 0 01-2 2h-4M7 12h10"/></svg>
                Modo scanner — escaneie ou digite o código
              </div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'flex-end' }}>
                <div style={{ flex:'1', minWidth:'160px' }}>
                  <label style={L}>Código de barras</label>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <input ref={barcodeInputRef} value={scanBarcode} onChange={e => setScanBarcode(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submitScanCount()}
                      placeholder="Ex: 7891000100103" style={{ flex:1 }}/>
                    <button onClick={startScannerInv} style={{ padding:'0 12px', height:'38px', borderRadius:'var(--radius-sm)', background:'var(--bg-3)', border:'1px solid var(--border)', cursor:'pointer', color:'var(--text-2)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M21 9V5a2 2 0 00-2-2h-4M21 15v4a2 2 0 01-2 2h-4M7 12h10"/></svg>
                    </button>
                  </div>
                </div>
                <div style={{ width:'100px' }}>
                  <label style={L}>Quantidade</label>
                  <input type="number" min="0" value={scanQty} onChange={e => setScanQty(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitScanCount()}/>
                </div>
                <button onClick={submitScanCount} style={{ padding:'8px 18px', height:'38px', borderRadius:'var(--radius-sm)', background:'var(--brand)', color:'#fff', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'500', flexShrink:0 }}>
                  Registrar
                </button>
              </div>
              {scanMsg && <div style={{ marginTop:'10px', padding:'8px 12px', borderRadius:'8px', background:'var(--ok-dim)', color:'var(--ok)', fontSize:'13px' }}>{scanMsg}</div>}
              {scanError2 && <div style={{ marginTop:'10px', padding:'8px 12px', borderRadius:'8px', background:'var(--empty-dim)', color:'var(--empty)', fontSize:'13px' }}>{scanError2}</div>}
            </div>
          )}

          {/* Modal camera scanner inventario */}
          {scanning2 && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:500, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px' }}>
              <div style={{ fontSize:'14px', color:'#fff', fontWeight:'500' }}>Aponte para o código de barras</div>
              <video ref={videoRef2} style={{ width:'100%', maxWidth:'400px', borderRadius:'12px', border:'2px solid var(--brand)' }} muted playsInline/>
              <button onClick={stopScannerInv} style={{ padding:'10px 24px', borderRadius:'99px', background:'var(--empty)', color:'#fff', border:'none', cursor:'pointer', fontSize:'14px' }}>Cancelar</button>
            </div>
          )}

          {/* Tabela de contagem */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-3)' }}>
                  {['Produto', 'Categoria', 'Depósito', 'Esperado', 'Contado', 'Diferença'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: item.counted_qty !== null && item.difference !== 0 ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                    <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '500', color: 'var(--text-1)' }}>{item.product.name}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-3)' }}>{item.product.category || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-2)' }}>{item.location.name}</td>
                    <td style={{ padding: '10px 14px', fontSize: '14px', fontWeight: '600', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{item.expected_qty}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {selected.status === 'open' ? (
                        <input
                          type="number" min="0"
                          defaultValue={item.counted_qty ?? ''}
                          onBlur={e => {
                            const v = parseInt(e.target.value)
                            if (!isNaN(v) && v >= 0) updateCount(item.id, v)
                          }}
                          style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text-1)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                        />
                      ) : (
                        <span style={{ fontSize: '14px', fontWeight: '600', fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>{item.counted_qty ?? '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '14px', fontWeight: '700', fontFamily: 'var(--font-mono)',
                      color: item.counted_qty === null ? 'var(--text-3)' : item.difference === 0 ? 'var(--ok)' : item.difference > 0 ? 'var(--ok)' : 'var(--empty)' }}>
                      {item.counted_qty === null ? '—' : item.difference === 0 ? '✓' : `${item.difference > 0 ? '+' : ''}${item.difference}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
                Nenhum item encontrado.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
