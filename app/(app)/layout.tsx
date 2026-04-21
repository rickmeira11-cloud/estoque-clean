import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (<div style={{display:'flex',minHeight:'100vh'}}><Sidebar/><main style={{marginLeft:'220px',flex:1,padding:'28px 32px',background:'var(--bg)',minHeight:'100vh'}}>{children}</main></div>)
}
