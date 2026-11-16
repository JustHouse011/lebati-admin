import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { aggregate, displayPeriod, formatCount, formatMoney, formatRate, months, showMeasure,
  type Category, type Cohort, type GeoFilters, type MapMeasure, type Metrics } from './geographicRisk'
import type { AreaRow } from './GeographicMap'

export function ProvinceComparison({ rows, measure, onChoose }: {
  rows: AreaRow[]; measure: MapMeasure; onChoose: (area: AreaRow['area']) => void
}) {
  const sorted = [...rows].sort((a, b) => (b.metrics?.[measure] ?? -1) - (a.metrics?.[measure] ?? -1))
  const max = sorted[0]?.metrics?.[measure] ?? 0
  return <section className="settings-card min-w-0">
    <h3 className="mb-1 text-lg">Provincial comparison</h3>
    <p className="mb-4 text-xs opacity-75">All provinces in the selected reporting scope. Select a province to explore it.</p>
    <div className="space-y-2">
      {sorted.map(({ area, metrics }) => {
        const value = metrics?.[measure]
        return <button key={area.id} type="button" onClick={() => onChoose(area)} className="block w-full rounded-md p-1.5 text-left hover:bg-teal/10 focus-visible:outline-2 focus-visible:outline-teal">
          <span className="flex flex-wrap justify-between gap-x-2 text-sm">
            <span>{area.name}</span><span>{value == null ? 'Unavailable' : showMeasure(measure, value)}</span>
          </span>
          <span className="mt-1.5 block h-1.5 rounded-full bg-slate-400/25" aria-hidden="true">
            <span className="block h-full rounded-full bg-teal" style={{ width: max && value ? 100 * value / max + '%' : 0 }} />
          </span>
        </button>
      })}
    </div>
  </section>
}

export function GeographicTrends({ data, filters }: { data: Cohort[]; filters: GeoFilters }) {
  const [period, setPeriod] = useState<'month' | 'quarter'>('month')
  const [measure, setMeasure] = useState<MapMeasure | 'categorySpend'>('gamblingCents')
  const money = measure === 'gamblingCents' || measure === 'categorySpend'
  const display = (value: number) => measure === 'categorySpend' ? formatMoney(value) : showMeasure(measure, value)
  const ranges = new Map<string, string[]>()
  months.filter((month) => month >= filters.from && month <= filters.to).forEach((month) => {
    const key = period === 'month' ? month : month.slice(0, 4) + ' Q' + Math.ceil(Number(month.slice(5)) / 3)
    ranges.set(key, [...(ranges.get(key) ?? []), month])
  })
  const points = Array.from(ranges, ([name, dates]) => {
    const subrange = { from: dates[0], to: dates[dates.length - 1] }
    const metrics = aggregate(data, { ...filters, ...subrange })
    const value = measure === 'categorySpend' ? metrics?.spending.reduce((total, category) => total + category.cents, 0) : metrics?.[measure]
    return { name, reportingPeriod: displayPeriod(subrange.from, subrange.to), value: value ?? null, count: metrics?.monitored ?? null }
  })
  return <section className="settings-card min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-lg">Risk and spending trends</h3>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Trend interval" value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} className="settings-input text-xs">
          <option value="month">Monthly</option><option value="quarter">Quarterly</option>
        </select>
        <select aria-label="Trend measure" value={measure} onChange={(event) => setMeasure(event.target.value as typeof measure)} className="settings-input text-xs">
          <option value="gamblingCents">Gambling spend</option><option value="categorySpend">{filters.category || 'All merchant'} spend</option>
          <option value="eventRate">Events per 1,000</option><option value="prevalence">Affected share</option>
        </select>
      </div>
    </div>
    {points.some((point) => point.value !== null) ? <>
      <div className="h-56 min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={points}>
            <CartesianGrid vertical={false} stroke="#94a3b8" strokeOpacity={0.25} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis width={66} tick={{ fontSize: 11 }} tickFormatter={(value) => money ? 'R' + Intl.NumberFormat('en-ZA', { notation: 'compact' }).format(value / 100) : formatRate(value)} />
            <Tooltip formatter={(value) => display(Number(value))} contentStyle={{ background: '#102235', color: 'white', borderRadius: 10 }} itemStyle={{ color: 'white' }} />
            <Bar name="Recorded value" dataKey="value" fill="#087E87" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm"><summary className="cursor-pointer">Reporting periods and denominators</summary>
        <ul className="mt-2 space-y-2">{points.map((point) => <li key={point.name}>{point.name} ({point.reportingPeriod}) · {point.value === null ? 'Unavailable' : display(point.value) + ' · ' + formatCount(point.count ?? 0) + ' monitored'}</li>)}</ul>
      </details>
    </> : <p className="my-8 text-sm opacity-75">No reportable trend data.</p>}
  </section>
}

export function MerchantBreakdown({ metrics, onChoose }: { metrics: Metrics | null; onChoose: (category: Category) => void }) {
  const spending = [...(metrics?.spending ?? [])].sort((a, b) => b.cents - a.cents)
  const max = spending[0]?.cents ?? 0
  return <section className="settings-card">
    <h3 className="mb-1 text-lg">Merchant category breakdown</h3>
    <p className="mb-4 text-xs opacity-75">Recorded spending by category. A category alone does not determine a review outcome.</p>
    {max ? <div className="space-y-2">{spending.filter((item) => item.cents > 0).map(({ category, cents, transactions }) =>
      <button key={category} type="button" onClick={() => onChoose(category)} className="block w-full rounded-md p-1.5 text-left hover:bg-teal/10 focus-visible:outline-2 focus-visible:outline-teal">
        <span className="flex flex-wrap justify-between gap-x-2 text-sm">
          <span>{category}</span><span>{formatMoney(cents)} · {formatCount(transactions)} transactions</span>
        </span>
        <span className="mt-1.5 block h-1.5 rounded-full bg-slate-400/25" aria-hidden="true"><span className="block h-full rounded-full bg-teal" style={{ width: 100 * cents / max + '%' }} /></span>
      </button>)}</div> : <p className="my-8 text-sm opacity-75">No recorded spending matches these filters.</p>}
  </section>
}
