import { ArrowDownUp, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { formatCount, formatMoney, formatRate, type Area, type Metrics } from './geographicRisk'

export type RankingRow = { id: string; label: string; metrics: Metrics | null; area?: Area }
const columns = [
  { key: 'monitored', label: 'Monitored', format: formatCount },
  { key: 'gamblingTransactions', label: 'Gambling transactions', format: formatCount },
  { key: 'gamblingCents', label: 'Gambling spend', format: formatMoney },
  { key: 'prevalence', label: 'Affected share (%)', format: formatRate },
  { key: 'eventRate', label: 'Review events per 1,000', format: formatRate },
  { key: 'flaggedTransactionRate', label: 'Flagged transactions (%)', format: formatRate },
] as const
type SortKey = typeof columns[number]['key']

export default function GeographicRankings({ rows, scope, onOpen }: {
  rows: RankingRow[]
  scope: string
  onOpen: (row: RankingRow) => void
}) {
  const [sort, setSort] = useState<{ key: SortKey; direction: 'ascending' | 'descending' }>({ key: 'eventRate', direction: 'descending' })
  const [page, setPage] = useState(0)
  const sorted = rows.filter(({ metrics }) => metrics).sort((a, b) => {
    const left = a.metrics?.[sort.key], right = b.metrics?.[sort.key]
    if (left == null && right != null) return 1
    if (right == null && left != null) return -1
    return (sort.direction === 'ascending' ? 1 : -1) * ((left ?? 0) - (right ?? 0)) || a.label.localeCompare(b.label)
  })
  const active = Math.min(page, Math.max(0, Math.ceil(sorted.length / 10) - 1))
  if (!sorted.length) return <p className="mt-4 text-sm opacity-75">No reportable {scope.toLowerCase()} match the selected scope.</p>
  return <>
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead><tr className="border-b border-slate-200">
          <th scope="col" className="px-2 py-3">{scope}</th>
          {columns.map((column) => <th key={column.key} scope="col" className="px-2 py-3" aria-sort={sort.key === column.key ? sort.direction : undefined}>
            <button type="button" className="inline-flex items-center gap-1 text-left text-xs hover:underline" onClick={() => {
              setPage(0)
              setSort({ key: column.key, direction: sort.key === column.key && sort.direction === 'descending' ? 'ascending' : 'descending' })
            }}>{column.label}<ArrowDownUp size={13} aria-hidden="true" /></button>
          </th>)}
        </tr></thead>
        <tbody>{sorted.slice(active * 10, (active + 1) * 10).map((row) => <tr key={row.id} className="border-b border-slate-200 last:border-0">
          <th scope="row" className="px-2 py-3"><button type="button" onClick={() => onOpen(row)} className="inline-flex items-center gap-1 text-left underline-offset-4 hover:underline">
            {row.label}<ArrowUpRight size={13} aria-hidden="true" /></button></th>
          {columns.map(({ key, format }) => <td className="whitespace-nowrap px-2 py-3" key={key}>{row.metrics?.[key] == null ? '—' : format(row.metrics[key])}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    {sorted.length > 10 && <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <button type="button" className="settings-button secondary" onClick={() => setPage(active - 1)} disabled={active === 0}>Previous</button>
      <span className="text-xs">{active * 10 + 1}–{Math.min((active + 1) * 10, sorted.length)} of {sorted.length}</span>
      <button type="button" className="settings-button secondary" onClick={() => setPage(active + 1)} disabled={(active + 1) * 10 >= sorted.length}>Next</button>
    </div>}
  </>
}
