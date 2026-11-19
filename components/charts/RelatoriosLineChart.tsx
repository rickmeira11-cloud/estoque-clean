'use client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const tooltipStyle = { background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-1)' }

export default function RelatoriosLineChart({ data }: { data: { label: string; entradas: number; saidas: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}/>
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={32}/>
        <Tooltip contentStyle={tooltipStyle}/>
        <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '12px' }}/>
        <Line type="monotone" dataKey="entradas" name="Entradas" stroke="var(--ok)"    strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }}/>
        <Line type="monotone" dataKey="saidas"   name="Saídas"   stroke="var(--empty)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }}/>
      </LineChart>
    </ResponsiveContainer>
  )
}
