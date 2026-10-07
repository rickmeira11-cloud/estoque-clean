'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const tooltipStyle = { background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-1)' }

type LocEntry = { name: string; entradas: number; saidas: number }

export default function RelatoriosDepositsChart({ data }: { data: LocEntry[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false}/>
        <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false}/>
        <Tooltip contentStyle={tooltipStyle}/>
        <Bar dataKey="entradas" name="Entradas" fill="var(--ok)"    radius={[4, 4, 0, 0]}/>
        <Bar dataKey="saidas"   name="Saídas"   fill="var(--empty)" radius={[4, 4, 0, 0]}/>
      </BarChart>
    </ResponsiveContainer>
  )
}
