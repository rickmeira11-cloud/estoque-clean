'use client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const tooltipStyle = { background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-1)' }

export default function DashboardPieChart({ data, colors }: { data: { name: string; value: number }[]; colors: string[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="45%" outerRadius={80} dataKey="value" label={false}>
          {data.map((_: unknown, i: number) => <Cell key={i} fill={colors[i % colors.length]}/>)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle}/>
        <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '12px' }}/>
      </PieChart>
    </ResponsiveContainer>
  )
}
