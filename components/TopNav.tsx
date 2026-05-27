'use client'
import { CONFIG, isMainChurch } from '@/lib/config'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { useStockAlerts } from '@/hooks/useStockAlerts'
import { usePushNotifications } from '@/hooks/usePushNotifications'

const NAV = [
  { href:'/dashboard',     label:'Dashboard',    icon:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href:'/estoque',       label:'Estoque',      icon:'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { href:'/movimentacoes', label:'Movimentação', icon:'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' },
  { href:'/inventario',    label:'Inventário',      icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { href:'/relatorios',    label:'Relatórios',   icon:'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href:'/mural',         label:'Mural',        icon:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 110 8 4 4 0 010-8z' },
]

const NAV_CADASTROS = [
  { href:'/admin/depositos',  label:'Depósito',    icon:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10' },
  { href:'/admin/igrejas',    label:'Igreja',      icon:'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 00-1-1h-2a1 1 0 00-1 1v5m4 0H9' },
  { href:'/ministerios',      label:'Ministério',  icon:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href:'/admin/usuarios',   label:'Usuário',     icon:'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
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
      padding: small ? '5px 10px' : '5px 12px',
      borderRadius:'var(--radius-sm)',
      textDecoration:'none',
      fontSize:'13px',
      fontWeight: isActive ? '500' : '400',
      color: isActive ? 'var(--text-1)' : 'var(--text-2)',
      background: isActive ? 'var(--bg-3)' : 'transparent',
      border: isActive ? '1px solid var(--border-md)' : '1px solid transparent',
      transition:'all 0.15s',
      whiteSpace:'nowrap',
    }}>
      <span style={{color: isActive ? 'var(--brand-light)' : 'var(--text-3)'}}><Icon d={icon} size={14}/></span>
      {label}
      {isActive && <span style={{width:'4px',height:'4px',borderRadius:'50%',background:'var(--brand-light)',marginLeft:'2px'}}/>}
    </Link>
  )
}

const POIEMA_BNU_ID = CONFIG.POIEMA_BNU_ID

export function TopNav() {
  const pathname = usePathname()
  const { profile, isAdmin, switchChurch } = useProfile()
  const { alerts, expiryAlerts, count, hasAlerts } = useStockAlerts()
  const { permission, subscribed, requestPermission } = usePushNotifications()
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [userOpen,     setUserOpen]     = useState(false)
  const [alertOpen,    setAlertOpen]    = useState(false)
  const [cadastroOpen, setCadastroOpen] = useState(false)
  const menuRef     = useRef<HTMLDivElement>(null)
  const userRef     = useRef<HTMLDivElement>(null)
  const alertRef    = useRef<HTMLDivElement>(null)
  const cadastroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current      && !menuRef.current.contains(e.target as Node))      setMenuOpen(false)
      if (userRef.current      && !userRef.current.contains(e.target as Node))      setUserOpen(false)
      if (alertRef.current     && !alertRef.current.contains(e.target as Node))     setAlertOpen(false)
      if (cadastroRef.current  && !cadastroRef.current.contains(e.target as Node))  setCadastroOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => { setMenuOpen(false); setAlertOpen(false); setCadastroOpen(false) }, [pathname])

  const active = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  const churchName = profile?.church?.name || ''
  const isCadastroActive = NAV_CADASTROS.some(n => active(n.href))
  const isPoiemaBNU = profile?.church_id === POIEMA_BNU_ID

  async function logout() {
    await createClient().auth.signOut()
    localStorage.removeItem('gestoque_active_church')
    window.location.href = '/login'
  }

  return (
    <>
    <header style={{position:'fixed',top:0,left:0,right:0,zIndex:50,height:'var(--topbar-h)',background:'rgba(17,17,19,0.92)',backdropFilter:'blur(20px)',borderBottom:'1px solid var(--border)'}}>
      <div style={{display:'flex',alignItems:'center',height:'100%',padding:'0 20px',gap:'8px',maxWidth:'1400px',margin:'0 auto'}}>

        {/* Hamburguer mobile — antes do logo */}
        <button onClick={() => setMenuOpen(o => !o)} className="mobile-menu-btn" style={{width:'34px',height:'34px',borderRadius:'var(--radius-sm)',background:'transparent',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'4px',flexShrink:0,marginRight:'4px'}}>
          <span style={{width:'16px',height:'2px',background:'var(--text-2)',borderRadius:'2px',transition:'all 0.2s',transform:menuOpen?'rotate(45deg) translate(0px,6px)':'none'}}/>
          <span style={{width:'16px',height:'2px',background:'var(--text-2)',borderRadius:'2px',transition:'all 0.2s',opacity:menuOpen?0:1}}/>
          <span style={{width:'16px',height:'2px',background:'var(--text-2)',borderRadius:'2px',transition:'all 0.2s',transform:menuOpen?'rotate(-45deg) translate(0px,-6px)':'none'}}/>
        </button>

        {/* Logo */}
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
        <nav style={{display:'flex',alignItems:'center',gap:'2px',flex:1}} className="desktop-nav">
          {NAV.filter(n => n.href !== '/mural' || isPoiemaBNU).map(n => (
            <NavLink key={n.href} {...n} isActive={active(n.href)}/>
          ))}
          {isAdmin && (
            <div ref={cadastroRef} style={{position:'relative',flexShrink:0}}>
              <button onClick={() => setCadastroOpen(o => !o)} style={{
                display:'flex',alignItems:'center',gap:'6px',
                padding:'5px 12px',borderRadius:'var(--radius-sm)',
                fontSize:'13px',fontWeight: isCadastroActive ? '500' : '400',
                color: isCadastroActive ? 'var(--text-1)' : 'var(--text-2)',
                background: isCadastroActive || cadastroOpen ? 'var(--bg-3)' : 'transparent',
                border: isCadastroActive ? '1px solid var(--border-md)' : '1px solid transparent',
                cursor:'pointer',whiteSpace:'nowrap',transition:'all 0.15s',
              }}>
                <span style={{color: isCadastroActive ? 'var(--brand-light)' : 'var(--text-3)'}}>
                  <Icon d="M4 6h16M4 12h16M4 18h7" size={14}/>
                </span>
                Cadastros
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{transition:'transform 0.15s',transform: cadastroOpen ? 'rotate(180deg)' : 'rotate(0deg)'}}>
                  <path d="M19 9l-7 7-7-7"/>
                </svg>
                {isCadastroActive && <span style={{width:'4px',height:'4px',borderRadius:'50%',background:'var(--brand-light)',marginLeft:'2px'}}/>}
              </button>
              {cadastroOpen && (
                <div className="slide-down" style={{position:'absolute',top:'calc(100% + 8px)',left:0,background:'var(--bg-2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius)',minWidth:'180px',overflow:'hidden',zIndex:100}}>
                  <div style={{padding:'8px 12px 4px',fontSize:'10px',fontWeight:'600',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Cadastros</div>
                  {NAV_CADASTROS.map(n => {
                    const act = active(n.href)
                    return (
                      <Link key={n.href} href={n.href} style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 12px',textDecoration:'none',fontSize:'13px',color:act?'var(--text-1)':'var(--text-2)',background:act?'rgba(99,102,241,0.08)':'transparent',transition:'background 0.1s'}}>
                        <span style={{color:act?'var(--brand-light)':'var(--text-3)'}}><Icon d={n.icon} size={14}/></span>
                        {n.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Alertas desktop */}
        <div ref={alertRef} style={{position:'relative'}} className="desktop-nav">
          <button onClick={() => setAlertOpen(o => !o)} style={{position:'relative',width:'34px',height:'34px',borderRadius:'var(--radius-sm)',background:alertOpen?'var(--bg-3)':'transparent',border:'1px solid var(--border-md)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasAlerts ? 'var(--low)' : 'var(--text-3)'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
            {hasAlerts && <span style={{position:'absolute',top:'-4px',right:'-4px',width:'16px',height:'16px',borderRadius:'50%',background:'var(--empty)',fontSize:'9px',fontWeight:'700',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid var(--bg)'}}>{count > 9 ? '9+' : count}</span>}
          </button>
          {alertOpen && (
            <div className="slide-down" style={{position:'absolute',top:'calc(100% + 8px)',right:0,background:'var(--bg-2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius)',minWidth:'300px',maxWidth:'340px',overflow:'hidden',zIndex:100}}>
              <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',fontSize:'12px',fontWeight:'600',color:'var(--text-1)'}}>Alertas</div>
              {alerts.length === 0 && expiryAlerts.length === 0 ? (
                <div style={{padding:'20px',textAlign:'center',fontSize:'13px',color:'var(--text-3)'}}>Tudo em ordem ✓</div>
              ) : (
                <>
                  {alerts.map(a => (
                    <div key={a.id} style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div><div style={{fontSize:'13px',fontWeight:'500',color:'var(--text-1)'}}>{a.name}</div><div style={{fontSize:'11px',color:'var(--text-3)'}}>{a.category||'—'} · {a.quantity} (mín {a.min_stock})</div></div>
                      <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'99px',background:'var(--empty-dim)',color:'var(--empty)',fontWeight:'500',flexShrink:0,marginLeft:'8px'}}>{a.quantity===0?'Zerado':'Baixo'}</span>
                    </div>
                  ))}
                  {expiryAlerts.map(a => (
                    <div key={a.id+'-exp'} style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div><div style={{fontSize:'13px',fontWeight:'500',color:'var(--text-1)'}}>{a.name}</div><div style={{fontSize:'11px',color:'var(--text-3)'}}>{a.category||'—'} · vence em {a.daysUntilExpiry}d</div></div>
                      <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'99px',background:'var(--low-dim)',color:'var(--low)',fontWeight:'500',flexShrink:0,marginLeft:'8px'}}>{(a.daysUntilExpiry||0)<0?'Vencido':'Expirando'}</span>
                    </div>
                  ))}
                  <Link href="/relatorios" style={{display:'block',padding:'10px 14px',fontSize:'12px',color:'var(--brand-light)',textDecoration:'none',textAlign:'center'}} onClick={() => setAlertOpen(false)}>Ver relatório completo →</Link>
                </>
              )}
            </div>
          )}
        </div>

        {/* User dropdown desktop */}
        <div ref={userRef} style={{position:'relative'}} className="desktop-nav">
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
                <button onClick={() => { setUserOpen(false); window.location.href = '/selecionar-igreja' }} style={{width:'100%',padding:'10px 14px',background:'transparent',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--text-2)',transition:'background 0.1s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg-3)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  Selecionar Igreja
                </button>
              )}
              {permission !== 'granted' && !subscribed && (
          <button onClick={requestPermission} style={{width:'100%',padding:'10px 16px',background:'transparent',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'12px',color:'var(--brand-light)',transition:'background 0.1s'}}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-3)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
            <span style={{fontSize:'14px'}}>Ativar notificações</span>
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

        {/* Mobile — sino + hamburguer direita */}
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginLeft:'auto'}} className="mobile-menu-btn">
          {/* Sino mobile */}
          <div ref={alertRef} style={{position:'relative'}}>
            <button onClick={() => setAlertOpen(o => !o)} style={{position:'relative',width:'34px',height:'34px',borderRadius:'var(--radius-sm)',background:alertOpen?'var(--bg-3)':'var(--bg-2)',border:'1px solid var(--border-md)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasAlerts ? 'var(--low)' : 'var(--text-3)'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
              {hasAlerts && <span style={{position:'absolute',top:'-4px',right:'-4px',width:'16px',height:'16px',borderRadius:'50%',background:'var(--empty)',fontSize:'9px',fontWeight:'700',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid var(--bg)'}}>{count > 9 ? '9+' : count}</span>}
            </button>
            {alertOpen && (
              <div className="slide-down" style={{position:'fixed',top:'52px',right:'8px',left:'8px',background:'var(--bg-2)',border:'1px solid var(--border-md)',borderRadius:'var(--radius)',overflow:'hidden',zIndex:200,maxHeight:'70vh',overflowY:'auto'}}>
                <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',fontSize:'12px',fontWeight:'600',color:'var(--text-1)'}}>Alertas</div>
                {alerts.map(a => (
                  <div key={a.id} style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div><div style={{fontSize:'13px',fontWeight:'500',color:'var(--text-1)'}}>{a.name}</div><div style={{fontSize:'11px',color:'var(--text-3)'}}>{a.category||'—'} · {a.quantity} (mín {a.min_stock})</div></div>
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
        </div>

      </div>
    </header>

    {/* Sidebar mobile overlay */}
    {menuOpen && (
      <div onClick={() => setMenuOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:300,backdropFilter:'blur(2px)'}} className="mobile-menu-btn"/>
    )}

    {/* Sidebar mobile painel */}
    <div className="mobile-menu-btn" style={{position:'fixed',top:0,left:0,bottom:0,width:'280px',background:'var(--bg-2)',zIndex:301,transform:menuOpen?'translateX(0)':'translateX(-100%)',transition:'transform 0.25s cubic-bezier(0.4,0,0.2,1)',display:'flex',flexDirection:'column'}}>

      {/* Links com scroll */}
      <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>

        {/* Dashboard */}
        {(()=>{ const act=active('/dashboard'); return (
          <Link href="/dashboard" onClick={()=>setMenuOpen(false)} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',textDecoration:'none',color:act?'var(--text-1)':'var(--text-2)',background:act?'rgba(99,102,241,0.08)':'transparent',transition:'background 0.1s',borderLeft:act?'3px solid var(--brand)':'3px solid transparent'}}>
            <span style={{color:act?'var(--brand-light)':'var(--text-3)',flexShrink:0}}><Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" size={16}/></span>
            <span style={{fontSize:'14px',fontWeight:act?'600':'400'}}>Dashboard</span>
          </Link>
        )})()}

        {/* Processos */}
        <div style={{padding:'12px 16px 4px',fontSize:'10px',fontWeight:'700',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',borderTop:'1px solid var(--border)',marginTop:'4px'}}>Processos</div>
        {[
          {href:'/estoque',label:'Estoque',icon:'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'},
          {href:'/movimentacoes',label:'Movimentação',icon:'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4'},
          {href:'/inventario',label:'Inventário Físico',icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'},
        ].map(n=>{ const act=active(n.href); return (
          <Link key={n.href} href={n.href} onClick={()=>setMenuOpen(false)} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',textDecoration:'none',color:act?'var(--text-1)':'var(--text-2)',background:act?'rgba(99,102,241,0.08)':'transparent',transition:'background 0.1s',borderLeft:act?'3px solid var(--brand)':'3px solid transparent'}}>
            <span style={{color:act?'var(--brand-light)':'var(--text-3)',flexShrink:0}}><Icon d={n.icon} size={16}/></span>
            <span style={{fontSize:'14px',fontWeight:act?'600':'400'}}>{n.label}</span>
          </Link>
        )})}

        {/* Relatórios */}
        <div style={{padding:'12px 16px 4px',fontSize:'10px',fontWeight:'700',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',borderTop:'1px solid var(--border)',marginTop:'4px'}}>Relatórios</div>
        {(()=>{ const act=active('/relatorios'); return (
          <Link href="/relatorios" onClick={()=>setMenuOpen(false)} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',textDecoration:'none',color:act?'var(--text-1)':'var(--text-2)',background:act?'rgba(99,102,241,0.08)':'transparent',transition:'background 0.1s',borderLeft:act?'3px solid var(--brand)':'3px solid transparent'}}>
            <span style={{color:act?'var(--brand-light)':'var(--text-3)',flexShrink:0}}><Icon d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={16}/></span>
            <span style={{fontSize:'14px',fontWeight:act?'600':'400'}}>Relatórios</span>
          </Link>
        )})()}

        {/* Mural — apenas Poiema BNU */}
        {isPoiemaBNU && <div key="mural-sec">
          <div style={{padding:"12px 16px 4px",fontSize:"10px",fontWeight:"700",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",borderTop:"1px solid var(--border)",marginTop:"4px"}}>Mural</div>
          {(()=>{ const act=active("/mural"); return (
            <Link href="/mural" onClick={()=>setMenuOpen(false)} style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 16px",textDecoration:"none",color:act?"var(--text-1)":"var(--text-2)",background:act?"rgba(99,102,241,0.08)":"transparent",transition:"background 0.1s",borderLeft:act?"3px solid var(--brand)":"3px solid transparent"}}>
              <span style={{color:act?"var(--brand-light)":"var(--text-3)",flexShrink:0}}><Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 110 8 4 4 0 010-8z" size={16}/></span>
              <span style={{fontSize:"14px",fontWeight:act?"600":"400"}}>Mural</span>
            </Link>
          )})()}
        </div>}

        {/* Cadastros */}
        {isAdmin && <>
          <div style={{padding:'12px 16px 4px',fontSize:'10px',fontWeight:'700',color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',borderTop:'1px solid var(--border)',marginTop:'4px'}}>Cadastros</div>
          {NAV_CADASTROS.map(n=>{ const act=active(n.href); return (
            <Link key={n.href} href={n.href} onClick={()=>setMenuOpen(false)} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',textDecoration:'none',color:act?'var(--text-1)':'var(--text-2)',background:act?'rgba(99,102,241,0.08)':'transparent',transition:'background 0.1s',borderLeft:act?'3px solid var(--brand)':'3px solid transparent'}}>
              <span style={{color:act?'var(--brand-light)':'var(--text-3)',flexShrink:0}}><Icon d={n.icon} size={16}/></span>
              <span style={{fontSize:'14px',fontWeight:act?'600':'400'}}>{n.label}</span>
            </Link>
          )})}
        </>}
      </div>

      {/* Footer sidebar */}
      <div style={{borderTop:'1px solid var(--border)',padding:'8px 0'}}>
        <div style={{padding:'10px 16px 6px',display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'var(--brand-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:'700',color:'var(--brand-light)',flexShrink:0}}>
            {(profile?.name||profile?.email||'?').charAt(0).toUpperCase()}
          </div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:'var(--text-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.name||profile?.email}</div>
            <div style={{fontSize:'10px',color:'var(--brand-light)',marginTop:'1px'}}>{churchName}</div>
          </div>
        </div>
        {profile?.churches && profile.churches.length > 1 && (
          <button onClick={() => { setMenuOpen(false); window.location.href = '/selecionar-igreja' }} style={{width:'100%',padding:'10px 16px',background:'transparent',border:'none',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'12px',color:'var(--text-2)',transition:'background 0.1s'}}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-3)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span style={{fontSize:'14px'}}>Selecionar Igreja</span>
          </button>
        )}
        <button onClick={logout} style={{width:'100%',padding:'10px 16px',background:'transparent',border:'none',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'12px',color:'var(--empty)',transition:'background 0.1s'}}
          onMouseEnter={e=>e.currentTarget.style.background='var(--bg-3)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          <span style={{fontSize:'14px'}}>Sair da conta</span>
        </button>
      </div>
    </div>
    </>
  )
}
