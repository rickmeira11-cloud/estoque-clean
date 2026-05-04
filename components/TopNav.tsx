'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { useStockAlerts, type StockAlert } from '@/hooks/useStockAlerts'

const NAV = [
  { href:'/dashboard',     label:'Dashboard',   icon:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href:'/estoque',       label:'Estoque',      icon:'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { href:'/movimentacoes', label:'Movimentação',   icon:'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' },
  { href:'/historico',     label:'Histórico',    icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href:'/relatorios',    label:'Relatórios',   icon:'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href:'/mural',         label:'Mural',  icon:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 110 8 4 4 0 010-8z' },
]

const NAV_CADASTROS = [
  { href:'/admin/depositos', label:'Depósito',  icon:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10' },
  { href:'/admin/igrejas',   label:'Igreja',      icon:'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 00-1-1h-2a1 1 0 00-1 1v5m4 0H9' },
  { href:'/ministerios',     label:'Ministério',  icon:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 110 8 4 4 0 010-8z' },
  { href:'/admin/usuarios',  label:'Usuário',     icon:'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
]

function Icon({ d, size=16 }: { d:string; size?:number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  )
}

function NavLink({ href, label, icon, small=false, isActive }: { href:string; label:string; icon:string; small?:boolean; isActive:boolean }) {
  return (
    <Link href={href} style={{
      display:'flex', alignItems:'center', gap:'6px',
      padding: small ? '5px 10px' : '6px 12px',
      borderRadius:'var(--radius-sm)', textDecoration:'none',
      fontSize: small ? '12px' : '13px',
      fontWeight: isActive ? '500' : '400',
      color: isActive ? 'var(--text-1)' : 'var(--text-2)',
      background: isActive ? 'var(--bg-3)' : 'transparent',
      border: isActive ? '1px solid var(--border-md)' : '1px solid transparent',
      transition:'all 0.15s', whiteSpace:'nowrap', flexShrink:0,
    }}>
      <span style={{color: isActive ? 'var(--brand-light)' : 'var(--text-3)', flexShrink:0}}>
        <Icon d={icon} size={small ? 13 : 14}/>
      </span>
      {label}
      {isActive && <span style={{width:'4px',height:'4px',borderRadius:'50%',background:'var(--brand-light)',marginLeft:'2px',flexShrink:0}}/>}
    </Link>
  )
}

export function TopNav() {
  const pathname = usePathname()
  const { profile, isAdmin, switchChurch } = useProfile()
  const { alerts, expiryAlerts, count, stockCount, expiryCount, hasAlerts } = useStockAlerts()
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [userOpen,     setUserOpen]     = useState(false)
  const [alertOpen,    setAlertOpen]    = useState(false)
  const [cadastrosOpen,setCadastroOpen] = useState(false)
  const menuRef     = useRef<HTMLDivElement>(null)
  const userRef     = useRef<HTMLDivElement>(null)
  const alertRef    = useRef<HTMLDivElement>(null)
  const cadastrosRef = useRef<HTMLDivElement>(null)

  async function logout() {
    await createClient().auth.signOut()
    window.location.href = '/login'
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current      && !menuRef.current.contains(e.target as Node))      setMenuOpen(false)
      if (userRef.current      && !userRef.current.contains(e.target as Node))      setUserOpen(false)
      if (alertRef.current     && !alertRef.current.contains(e.target as Node))     setAlertOpen(false)
      if (cadastrosRef.current && !cadastrosRef.current.contains(e.target as Node)) setCadastroOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => { setMenuOpen(false); setAlertOpen(false); setCadastroOpen(false) }, [pathname])

  const allNav = [...NAV, ...(isAdmin ? NAV_CADASTROS : [])]
  const currentPage = allNav.find(n => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)))
  const active = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  const churchName = profile?.church?.name || ''
  const isCadastroActive = NAV_CADASTROS.some(n => active(n.href))

  return (
    <header style={{position:'fixed',top:0,left:0,right:0,zIndex:50,height:'var(--topbar-h)',background:'rgba(17,17,19,0.92)',backdropFilter:'blur(20px)',borderBottom:'1px solid var(--border)'}}>
      <div style={{display:'flex',alignItems:'center',height:'100%',padding:'0 20px',gap:'8px',maxWidth:'1400px',margin:'0 auto'}}>

        {/* Logo + igreja */}
        <Link href="/dashboard" style={{display:'flex',alignItems:'center',gap:'10px',textDecoration:'none',marginRight:'12px',flexShrink:0}}>
          <div style={{width:'30px',height:'30px',borderRadius:'8px',flexShrink:0,background:'#111827',border:'1px solid var(--border-md)',display:'flex',alignItems:'center',justifyContent:'center',padding:'5px'}}>
            <Image src="/logo.png" alt="Poiema" width={20} height={20} style={{objectFit:'contain',filter:'brightness(0) invert(1) opacity(0.85)'}}/>
          </div>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <span style={{fontSize:'13px',fontWeight:'600',color:'var(--brand-light)',lineHeight:1,letterSpacing:'-0.01em'}}>{churchName}</span>
              
            </div>
            <div style={{fontSize:'10px',color:'var(--text-3)',marginTop:'3px'}}>Gestão de Estoque</div>
          </div>
        </Link>

        {/* Nav desktop */}
        <div style={{display:'flex',alignItems:'center',gap:'2px',flex:1}} className="desktop-nav">
          {NAV.filter(n => n.href !== '/mural' || profile?.church_id === '8db14705-9da8-4844-8b01-a73845297831').map(n => <NavLink key={n.href} {...n} isActive={active(n.href)}/>)}

          {/* Menu Cadastro */}
          {isAdmin && (
            <div ref={cadastrosRef} style={{position:'relative',flexShrink:0}}>
              <button onClick={() => setCadastroOpen(o => !o)} style={{
                display:'flex', alignItems:'center', gap:'6px',
                padding:'6px 12px', borderRadius:'var(--radius-sm)',
                fontSize:'13px', fontWeight: isCadastroActive ? '500' : '400',
                color: isCadastroActive ? 'var(--text-1)' : 'var(--text-2)',
                background: isCadastroActive || cadastrosOpen ? 'var(--bg-3)' : 'transparent',
                border: isCadastroActive ? '1px solid var(--border-md)' : '1px solid transparent',
                cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap',
              }}>
                <span style={{color: isCadastroActive ? 'var(--brand-light)' : 'var(--text-3)'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                  </svg>
                </span>
                Cadastro
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transition:'transform 0.15s',transform: cadastrosOpen ? 'rotate(180deg)' : 'rotate(0deg)'}}>
                  <path d="M19 9l-7 7-7-7"/>
                </svg>
                {isCadastroActive && <span style={{width:'4px',height:'4px',borderRadius:'50%',background:'var(--brand-light)',marginLeft:'2px'}}/>}
              </button>

              {cadastrosOpen && (
                <div className="slide-down" style={{position:'absolute',top:'calc(100% + 8px)',left:0,background:'var(--bg-2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius)',minWidth:'200px',overflow:'hidden',zIndex:100}}>
                  <div style={{padding:'8px 10px 4px',fontSize:'10px',fontWeight:'600',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em'}}>
                    Cadastro
                  </div>
                  {NAV_CADASTROS.map(n => {
                    const act = active(n.href)
                    return (
                      <Link key={n.href} href={n.href} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 14px',textDecoration:'none',fontSize:'13px',color:act?'var(--text-1)':'var(--text-2)',background:act?'rgba(99,102,241,0.08)':'transparent',transition:'background 0.1s'}}
                        onMouseEnter={e=>(e.currentTarget.style.background=act?'rgba(99,102,241,0.12)':'var(--bg-3)')}
                        onMouseLeave={e=>(e.currentTarget.style.background=act?'rgba(99,102,241,0.08)':'transparent')}>
                        <span style={{color:act?'var(--brand-light)':'var(--text-3)'}}><Icon d={n.icon} size={14}/></span>
                        {n.label}
                        {act && <span style={{marginLeft:'auto',width:'5px',height:'5px',borderRadius:'50%',background:'var(--brand-light)'}}/>}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Alertas + user â desktop */}
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginLeft:'auto',flexShrink:0}} className="desktop-nav">

          {/* Sininho de alertas */}
          <div ref={alertRef} style={{position:'relative'}}>
            <button onClick={() => setAlertOpen(o => !o)} style={{width:'34px',height:'34px',borderRadius:'var(--radius-sm)',background:alertOpen?'var(--bg-3)':'transparent',border:'1px solid var(--border-md)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s',position:'relative'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasAlerts?'var(--low)':'var(--text-3)'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              {hasAlerts && (
                <span style={{position:'absolute',top:'-4px',right:'-4px',width:'16px',height:'16px',borderRadius:'50%',background:'var(--empty)',fontSize:'9px',fontWeight:'700',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid var(--bg)'}}>
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
            {alertOpen && (
                <div className="slide-down" style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:'var(--bg-2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius)',minWidth:'300px',maxWidth:'340px',overflow:'hidden',zIndex:100}}>
                  <div style={{padding:'12px 14px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:'13px',fontWeight:'500',color:'var(--text-1)'}}>Alertas</span>
                    {hasAlerts && <span style={{fontSize:'11px',background:'var(--empty-dim)',color:'var(--empty)',padding:'2px 8px',borderRadius:'99px',fontWeight:'500'}}>{count}</span>}
                  </div>
                  {!hasAlerts ? (
                    <div style={{padding:'20px',textAlign:'center',fontSize:'13px',color:'var(--text-3)'}}>Tudo em dia ✓</div>
                  ) : (
                    <div style={{maxHeight:'320px',overflowY:'auto'}}>
                      {stockCount > 0 && <div style={{padding:'8px 14px 4px',fontSize:'10px',fontWeight:'600',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',borderBottom:'1px solid var(--border)'}}>Estoque baixo ({stockCount})</div>}
                      {alerts.map((p:StockAlert) => (
                        <Link key={p.id} href="/estoque" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderBottom:'1px solid var(--border)',textDecoration:'none',transition:'background 0.1s'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-3)')}
                          onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                          <div>
                            <div style={{fontSize:'12px',fontWeight:'500',color:'var(--text-1)'}}>{p.name}</div>
                            <div style={{fontSize:'10px',color:'var(--text-3)',marginTop:'1px'}}>{p.category||'Sem categoria'}</div>
                          </div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div style={{fontSize:'16px',fontWeight:'700',color:p.quantity===0?'var(--empty)':'var(--low)',fontFamily:'var(--font-mono)'}}>{p.quantity}</div>
                            <div style={{fontSize:'9px',color:'var(--text-3)'}}>mín {p.min_stock}</div>
                          </div>
                        </Link>
                      ))}
                      {expiryCount > 0 && <div style={{padding:'8px 14px 4px',fontSize:'10px',fontWeight:'600',color:'var(--low)',textTransform:'uppercase',letterSpacing:'0.06em',borderBottom:'1px solid var(--border)'}}>Validade próxima ({expiryCount})</div>}
                      {expiryAlerts.map((p:StockAlert) => (
                        <Link key={"exp-"+p.id} href="/estoque" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderBottom:'1px solid var(--border)',textDecoration:'none',transition:'background 0.1s'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-3)')}
                          onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                          <div>
                            <div style={{fontSize:'12px',fontWeight:'500',color:'var(--text-1)'}}>{p.name}</div>
                            <div style={{fontSize:'10px',color:'var(--text-3)',marginTop:'1px'}}>{p.category||'Sem categoria'}</div>
                          </div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div style={{fontSize:'12px',fontWeight:'700',color:(p.daysUntilExpiry||0)<0?'var(--empty)':'var(--low)'}}>{(p.daysUntilExpiry||0)<0?'VENCIDO':p.daysUntilExpiry+'d'}</div>
                            <div style={{fontSize:'9px',color:'var(--text-3)'}}>{p.expiration_date?new Date(p.expiration_date+'T12:00:00').toLocaleDateString('pt-BR'):''}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  <div style={{padding:'10px 14px',borderTop:'1px solid var(--border)'}}>
                    <Link href="/relatorios" style={{fontSize:'12px',color:'var(--brand-light)',textDecoration:'none'}} onClick={() => setAlertOpen(false)}>
                      Ver relatório críticos →
                    </Link>
                  </div>
                </div>
              )}
          </div>

          {/* User dropdown */}
          <div ref={userRef} style={{position:'relative'}}>
            <button onClick={() => setUserOpen(o => !o)} style={{display:'flex',alignItems:'center',gap:'8px',padding:'5px 10px 5px 6px',borderRadius:'99px',background:userOpen?'var(--bg-3)':'transparent',border:'1px solid var(--border-md)',cursor:'pointer',transition:'all 0.15s'}}>
              <div style={{width:'24px',height:'24px',borderRadius:'50%',background:'var(--brand-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:'600',color:'var(--brand-light)',flexShrink:0}}>
                {(profile?.name||profile?.email||'?').charAt(0).toUpperCase()}
              </div>
              <span style={{fontSize:'12px',color:'var(--text-2)',maxWidth:'100px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.name||profile?.email}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><path d="M19 9l-7 7-7-7"/></svg>
            </button>
            {userOpen && (
              <div className="slide-down" style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:'var(--bg-2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius)',minWidth:'210px',overflow:'hidden',zIndex:100}}>
                <div style={{padding:'12px 14px',borderBottom:'1px solid var(--border)'}}>
                  <div style={{fontSize:'13px',fontWeight:'500',color:'var(--text-1)'}}>{profile?.name||'(sem nome)'}</div>
                  <div style={{fontSize:'11px',color:'var(--text-3)',marginTop:'2px'}}>{profile?.email}</div>
                  <div style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'6px',flexWrap:'wrap'}}>
                    <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'99px',background:'var(--brand-dim)',color:'var(--brand-light)',fontWeight:'500'}}>
                      {{super_admin:'Super Admin',admin:'Admin',operator:'Operador',viewer:'Visualizador'}[profile?.role||'operator']}
                    </span>
                    {churchName && <span style={{fontSize:'10px',padding:'2px 8px',borderRadius:'99px',background:'rgba(255,255,255,0.04)',color:'var(--text-3)',border:'1px solid var(--border)'}}>{churchName}</span>}
                  </div>
                </div>
                {profile?.churches && profile.churches.length > 1 && (
                  <button onClick={() => { setUserOpen(false); window.location.href = '/selecionar-igreja' }}
                    style={{width:'100%',padding:'10px 14px',background:'transparent',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--text-2)',transition:'background 0.1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg-3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Selecionar Igreja
                  </button>
                )}
                <button onClick={logout} style={{width:'100%',padding:'10px 14px',background:'transparent',border:'none',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--empty)',transition:'background 0.1s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg-3)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                  Sair da conta
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile hamburguer */}
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginLeft:'auto'}} className="mobile-menu-btn">
          <div ref={alertRef} style={{position:'relative'}}>
            <button onClick={() => setAlertOpen(o => !o)} style={{position:'relative',width:'34px',height:'34px',borderRadius:'var(--radius-sm)',background:alertOpen?'var(--bg-3)':'var(--bg-2)',border:'1px solid var(--border-md)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasAlerts ? 'var(--low)' : 'var(--text-3)'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
              {hasAlerts && <span style={{position:'absolute',top:'-4px',right:'-4px',width:'16px',height:'16px',borderRadius:'50%',background:'var(--empty)',fontSize:'9px',fontWeight:'700',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid var(--bg)'}}>{count > 9 ? '9+' : count}</span>}
            </button>
            {alertOpen && (
              <div className="slide-down" style={{position:'fixed',top:'52px',right:'8px',left:'8px',background:'var(--bg-2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius)',overflow:'hidden',zIndex:200,maxHeight:'70vh',overflowY:'auto'}}>
                <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',fontSize:'12px',fontWeight:'600',color:'var(--text-1)'}}>Alertas de estoque</div>
                {alerts.map(a => (
                  <div key={a.id} style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div><div style={{fontSize:'13px',fontWeight:'500',color:'var(--text-1)'}}>{a.name}</div><div style={{fontSize:'11px',color:'var(--text-3)'}}>{a.category||'—'} · estoque: {a.quantity} (mín {a.min_stock})</div></div>
                    <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'99px',background:'var(--empty-dim)',color:'var(--empty)',fontWeight:'500',flexShrink:0,marginLeft:'8px'}}>{a.quantity===0?'Zerado':'Baixo'}</span>
                  </div>
                ))}
                {expiryAlerts.map(a => (
                  <div key={a.id+'-exp'} style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div><div style={{fontSize:'13px',fontWeight:'500',color:'var(--text-1)'}}>{a.name}</div><div style={{fontSize:'11px',color:'var(--text-3)'}}>{a.category||'—'} · vence em {a.daysUntilExpiry}d</div></div>
                    <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'99px',background:'var(--low-dim)',color:'var(--low)',fontWeight:'500',flexShrink:0,marginLeft:'8px'}}>{(a.daysUntilExpiry||0)<0?'Vencido':'Expirando'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {currentPage && (
            <span style={{fontSize:'11px',color:'var(--text-3)',background:'var(--bg-3)',border:'1px solid var(--border)',padding:'3px 10px',borderRadius:'99px',whiteSpace:'nowrap'}}>
              {currentPage.label}
            </span>
          )}
          <div ref={menuRef} style={{position:'relative'}}>
            <button onClick={() => setMenuOpen(o => !o)} style={{width:'34px',height:'34px',borderRadius:'var(--radius-sm)',background:menuOpen?'var(--bg-3)':'var(--bg-2)',border:'1px solid var(--border-md)',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'4px',transition:'all 0.15s'}}>
              <span style={{width:'14px',height:'1.5px',background:menuOpen?'var(--brand-light)':'var(--text-2)',borderRadius:'1px',transition:'all 0.15s'}}/>
              <span style={{width:'14px',height:'1.5px',background:menuOpen?'var(--brand-light)':'var(--text-2)',borderRadius:'1px',transition:'all 0.15s'}}/>
              <span style={{width:'10px',height:'1.5px',background:menuOpen?'var(--brand-light)':'var(--text-2)',borderRadius:'1px',alignSelf:'flex-start',marginLeft:'2px',transition:'all 0.15s'}}/>
            </button>
            {menuOpen && (
              <div className="slide-down" style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:'var(--bg-2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius)',minWidth:'220px',overflow:'hidden',zIndex:100}}>
                <div style={{padding:'12px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'var(--brand-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:'600',color:'var(--brand-light)',flexShrink:0}}>
                    {(profile?.name||profile?.email||'?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:'12px',fontWeight:'500',color:'var(--text-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.name||profile?.email}</div>
                    <div style={{fontSize:'10px',color:'var(--brand-light)',marginTop:'1px',fontWeight:'500'}}>{churchName}</div>
                  </div>
                </div>

                {/* Links principais */}
                {NAV.map(n => {
                  const act = active(n.href)
                  return (
                    <Link key={n.href} href={n.href} style={{display:'flex',alignItems:'center',gap:'10px',padding:'11px 14px',textDecoration:'none',fontSize:'13px',color:act?'var(--text-1)':'var(--text-2)',background:act?'rgba(99,102,241,0.08)':'transparent',borderBottom:'1px solid var(--border)',transition:'background 0.1s'}}>
                      <span style={{color:act?'var(--brand-light)':'var(--text-3)'}}><Icon d={n.icon} size={15}/></span>
                      {n.label}
                      {act && <span style={{marginLeft:'auto',width:'5px',height:'5px',borderRadius:'50%',background:'var(--brand-light)'}}/>}
                    </Link>
                  )
                })}

                {/* Cadastro no mobile */}
                {isAdmin && (
                  <>
                    <div style={{padding:'8px 14px 4px',fontSize:'10px',fontWeight:'600',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',borderBottom:'1px solid var(--border)'}}>
                      Cadastro
                    </div>
                    {NAV_CADASTROS.map(n => {
                      const act = active(n.href)
                      return (
                        <Link key={n.href} href={n.href} style={{display:'flex',alignItems:'center',gap:'10px',padding:'11px 14px',textDecoration:'none',fontSize:'13px',color:act?'var(--text-1)':'var(--text-2)',background:act?'rgba(99,102,241,0.08)':'transparent',borderBottom:'1px solid var(--border)',transition:'background 0.1s'}}>
                          <span style={{color:act?'var(--brand-light)':'var(--text-3)'}}><Icon d={n.icon} size={15}/></span>
                          {n.label}
                          {act && <span style={{marginLeft:'auto',width:'5px',height:'5px',borderRadius:'50%',background:'var(--brand-light)'}}/>}
                        </Link>
                      )
                    })}
                  </>
                )}

                <button onClick={logout} style={{width:'100%',padding:'11px 14px',background:'transparent',border:'none',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'10px',fontSize:'13px',color:'var(--text-3)',transition:'background 0.1s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg-3)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                {profile?.churches && profile.churches.length > 1 && (
                  <button onClick={() => { setUserOpen(false); window.location.href = '/selecionar-igreja' }} style={{width:'100%',padding:'10px 14px',background:'transparent',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--text-2)',transition:'background 0.1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg-3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Selecionar Igreja
                  </button>
                )}
                  Sair da conta
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  )
}
