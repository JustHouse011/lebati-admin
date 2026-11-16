import { MapPin } from 'lucide-react'
import { useId } from 'react'
import { showMeasure, geographyLevels, type Area, type MapMeasure, type Metrics } from './geographicRisk'

export type AreaRow = { area: Area; metrics: Metrics | null }
const measures: Record<MapMeasure, string> = {
  eventRate: 'Review events per 1,000',
  gamblingCents: 'Gambling spend (ZAR)',
  prevalence: 'Affected participants (%)',
}
const shades = ['#d5f0eb', '#8acdc3', '#398f87', '#13625c']

export default function GeographicMap({ selected, trail, rows, measure, onMeasure, onSelect }: {
  selected: Area
  trail: Area[]
  rows: AreaRow[]
  measure: MapMeasure
  onMeasure: (measure: MapMeasure) => void
  onSelect: (area: Area) => void
}) {
  const pattern = useId()
  const max = Math.max(0, ...rows.map(({ metrics }) => metrics?.[measure] ?? 0))
  const shade = (value: number) => shades[max ? Math.min(3, Math.floor(value / max * 4)) : 0]
  const activate = (event: React.KeyboardEvent<SVGElement>, area: Area) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(area)
    }
  }
  const frame = selected.frame ?? trail[trail.length - 2]?.frame
  const outline = selected.path ?? trail[trail.length - 2]?.path
  return (
    <section className="settings-card min-w-0" aria-label="South Africa choropleth">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg"><MapPin size={18} aria-hidden="true" /> {selected.name}</h3>
          <p className="mt-1 text-xs opacity-70">{geographyLevels[selected.level]} · {rows.length ? 'Select an area to drill down' : 'Selected area'}</p>
        </div>
        <label className="grid gap-1 text-xs">Map measure
          <select aria-label="Map measure" value={measure} onChange={(event) => onMeasure(event.target.value as MapMeasure)} className="settings-input max-w-full">
            {Object.entries(measures).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
      </div>
      <svg viewBox={frame?.join(' ')} role="group" aria-label={selected.name + ' interactive map'}
        className="h-[24rem] w-full rounded-2xl border border-slate-200 bg-[#F8FAFB] sm:h-[31rem]">
        <defs><pattern id={pattern} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#e2e8f0" /><line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="2" />
        </pattern></defs>
        {outline && <path d={outline} fill="#a4b4c055" stroke="#64748b" vectorEffect="non-scaling-stroke" />}
        {rows.map(({ area, metrics }) => {
          const value = metrics?.[measure]
          const title = area.name + ' · ' + (value == null ? 'No reportable coverage' : showMeasure(measure, value))
          const fill = value == null ? 'url(#' + pattern + ')' : shade(value)
          const interactive = {
            tabIndex: 0, role: 'button', 'aria-label': title, onClick: () => onSelect(area),
            onKeyDown: (event: React.KeyboardEvent<SVGElement>) => activate(event, area),
            className: 'cursor-pointer stroke-slate-600 focus-visible:stroke-[#b68531] focus-visible:stroke-[3] hover:stroke-[#b68531] hover:stroke-[2]',
          }
          if (area.path) return <path key={area.id} {...interactive} d={area.path} fill={fill} vectorEffect="non-scaling-stroke"><title>{title}</title></path>
          if (area.point) return <svg key={area.id} x={area.point[0]} y={area.point[1]} overflow="visible" width="0" height="0">
            <circle {...interactive} r={(frame?.[2] ?? 100) * 0.02} fill={fill} vectorEffect="non-scaling-stroke"><title>{title}</title></circle>
          </svg>
          return null
        })}
        {selected.point && <circle cx={selected.point[0]} cy={selected.point[1]} r={(frame?.[2] ?? 100) * 0.02} fill="#b68531" stroke="#102235" vectorEffect="non-scaling-stroke"><title>{selected.name}</title></circle>}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs" aria-label={measures[measure] + ' legend'}>
        <span>{measures[measure]}</span>
        {shades.map((color, index) => max > 0 && <span key={color} className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ background: color }} aria-hidden="true" />
          {showMeasure(measure, max * index / 4)}–{showMeasure(measure, max * (index + 1) / 4)}
        </span>)}
        {max === 0 && <span>0 for reportable areas</span>}
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: 'repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0 3px,#94a3b8 3px,#94a3b8 5px)' }} aria-hidden="true" /> No reportable coverage</span>
      </div>
    </section>
  )
}
