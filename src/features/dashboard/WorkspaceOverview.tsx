import { ArrowUpRight, Download } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { type RecordItem, type Workspace, workspaces } from './workspaceData'

import { downloadCsv, filterRecords, matchesStatus, recordFilters, type Filters } from './workspaceRecords'

export function WorkspaceFilters({ programmes }: { programmes: RecordItem[] }) {
  const [params, setParams] = useSearchParams()
  const filters = recordFilters(params)
  const setFilter = (key: keyof Filters, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true, flushSync: true })
  }
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid min-w-0 gap-1 text-xs">Programme
        <select aria-label="Programme" className="settings-input" value={filters.programme} onChange={(event) => setFilter('programme', event.target.value)}>
          <option value="">All programmes</option>
          {programmes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs">From
        <input type="date" className="settings-input" max={filters.to || undefined} value={filters.from} onChange={(event) => setFilter('from', event.target.value)} />
      </label>
      <label className="grid gap-1 text-xs">To
        <input type="date" className="settings-input" min={filters.from || undefined} value={filters.to} onChange={(event) => setFilter('to', event.target.value)} />
      </label>
    </div>
  )
}

function Chart({ title, data, series }: { title: string; data: { name: string; [key: string]: number | string }[]; series: string[] }) {
  const titleId = useId()
  const [selected, setSelected] = useState('')
  return (
    <section className="settings-card min-w-0" aria-labelledby={titleId}>
      <h3 id={titleId} className="mb-4 text-lg">{title}</h3>
      {data.length ? <>
        <div className="h-56 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={data} margin={{ left: -18, right: 12 }}>
              <CartesianGrid vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#102235', color: 'white', borderRadius: 10 }} itemStyle={{ color: 'white' }} />
              {series.length > 1 && <Legend />}
              {series.map((key, index) => <Bar key={key} dataKey={key} fill={index === 0 ? '#087E87' : '#C6A66B'} radius={[4, 4, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <label className="mt-2 flex flex-wrap items-center gap-2 text-sm">Chart values
          <select aria-label="Chart values" className="settings-input" value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Select a group</option>
            {data.map((point) => <option key={point.name}>{point.name}</option>)}
          </select>
        </label>
        {data.filter((point) => point.name === selected).map((point) =>
          <p key={point.name} className="mt-2 text-sm">{series.map((key) => key + ' ' + point[key]).join(' · ')}</p>)}
      </> : <p className="py-12 text-sm opacity-75">No records match these filters.</p>}
    </section>
  )
}

function group(records: RecordItem[], field: (record: RecordItem) => string, label: string) {
  const counts = new Map<string, number>()
  for (const record of records) {
    const name = field(record)
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, [label]: count }))
}

function monthly(records: RecordItem[]) {
  const periods = new Map<string, { name: string; Transactions: number; Indicators: number; Reviews: number }>()
  const series = { transaction: 'Transactions', risk: 'Indicators', verification: 'Reviews' } as const
  for (const record of records) {
    if (record.kind !== 'transaction' && record.kind !== 'risk' && record.kind !== 'verification') continue
    const month = record.date.slice(0, 7)
    const values = periods.get(month) ?? { name: month, Transactions: 0, Indicators: 0, Reviews: 0 }
    if (record.kind !== 'verification' || record.status === 'Reviewed') values[series[record.kind]]++
    periods.set(month, values)
  }
  return [...periods.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export default function WorkspaceOverview({ workspace, records, reports = false }: { workspace: Workspace; records: RecordItem[]; reports?: boolean }) {
  const [params] = useSearchParams()
  const filtered = filterRecords(records, recordFilters(params))
  const programmes = records.filter((item) => item.kind === 'programme')
  const programmeName = (id: string) => programmes.find((item) => item.id === id)?.name ?? ''
  const metrics = [
    { label: workspace === 'nsfas' ? 'Enrolled students' : workspace === 'sassa' ? 'Enrolled beneficiaries' : 'Enrolled records', kind: 'person', path: 'beneficiary-registry', status: 'Active' },
    { label: 'Active programmes', kind: 'programme', path: 'programmes', status: 'Active' },
    { label: 'Transactions analysed', kind: 'transaction', path: 'transactions' },
    { label: 'Flagged risk events', kind: 'risk', path: 'risk-intelligence', status: 'Open' },
    { label: 'Pending verifications', kind: 'verification', path: 'verifications', status: 'Pending' },
    { label: 'Active restrictions', kind: 'restriction', path: 'restrictions', status: 'Active restrictions' },
    { label: 'Open compliance cases', kind: 'case', path: 'cases', status: 'Unresolved' },
    { label: 'Completed reviews', kind: 'verification', path: 'verifications', status: 'Reviewed' },
    { label: 'Unverified merchants', kind: 'merchant', path: 'merchants', status: 'Unverified' },
    { label: 'Completed support plans', kind: 'intervention', path: 'interventions', status: 'Completed' },
  ] as const
  const trend = monthly(filtered)
  const people = filtered.filter((item) => item.kind === 'person')
  const transactions = filtered.filter((item) => item.kind === 'transaction')
  const cases = filtered.filter((item) => item.kind === 'case')
  const support = filtered.filter((item) => item.kind === 'intervention')
  return (
    <div className="space-y-5">
      <section className="settings-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest text-teal">{workspaces[workspace]}</p>
            <h2 className="text-2xl">{reports ? 'Reports & Analytics' : workspace === 'global' ? 'Global Command Centre' : 'Programme Overview'}</h2>
            <p className="mt-2 text-sm opacity-75">Fictional records for analysis. Changes are saved in this browser.</p>
          </div>
          {reports && <button className="settings-button" type="button" onClick={() => downloadCsv(workspace + '-report', [
            ['Reference', 'Type', 'Workspace', 'Programme', 'Name', 'Date', 'Status', 'Amount (ZAR)'],
            ...filtered.map((item) => [item.id, item.kind, workspaces[item.workspace], programmeName(item.programme), item.name, item.date, item.status, item.amount ?? '']),
          ])}><Download size={16} aria-hidden="true" /> Export CSV</button>}
        </div>
        <div className="mt-5"><WorkspaceFilters programmes={programmes} /></div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {metrics.map((metric) => {
          const search = new URLSearchParams(params)
          if ('status' in metric) search.set('status', metric.status)
          const count = filtered.filter((item) => item.kind === metric.kind && matchesStatus(item.status, 'status' in metric ? metric.status : '')).length
          return <Link key={metric.label} className="settings-card relative block transition hover:border-teal focus-visible:outline-2 focus-visible:outline-teal" to={'/dashboard/' + metric.path + '?' + search}>
            <ArrowUpRight className="absolute right-3 top-3 opacity-60" size={16} aria-hidden="true" />
            <div className="text-3xl">{count}</div>
            <div className="mt-2 text-sm">{metric.label}</div>
          </Link>
        })}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Chart title="Transaction activity" data={trend} series={['Transactions']} />
        <Chart title="Risk and compliance activity" data={trend} series={['Indicators', 'Reviews']} />
        <Chart title="Programme distribution" data={group(people, (item) => programmeName(item.programme), 'Records')} series={['Records']} />
        <Chart title="Case resolution" data={group(cases, (item) => item.status, 'Cases')} series={['Cases']} />
        <Chart title="Merchant classifications" data={group(transactions, (item) => item.fields.Category, 'Transactions')} series={['Transactions']} />
        <Chart title="Institutional enrolment" data={group(people, (item) => item.fields.Institution, 'Records')} series={['Records']} />
        <Chart title="Financial wellbeing" data={group(support, (item) => item.status, 'Interventions')} series={['Interventions']} />
      </div>
    </div>
  )
}
