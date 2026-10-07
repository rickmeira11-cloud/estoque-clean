'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'

const tooltipStyle = { background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-1)' }

type BarEntry = { name: string; value: number; fill?: string }

export default function RelatoriosBarChart({
  data, layout = 'vertical', barSize = 20, height,
}: {
  data: BarEntry[]
  layout?: 'vertical' | 'horizontal'
  barSize?: number
  height?: number
}) {
  const isVertical = layout === 'vertical'
  return (
    <ResponsiveContainer width="100%" height={height ?? '100%'}>
      <BarChart data={data} layout={layout} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={!isVertical} vertical={isVertical}/>
        {isVertical
          ? <>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} width={100}/>
            </>
          : <>
              <XAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false}/>
              <YAxis type="number" tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} width={32}/>
            </>
        }
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}/>
        <Bar dataKey="value" barSize={barSize} radius={[4, 4, 4, 4]}>
          {data.map((entry: BarEntry, i: number) => <Cell key={i} fill={entry.fill ?? '#6366f1'}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
