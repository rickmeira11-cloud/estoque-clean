'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import type { Product } from '@/types'
const S={ok:{label:'OK',color:'var(--ok)',bg:'var(--ok-dim)'},low:{label:'Baixo',color:'var(--low)',bg:'var(--low-dim)'},empty:{label:'Zerado',color:'var(--empty)',bg:'var(--empty-dim)'}}
const getStatus=(p:Product)=>p.quantity===0?'empty':p.quantity<=p.min_stock?'low':'ok'
const blank={name:'',category:'',type:'non_perishable',container:'',unit:'un',min_stock:'1',last_purchase_value:'',expiration_date:'',notes:''}
function isDirty(form:typeof blank){return form.name!==blank.name||form.category!==blank.category||form.notes!==blank.notes}
export default function EstoquePage() {
  const {profile,canEdit}=useProfile()
  const [products,setProducts]=useState<Product[]>([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [filterStatus,setFilterStatus]=useState('all')
  const [filterCat,setFilterCat]=useState('all')
  const [filterLoc,setFilterLoc]=useState('all')
  const [locations,setLocations]=useState([])
  const [productsByLoc,setProductsByLoc]=useState({})
  const [locBalance,setLocBalance]=useState({})
  const [sortCol,setSortCol]=useState('name')
  const [sortDir,setSortDir]=useState('asc')
  const [categories,setCategories]=useState<string[]>([])
  const [showModal,setShowModal]=useState(false)
  const [editItem,setEditItem]=useState<Product|null>(null)
  const [form,setForm]=useState(blank)
  const [saving,setSaving]=useState(false)
  const formRef  = useRef(null)
  const firstRef = useRef(null)
  function handleClose(){if(isDirty(form)&&!confirm('Existem dados preenchidos. Deseja fechar sem salvar?'))return;setShowModal(false);setEditItem(null);setForm(blank)}
  const [formError,setFormError]=useState<string|null>(null)
  useEffect(()=>{if(!profile?.church_id)return;load();createClient().from('locations').select('id,name').eq('church_id',profile.church_id).eq('is_active',true).order('name').then(({data})=>{if(data)setLocations(data)});createClient().from('stock_movements').select('product_id,location_id,destination_location_id,type,quantity').eq('church_id',profile.church_id).not('location_id','is',null).then(({data})=>{if(data){const m={};const bal={};data.forEach((r)=>{const key=r.product_id+'|'+r.location_id;if(!bal[key])bal[key]=0;if(r.type==='in')bal[key]+=r.quantity;if(r.type==='out')bal[key]-=r.quantity;if(r.type==='transfer'){bal[key]-=r.quantity;if(r.destination_location_id){const destKey=r.product_id+'|'+r.destination_location_id;if(!bal[destKey])bal[destKey]=0;bal[destKey]+=r.quantity;}}if(!m[r.location_id])m[r.location_id]=new Set();m[r.location_id].add(r.product_id)});setProductsByLoc(m);setLocBalance(bal)}})},[profile?.church_id])
  async function gerarListaCompras() {
    const criticos = products.filter(p => p.quantity <= p.min_stock).sort((a:any,b:any) => {
      const ca = a.category||'Sem categoria'; const cb = b.category||'Sem categoria';
      return ca.localeCompare(cb) || a.name.localeCompare(b.name);
    });
    if (criticos.length === 0) { alert('Nenhum item abaixo do mínimo no momento.'); return; }

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ format:'a4' });
    const today = new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});

    // Header
    doc.setFillColor(17,17,19); doc.rect(0,0,210,30,'F');
    doc.setTextColor(250,250,250); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('Lista de Compras', 14, 12);
    doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(161,161,170);
    doc.text('Poiema · Gestão de Estoque', 14, 20);
    doc.text('Gerada em ' + today, 14, 26);

    // Agrupar por categoria
    const grupos: Record<string, any[]> = {};
    criticos.forEach((p:any) => {
      const cat = p.category || 'Sem categoria';
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(p);
    });

    let y = 36;
    Object.entries(grupos).forEach(([cat, itens]) => {
      // Titulo da categoria
      doc.setFillColor(99,102,241); doc.rect(14, y, 182, 7, 'F');
      doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
      doc.text(cat.toUpperCase(), 17, y+5);
      y += 9;

      autoTable(doc, {
        head: [['Produto','Qtd atual','Mínimo','Comprar (sugerido)','Observações']],
        body: itens.map((p:any) => [
          p.name,
          p.quantity,
          p.min_stock,
          Math.max(p.min_stock - p.quantity, 1) + (p.unit ? ' ' + p.unit : ''),
          '',
        ]),
        startY: y,
        styles: { fontSize:9, cellPadding:4 },
        headStyles: { fillColor:[40,40,50], textColor:[200,200,200], fontStyle:'bold', fontSize:8 },
        alternateRowStyles: { fillColor:[248,248,250] },
        columnStyles: { 3:{fontStyle:'bold'}, 4:{minCellWidth:40} },
        didParseCell: (data:any) => {
          if (data.section==='body' && data.column.index===1) {
            const qty = Number(data.cell.text[0]);
            if (qty === 0) data.cell.styles.textColor = [239,68,68];
            else data.cell.styles.textColor = [245,158,11];
          }
        },
        margin: { left:14, right:14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    });

    // Rodape
    doc.setFontSize(8); doc.setTextColor(161,161,170); doc.setFont('helvetica','normal');
    doc.text('Total de itens: ' + criticos.length + ' | ' + criticos.filter((p:any)=>p.quantity===0).length + ' zerado(s)', 14, doc.internal.pageSize.height - 10);
    doc.text('Poiema Gestão de Estoque', 196, doc.internal.pageSize.height - 10, {align:'right'});

    doc.save('lista-compras-' + new Date().toISOString().split('T')[0] + '.pdf');
  }

  async function load() {
    setLoading(true)
    const {data,error}=await createClient().from('products').select('*').eq('church_id',profile!.church_id).eq('is_active',true).order('name')
    console.log('[load] data:', data, 'error:', error)
    if(data){setProducts(data as Product[]);setCategories([...new Set(data.map((p:any)=>p.category).filter(Boolean))].sort() as string[])}
    setLoading(false)
  }
  function openNew(){setEditItem(null);setForm(blank);setFormError(null);setShowModal(true);setTimeout(()=>{formRef.current?.scrollIntoView({behavior:'instant',block:'nearest'});firstRef.current?.focus()},100)}
  function openEdit(p:Product){setEditItem(p);setForm({name:p.name,category:p.category||'',type:p.type,container:p.container||'',unit:p.unit||'un',min_stock:String(p.min_stock),last_purchase_value:p.last_purchase_value?String(p.last_purchase_value):'',expiration_date:p.expiration_date||'',notes:p.notes||''});setFormError(null);setShowModal(true);setTimeout(()=>{formRef.current?.scrollIntoView({behavior:'instant',block:'nearest'});firstRef.current?.focus()},100)}
  async function save() {
    if(!profile?.church_id){setFormError('Perfil não carregado. Aguarde e tente novamente.');return}
    if(!form.name.trim()){setFormError('Nome obrigatório');return}
    setSaving(true);setFormError(null)
    const sb=createClient()
    const payload={church_id:profile.church_id,name:form.name.trim(),category:form.category||null,type:form.type,container:form.container||null,unit:form.unit||'un',min_stock:parseInt(form.min_stock)||0,last_purchase_value:form.last_purchase_value?parseFloat(form.last_purchase_value):null,expiration_date:form.expiration_date||null,notes:form.notes||null}
    console.log('[save] profile:', profile)
    console.log('[save] payload:', payload)
    const {data,error}=editItem?await sb.from('products').update(payload).eq('id',editItem.id).select():await sb.from('products').insert(payload).select()
    console.log('[save] data:', data, 'error:', error)
    if(error){setFormError(error.message);setSaving(false);return}
    if(!data||data.length===0){setFormError('Nenhum dado retornado — verifique RLS no Supabase.');setSaving(false);return}
    setShowModal(false);setSaving(false);load()
  }
  async function deactivate(id:string){await createClient().from('products').update({is_active:false}).eq('id',id);load()}
  const filtered=products.filter(p=>{const s=getStatus(p);const ms=!search||p.name.toLowerCase().includes(search.toLowerCase())||(p.category||'').toLowerCase().includes(search.toLowerCase());return ms&&(filterStatus==='all'||s===filterStatus)&&(filterCat==='all'||p.category===filterCat)&&(filterLoc==='all'||productsByLoc[filterLoc]?.has(p.id))}).sort((a,b)=>{
  const dir=sortDir==='asc'?1:-1
  if(sortCol==='name') return a.name.localeCompare(b.name)*dir
  if(sortCol==='category') return ((a.category||'').localeCompare(b.category||''))*dir
  if(sortCol==='quantity') return (a.quantity-b.quantity)*dir
  if(sortCol==='min_stock') return (a.min_stock-b.min_stock)*dir
  return 0
})
  const L={fontSize:'11px',color:'var(--text-3)',display:'block' as const,marginBottom:'5px'}
  return (
    <div style={{maxWidth:'1100px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <div><h1 style={{fontSize:'22px',fontWeight:'600'}}>Estoque</h1><p style={{fontSize:'13px',color:'var(--text-3)',marginTop:'4px'}}>{products.length} {products.length===1?'item':'itens'} cadastrados</p></div>
        <div style={{display:'flex',gap:'10px'}}><button onClick={gerarListaCompras} style={{padding:'9px 16px',background:'transparent',border:'1px solid var(--border)',borderRadius:'8px',fontSize:'13px',color:'var(--text-2)',cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>🛒 Lista de compras</button>{canEdit&&<button onClick={openNew} style={{padding:'9px 18px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>+ Novo produto</button>}</div>
      </div>
      <div className='estoque-filters' style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap'}}>
        <input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:'180px'}}/>
        <div style={{display:'flex',flexDirection:'column',gap:'8px',flex:1,minWidth:0}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="all">Todos os status</option><option value="ok">OK</option><option value="low">Baixo</option><option value="empty">Zerado</option></select>
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}><option value="all">Todas as categorias</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
          </div>
        </div>
      </div>
      {loading?(<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>{[1,2,3,4,5].map(i=><div key={i} className="skeleton" style={{height:'52px',borderRadius:'8px'}}/>)}</div>):(
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'12px',overflow:'hidden'}}>
          <table className='estoque-table' style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{borderBottom:'1px solid var(--border)'}}>{[
  {label:'Produto',    col:'name'},
  {label:'Categoria',  col:'category'},
  {label:'Qtd',        col:'quantity'},
  {label:'Mínimo',      col:'min_stock'},
  {label:'Depósito',    col:''},
  {label:'Status',     col:''},
  {label:'Validade',   col:''},
  {label:'',           col:''},
].map(({label,col})=>(
  <th key={label} onClick={col?()=>{if(sortCol===col)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortCol(col);setSortDir('asc')}}:undefined}
    style={{padding:'10px 14px',textAlign:'left',fontSize:'11px',color:sortCol===col&&col?'var(--brand-light)':'var(--text-3)',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.04em',cursor:col?'pointer':'default',userSelect:'none',whiteSpace:'nowrap'}}>
    {label}{col&&sortCol===col?(sortDir==='asc'?' ↑':' ↓'):''}
  </th>
))}</tr></thead>
            <tbody>
              {filtered.length===0?(<tr><td colSpan={7} style={{padding:'40px',textAlign:'center',color:'var(--text-3)',fontSize:'13px'}}>Nenhum produto encontrado</td></tr>):filtered.map(p=>{
                const locId=filterLoc!=='all'?locations.find((l)=>l.name===filterLoc)?.id:null;const displayQty=locId?(locBalance[p.id+'|'+locId]||0):p.quantity;const sKey=displayQty===0?'empty':displayQty<=p.min_stock?'low':'ok';const s=sKey;const {label,color,bg}=S[s]
                return (<tr key={p.id} style={{borderBottom:'1px solid var(--border)'}} onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <td style={{padding:'12px 14px'}}><div style={{fontSize:'13px',fontWeight:'500'}}>{p.name}</div>{p.notes&&<div style={{fontSize:'11px',color:'var(--text-3)',marginTop:'2px'}}>{p.notes}</div>}</td>
                  <td style={{padding:'12px 14px',fontSize:'12px',color:'var(--text-2)'}}>{p.category||'—'}</td>
                  <td style={{padding:'12px 14px',fontSize:'18px',fontWeight:'700',color}}>{displayQty}{locId&&<span style={{fontSize:'10px',color:'var(--text-3)',display:'block',lineHeight:1}}>dep</span>}</td>
                  <td style={{padding:'12px 14px',fontSize:'12px',color:'var(--text-3)'}}>{p.min_stock}</td>
                  <td style={{padding:'8px 14px'}}>{ (() => { const locs=Object.entries(locBalance).filter(([k,v])=>k.startsWith(p.id+'|')&&v>0); if(locs.length===0)return <span style={{color:'var(--text-3)'}}>—</span>; return locs.map(([k,v])=>{ const locId=k.split('|')[1]; const locName=locations.find(l=>l.id===locId)?.name||'?'; return <div key={k} style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'2px'}}><span style={{fontSize:'12px',fontWeight:'600',color:'var(--brand-light)',fontFamily:'var(--font-mono)'}}>{v}</span><span style={{fontSize:'11px',color:'var(--text-2)',background:'var(--bg-3)',padding:'1px 7px',borderRadius:'99px'}}>{locName}</span></div> }) })() }</td>
                  <td style={{padding:'12px 14px'}}><span style={{fontSize:'11px',fontWeight:'500',padding:'3px 10px',borderRadius:'99px',background:bg,color}}>{label}</span></td>
                  <td style={{padding:'12px 14px',fontSize:'12px',color:'var(--text-3)'}}>{p.expiration_date?new Date(p.expiration_date).toLocaleDateString('pt-BR'):'—'}</td>
                  <td style={{padding:'12px 14px'}}>{canEdit&&(<div style={{display:'flex',gap:'6px'}}><button onClick={()=>openEdit(p)} style={{padding:'4px 10px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',color:'var(--text-2)',cursor:'pointer'}}>Editar</button><button onClick={()=>deactivate(p.id)} style={{padding:'4px 10px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',color:'var(--text-3)',cursor:'pointer'}}>✕</button></div>)}</td>
                </tr>)
              })}
            </tbody>
          </table>
          {/* Cards mobile */}
          <div className="estoque-cards">
            {filtered.length===0?(<div style={{padding:'40px',textAlign:'center',color:'var(--text-3)',fontSize:'13px'}}>Nenhum produto encontrado</div>):filtered.map(p=>{
              const locId=filterLoc!=='all'?locations.find((l)=>l.name===filterLoc)?.id:null
              const displayQty=locId?(locBalance[p.id+'|'+locId]||0):p.quantity
              const sKey=displayQty===0?'empty':displayQty<=p.min_stock?'low':'ok'
              const {label,color,bg}=S[sKey]
              const locs=Object.entries(locBalance).filter(([k,v])=>k.startsWith(p.id+'|')&&v>0)
              return (
                <div key={p.id} style={{borderBottom:'1px solid var(--border)',padding:'14px 16px',transition:'background 0.1s'}} onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:'14px',fontWeight:'600',color:'var(--text-1)'}}>{p.name}</div>
                      <div style={{fontSize:'12px',color:'var(--text-3)',marginTop:'2px'}}>{p.category||'—'}</div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'4px',flexShrink:0,marginLeft:'12px'}}>
                      <div style={{fontSize:'22px',fontWeight:'700',color,fontFamily:'var(--font-mono)',lineHeight:1}}>{displayQty}</div>
                      <span style={{fontSize:'10px',fontWeight:'500',padding:'2px 8px',borderRadius:'99px',background:bg,color}}>{label}</span>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'16px',marginBottom:'8px',flexWrap:'wrap'}}>
                    <div style={{fontSize:'11px',color:'var(--text-3)'}}>Mínimo: <span style={{color:'var(--text-2)',fontWeight:'500'}}>{p.min_stock}</span></div>
                    {p.expiration_date&&<div style={{fontSize:'11px',color:'var(--text-3)'}}>Validade: <span style={{color:'var(--text-2)',fontWeight:'500'}}>{new Date(p.expiration_date).toLocaleDateString('pt-BR')}</span></div>}
                  </div>
                  {locs.length>0&&<div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'8px'}}>{locs.map(([k,v])=>{const locId=k.split('|')[1];const locName=locations.find(l=>l.id===locId)?.name||'?';return <span key={k} style={{fontSize:'11px',background:'var(--bg-3)',padding:'2px 8px',borderRadius:'99px',color:'var(--text-2)'}}>{locName}: <strong style={{color:'var(--brand-light)'}}>{v}</strong></span>})}</div>}
                  {canEdit&&<div style={{display:'flex',gap:'8px'}}>
                    <button onClick={()=>openEdit(p)} style={{flex:1,padding:'8px',background:'var(--bg-3)',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'13px',color:'var(--text-2)',cursor:'pointer',fontWeight:'500'}}>Editar</button>
                    <button onClick={()=>deactivate(p.id)} style={{padding:'8px 12px',background:'transparent',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'13px',color:'var(--text-3)',cursor:'pointer'}}>✕</button>
                  </div>}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {showModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'20px'}} onClick={handleClose}>
          <div className="fade-up" ref={formRef} onClick={e=>e.stopPropagation()} style={{background:'var(--bg-2)',border:'1px solid var(--border-md)',borderRadius:'16px',padding:'28px',width:'100%',maxWidth:'480px',maxHeight:'90vh',overflowY:'auto'}}>
            <h2 style={{fontSize:'16px',fontWeight:'600',marginBottom:'22px'}}>{editItem?'Editar produto':'Novo produto'}</h2>
            {formError&&<div style={{marginBottom:'14px',padding:'8px 12px',borderRadius:'8px',background:'var(--empty-dim)',fontSize:'13px',color:'var(--empty)'}}>{formError}</div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
              <div style={{gridColumn:'1/-1'}}><label style={L}>Nome *</label><input ref={firstRef} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Arroz 5kg"/></div>
              <div><label style={L}>Categoria</label><input value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="Ex: Alimentos" list="cats-list"/><datalist id="cats-list">{categories.map(c=><option key={c} value={c}/>)}</datalist></div>
              <div><label style={L}>Tipo</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option value="non_perishable">Não perecível</option><option value="perishable">Perecível</option></select></div>
              
              <div><label style={L}>Estoque mínimo</label><input type="number" min="0" value={form.min_stock} onChange={e=>setForm(f=>({...f,min_stock:e.target.value}))}/></div>
              <div><label style={L}>Embalagem</label><input value={form.container} onChange={e=>setForm(f=>({...f,container:e.target.value}))} placeholder="Caixa, Kg..."/></div>
              <div><label style={L}>Último preço (R$)</label><input type="number" step="0.01" value={form.last_purchase_value} onChange={e=>setForm(f=>({...f,last_purchase_value:e.target.value}))}/></div>
              <div style={{gridColumn:'1/-1'}}><label style={L}>Validade</label><input type="date" value={form.expiration_date} onChange={e=>setForm(f=>({...f,expiration_date:e.target.value}))}/></div>
              <div style={{gridColumn:'1/-1'}}><label style={L}>Observações</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{resize:'none',height:'68px'}}/></div>
            </div>
            <div style={{display:'flex',gap:'10px',marginTop:'20px'}}>
              <button onClick={save} disabled={saving||!profile} style={{flex:1,padding:'10px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer',opacity:saving?0.7:1}}>{saving?'Salvando...':editItem?'Salvar':'Cadastrar'}</button>
              <button onClick={handleClose} style={{padding:'10px 18px',background:'transparent',border:'1px solid var(--border)',borderRadius:'8px',fontSize:'13px',color:'var(--text-2)',cursor:'pointer'}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
