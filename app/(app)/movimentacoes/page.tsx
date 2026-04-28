'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Product } from '@/types'

type MovType = 'in' | 'out' | 'adjustment' | 'transfer'
const CFG = {
  in:         { label:'Entrada',  color:'var(--ok)',    icon:'↑', desc:'Adicionar ao estoque' },
  out:        { label:'Saída',    color:'var(--empty)', icon:'↓', desc:'Retirar do estoque' },
  adjustment: { label:'Ajuste',   color:'var(--info)',   icon:'⇄', desc:'Corrigir quantidade' },
  transfer:   { label:'Transferir', color:'var(--brand-light)', icon:'⇌', desc:'Mover entre depósitos' },
}

export default function MovimentacoesPage() {
  const { profile } = useProfile()
  const [products,       setProducts]       = useState<Product[]>([])
  const [search,         setSearch]         = useState('')
  const [selected,       setSelected]       = useState<Product | null>(null)
  const [type,           setType]           = useState<MovType>('in')
  const [qty,            setQty]            = useState('')
  const [note,           setNote]           = useState('')
  const [locationId,     setLocationId]     = useState('')
  const [destLocationId, setDestLocationId] = useState('')
  const [locations,      setLocations]      = useState<{id:string,name:string}[]>([])
  const [saving,         setSaving]         = useState(false)
  const [success,        setSuccess]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.church_id) return
    load()
    createClient()
      .from('locations')
      .select('id,name')
      .eq('church_id', profile.church_id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { if (data) setLocations(data) })
  }, [profile?.church_id])

  async function load() {
    const { data } = await createClient()
      .from('products')
      .select('id,name,quantity,min_stock,category,type,container,unit,last_purchase_value,expiration_date,notes,is_active,created_at,updated_at')
      .eq('church_id', profile!.church_id)
      .eq('is_active', true)
      .order('name')
    if (data) setProducts(data as Product[])
  }

  async function handleSubmit() {
    if (!selected || !qty) return
    const n = parseInt(qty)
    if (isNaN(n) || n <= 0) { setError('Quantidade inválida'); return }
    if (type === 'out' && destLocationId && destLocationId === locationId) {
      setError('Depósito de origem e destino não podem ser iguais'); return
    }
    setSaving(true); setError(null)
    // Transferencia: valida origem e destino obrigatorios
    if (type === 'transfer') {
      if (!locationId) { setError('Selecione o depósito de origem'); setSaving(false); return }
      if (!destLocationId) { setError('Selecione o depósito de destino'); setSaving(false); return }
      if (locationId === destLocationId) { setError('Origem e destino não podem ser iguais'); setSaving(false); return }
    }

    const { error: err } = await createClient()
      .from('stock_movements')
      .insert({
        church_id:               profile!.church_id,
        product_id:              selected.id,
        user_id:                 profile!.id,
        type,
        quantity:                n,
        note:                    note || null,
        location_id:             locationId || null,
        destination_location_id: (type === 'out' || type === 'transfer') ? (destLocationId || null) : null,
      })
    if (err) { setError(err.message); setSaving(false); return }
    setSuccess(true)
    setQty(''); setNote(''); setLocationId(''); setDestLocationId('')
    setSelected(null); setSearch('')
    await load()
    setSaving(false)
    setTimeout(() => setSuccess(false), 3000)
  }

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  const preview = selected && qty && !isNaN(parseInt(qty))
    ? type === 'in'
      ? selected.quantity + parseInt(qty)
      : type === 'out'
      ? selected.quantity - parseInt(qty)
      : type === 'transfer'
      ? selected.quantity  // transferencia nao altera o total
      : parseInt(qty)
    : null

  const isTransfer = type === 'out' && !!destLocationId

  const L = { display: 'block' as const, fontSize: '11px', color: 'var(--text-3)', marginBottom: '6px' }

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '600' }}>Movimentação</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>Registre entradas, saídas e ajustes de estoque</p>
      </div>

      {success && (
        <div className="fade-up" style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', background: 'var(--ok-dim)', border: '1px solid rgba(34,197,94,0.2)', fontSize: '13px', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>✓</span>
          {isTransfer ? 'Transferência registrada com sucesso!' : 'Movimentação registrada com sucesso!'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Coluna esquerda — selecionar produto */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px' }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)', marginBottom: '14px' }}>1. Selecionar produto</div>
          <input
            placeholder="Buscar produto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ marginBottom: '12px' }}
          />
          <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {filtered.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Nenhum produto encontrado</div>
            ) : filtered.map(p => (
              <div key={p.id}
                onClick={() => { setSelected(p); setSuccess(false); setError(null) }}
                style={{
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: selected?.id === p.id ? 'var(--brand-dim)' : 'var(--bg-3)',
                  border: `1px solid ${selected?.id === p.id ? 'var(--brand)' : 'transparent'}`,
                  transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{p.category || 'Sem categoria'}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: p.quantity === 0 ? 'var(--empty)' : p.quantity <= p.min_stock ? 'var(--low)' : 'var(--ok)', fontFamily: 'var(--font-mono)' }}>
                      {p.quantity}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-3)' }}>em estoque</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna direita — registrar movimentação */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px' }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-1)', marginBottom: '14px' }}>2. Registrar movimentação</div>

          {!selected ? (
            <div style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '40px 0' }}>
              ← Selecione um produto
            </div>
          ) : (
            <>
              {/* Produto selecionado */}
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-3)', border: '1px solid var(--border-md)', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-1)' }}>{selected.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                  Estoque atual: <strong style={{ color: 'var(--text-1)' }}>{selected.quantity}</strong> {selected.unit || 'un'}
                </div>
              </div>

              {/* Tipo */}
              <div style={{ marginBottom: '16px' }}>
                <label style={L}>Tipo de movimentação</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' }}>
                  {(Object.entries(CFG) as [MovType, typeof CFG.in][]).map(([k, v]) => (
                    <button key={k} onClick={() => { setType(k); setDestLocationId('') }} style={{
                      padding: '8px 6px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      background: type === k ? `${v.color}1a` : 'var(--bg-3)',
                      border: `1px solid ${type === k ? v.color : 'var(--border)'}`,
                      color: type === k ? v.color : 'var(--text-2)',
                      fontSize: '12px', fontWeight: type === k ? '500' : '400',
                      transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                    }}>
                      <span style={{ fontSize: '16px' }}>{v.icon}</span>
                      <span>{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantidade */}
              <div style={{ marginBottom: '16px' }}>
                <label style={L}>Quantidade</label>
                <input
                  type="number" min="1" value={qty}
                  onChange={e => setQty(e.target.value)}
                  placeholder="Ex: 10"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: '600', textAlign: 'center' }}
                />
                {preview !== null && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-3)', textAlign: 'center' }}>
                    {type === 'transfer' ? <span style={{fontSize:'12px',color:'var(--brand-light)'}}>⇌ Não altera o estoque total</span> : <span>Estoque após: <strong style={{ color: preview! < 0 ? 'var(--empty)' : preview! <= selected.min_stock ? 'var(--low)' : 'var(--ok)', fontSize: '15px', fontFamily: 'var(--font-mono)' }}>{preview}</strong></span>}
                  </div>
                )}
              </div>

              {/* Depósito origem */}
              <div style={{ marginBottom: '16px' }}>
                <label style={L}>
                  {type === 'out' || type === 'transfer' ? 'Depósito de origem *' : 'Depósito'}
                  <span style={{ fontWeight: '400' }}> (opcional)</span>
                </label>
                <select value={locationId} onChange={e => setLocationId(e.target.value)}>
                  <option value="">Sem depósito específico</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              {/* Depósito destino — só para saída */}
              {(type === 'out' || type === 'transfer') && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={L}>
                    Depósito de destino{type === 'transfer' ? ' *' : ''}
                    {type !== 'transfer' && <span style={{ fontWeight: '400' }}> (opcional — para transferência)</span>}
                  </label>
                  <select value={destLocationId} onChange={e => setDestLocationId(e.target.value)}>
                    <option value="">Saída definitiva</option>
                    {locations.filter(l => l.id !== locationId).map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  {destLocationId && (
                    <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      Transferência: {locations.find(l=>l.id===locationId)?.name||'Origem'} → {locations.find(l=>l.id===destLocationId)?.name}
                    </div>
                  )}
                </div>
              )}

              {/* Observação */}
              <div style={{ marginBottom: '16px' }}>
                <label style={L}>Observação <span style={{ fontWeight: '400' }}>(opcional)</span></label>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: Doação recebida, consumido no evento..."/>
              </div>

              {error && (
                <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '8px', background: 'var(--empty-dim)', fontSize: '13px', color: 'var(--empty)' }}>{error}</div>
              )}

              <button onClick={handleSubmit} disabled={saving || !qty} style={{
                width: '100%', padding: '11px',
                background: saving || !qty ? 'var(--bg-3)' : isTransfer ? 'var(--info)' : CFG[type].color,
                color: saving || !qty ? 'var(--text-3)' : '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '14px', fontWeight: '600',
                cursor: saving || !qty ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
              }}>
                {saving ? 'Registrando...' : type === 'transfer' ? `Transferir para ${locations.find(l=>l.id===destLocationId)?.name||'...'}` : isTransfer ? `Transferir para ${locations.find(l=>l.id===destLocationId)?.name}` : `Registrar ${CFG[type].label}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
