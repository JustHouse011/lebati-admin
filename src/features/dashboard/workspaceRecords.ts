import type { RecordItem } from './workspaceData'

export type Filters = { from: string; to: string; programme: string }

export function filterRecords(records: RecordItem[], { from, to, programme }: Filters) {
  return records.filter((record) => (!programme || record.programme === programme) &&
    (!from || record.date >= from) && (!to || record.date <= to))
}

export function recordFilters(params: URLSearchParams): Filters {
  return { from: params.get('from') ?? '', to: params.get('to') ?? '', programme: params.get('programme') ?? '' }
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map((value) => {
    const text = String(value)
    const safe = typeof value === 'string' && /^[\s]*[=+\-@]/.test(text) ? "'" + text : text
    return '"' + safe.replaceAll('"', '""') + '"'
  }).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename + '.csv'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function matchesStatus(status: string, filter: string) {
  if (filter === 'Unresolved') return ['Open', 'Under review', 'Appealed'].includes(status)
  if (filter === 'Active restrictions') return ['TEMPORARILY_RESTRICTED', 'RESTRICTED', 'UNDER_REVIEW'].includes(status)
  return !filter || filter === status
}
