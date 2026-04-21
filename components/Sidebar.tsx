'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
const NAV = [{href:'/dashboard',label:'Dashboard',icon:'▦'},{href:'/estoque',label:'Estoque',icon:'◫'},{href:'/movimentacoes',label:'Movimentar',icon:'⇅'},{href:'/historico',label:'Histórico',icon:'◷'}]
const NAV_ADMIN = [{href:'/admin/usuarios',label:'Usuários',icon:'◉'},{href:'/admin/igrejas',label:'Igrejas',icon:'◈'}]
export function Sidebar() {
  const pathname = usePathname(); const router = useRouter(); const { profile, isAdmin } = useProfile()
  async function logout() { await createClient().auth.signOut(); router.push('/login') }
  function navItem(href:string,label:string,icon:string) {
    const active = pathname===href||(href!=='/dashboard'&&pathname.startsWith(href))
    return (<Link key={href} href={href} style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 12px',borderRadius:'8px',textDecoration:'none',fontSize:'13px',fontWeight:active?'500':'400',color:active?'#fff':'var(--text-2)',background:active?'var(--brand-dim)':'transparent',borderLeft:active?'2px solid var(--brand)':'2px solid transparent',transition:'all 0.15s',marginBottom:'2px'}}><span style={{fontSize:'14px',opacity:active?1:0.5}}>{icon}</span>{label}</Link>)
  }
  return (
    <aside style={{width:'220px',height:'100vh',position:'fixed',left:0,top:0,background:'var(--bg-2)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',zIndex:40}}>
      <div style={{padding:'20px 16px',flex:1,overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'28px',padding:'0 4px'}}>
          <div style={{width:'32px',height:'32px',borderRadius:'8px',background:'var(--brand)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px',fontWeight:'700',color:'#fff',flexShrink:0}}>P</div>
          <div><div style={{fontSize:'13px',fontWeight:'600',color:'var(--text-1)',lineHeight:1}}>Poiema</div><div style={{fontSize:'10px',color:'var(--text-3)',marginTop:'2px'}}>{profile?.church?.name||'Estoque'}</div></div>
        </div>
        <nav>{NAV.map(n=>navItem(n.href,n.label,n.icon))}</nav>
        {isAdmin&&(<><div style={{fontSize:'10px',color:'var(--text-3)',margin:'18px 0 6px 14px',letterSpacing:'0.08em',textTransform:'uppercase'}}>Admin</div><nav>{NAV_ADMIN.map(n=>navItem(n.href,n.label,n.icon))}</nav></>)}
      </div>
      <div style={{padding:'14px 16px',borderTop:'1px solid var(--border)'}}>
        {profile&&(<div style={{marginBottom:'10px',padding:'0 4px'}}><div style={{fontSize:'12px',fontWeight:'500',color:'var(--text-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile.name||profile.email}</div><div style={{fontSize:'11px',color:'var(--text-3)',marginTop:'2px'}}>{{super_admin:'Super Admin',admin:'Administrador',operator:'Operador',viewer:'Visualizador'}[profile.role]}</div></div>)}
        <button onClick={logout} style={{width:'100%',padding:'7px',borderRadius:'8px',background:'transparent',border:'1px solid var(--border)',color:'var(--text-2)',fontSize:'12px',cursor:'pointer'}} onMouseEnter={e=>{(e.currentTarget).style.borderColor='var(--empty)';(e.currentTarget).style.color='var(--empty)'}} onMouseLeave={e=>{(e.currentTarget).style.borderColor='var(--border)';(e.currentTarget).style.color='var(--text-2)'}}>Sair</button>
      </div>
    </aside>
  )
}
