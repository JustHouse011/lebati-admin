import { Bot, Download, MapPin, Search, X } from 'lucide-react'
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { downloadCsv } from '../dashboard/workspaceRecords'
import { AssistantContext } from '../assistant/assistantContext'
import { GeographicTrends, MerchantBreakdown, ProvinceComparison } from './GeographicCharts'
import GeographicMap from './GeographicMap'
import GeographicRankings, { type RankingRow } from './GeographicRankings'
import {
  aggregate, allowedProgrammes, authorisedCohorts, categories, classifications, country, defaultFilters,
  displayPeriod, formatCount, formatMoney, formatRate, geographyLevels, indexGeography, minimumCohort, months,
  reportRows, syntheticCohorts, type Area, type GeoAccess, type GeoFilters, type GeoWorkspace, type Geography, type MapMeasure, type Metrics,
} from './geographicRisk'

const scopeLabels = { global: 'Global', nsfas: 'NSFAS', sassa: 'SASSA' }
const rankingLevels = { districts: 2, municipalities: 3, towns: 4, institutions: -1 } as const
const rankingLabels = { districts: 'Districts and metros', municipalities: 'Municipalities', towns: 'Towns and cities', institutions: 'University and TVET cohorts' }
type RankingLevel = keyof typeof rankingLevels
type SortableMetric = { label: string; value: string; note: string }

function MetricCards({ metrics, workspace, month, compact = false }: { metrics: Metrics | null; workspace: GeoWorkspace; month: string; compact?: boolean }) {
  if (!metrics) return <div className="settings-card text-sm" role="status">No reportable coverage for this area and filter combination.</div>
  const rate = (value: number | null, suffix = '') => value == null ? '—' : formatRate(value) + suffix
  const cards: SortableMetric[] = [
    { label: workspace === 'nsfas' ? 'Monitored students' : workspace === 'sassa' ? 'Monitored beneficiaries' : 'Monitored participants', value: formatCount(metrics.monitored), note: 'Distinct participants in the reporting period' },
    { label: workspace === 'nsfas' ? 'Students with gambling transactions' : 'Participants with gambling transactions', value: formatCount(metrics.affected), note: rate(metrics.prevalence, '%') + ' of monitored participants' },
    { label: 'Gambling-related transactions', value: formatCount(metrics.gamblingTransactions), note: 'Recorded transactions' },
    { label: 'Gambling-related spend', value: formatMoney(metrics.gamblingCents), note: 'Total observed volume in ZAR' },
    { label: 'Average spend per affected participant', value: metrics.averageCents == null ? '—' : formatMoney(metrics.averageCents), note: 'Spend divided by distinct affected participants' },
    { label: 'Share of observed spending', value: rate(metrics.spendingShare, '%'), note: 'Gambling spend divided by all observed spend' },
    { label: 'Risk events per 1,000 monitored', value: rate(metrics.eventRate), note: formatCount(metrics.flaggedEvents) + ' transactions flagged for review' },
  ]
  if (workspace !== 'nsfas') cards.push(
    { label: 'Unusual spending indicators', value: formatCount(metrics.unusual), note: 'As of ' + month + ' · all merchant categories only' },
    { label: 'Open financial wellness referrals', value: formatCount(metrics.referrals), note: 'As of ' + month + ' · independent of merchant filter' },
    { label: 'Cases awaiting human review', value: formatCount(metrics.cases), note: 'As of ' + month + ' · independent of merchant filter' },
  )
  return <dl className={compact ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4'}>
    {cards.map(({ label, value, note }) => <div key={label} className="settings-card min-w-0">
      <dt className="text-sm">{label}</dt><dd className="mt-2 break-words text-2xl">{value}</dd><p className="mt-2 text-xs opacity-75">{note}</p>
    </div>)}
  </dl>
}

function SelectFilter({ label, value, onChange, children }: {
  label: string; value: string; onChange: (value: string) => void; children: ReactNode
}) {
  return <label className="grid min-w-0 gap-1 text-xs">{label}
    <select aria-label={label} className="settings-input max-w-full" value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
  </label>
}

function AreaDrawer({ row, workspace, filters, onClose, onDrill }: {
  row: RankingRow; workspace: GeoWorkspace; filters: GeoFilters; onClose: () => void; onDrill: (area: Area) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog ref={ref} className="workspace-drawer settings-card" aria-labelledby="geo-area-detail"
    onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
      <div><h2 id="geo-area-detail" className="text-2xl">{row.label}</h2>
        <p className="mt-2 text-sm opacity-75">{displayPeriod(filters.from, filters.to)} · Synthetic aggregates</p>
      </div>
      <button type="button" className="settings-button secondary" aria-label="Close geographic details" onClick={onClose}><X size={16} /></button>
    </div>
    {row.area && <button type="button" className="settings-button mb-4" onClick={() => { if (row.area) onDrill(row.area); onClose() }}><MapPin size={16} aria-hidden="true" /> Explore on map</button>}
    <MetricCards metrics={row.metrics} workspace={workspace} month={filters.to} compact />
  </dialog>
}

function GeographicDashboard({ workspace, access, geography }: { workspace: GeoWorkspace; access: GeoAccess; geography: Geography }) {
  const openAssistant = useContext(AssistantContext)
  const [filters, setFilters] = useState(defaultFilters)
  const [selection, setSelection] = useState(country)
  const [measure, setMeasure] = useState<MapMeasure>('eventRate')
  const [ranking, setRanking] = useState<RankingLevel>('municipalities')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<RankingRow | null>(null)
  const moduleRef = useRef<HTMLElement>(null)
  const workspaceProgrammes = allowedProgrammes(access, workspace)
  const corpus = useMemo(() => authorisedCohorts(syntheticCohorts(geography), access, workspace, geography), [access, workspace, geography])
  const scoped = useMemo(() => corpus.filter((cohort) => geography.contains(cohort.place, selection.id)), [corpus, geography, selection.id])
  const trail = geography.lineage(selection.id)
  const mapRows = useMemo(() => reportRows(geography.children(selection.id), scoped, filters, geography), [geography, selection.id, scoped, filters])
  const provinces = useMemo(() => reportRows(geography.children(country.id), corpus, filters, geography), [geography, corpus, filters])
  const eligibleAreas = useMemo(() => geography.areas.filter((area) => geography.contains(area.id, selection.id)), [geography, selection.id])
  const metrics = aggregate(scoped, filters)
  const options = Object.keys(rankingLevels).filter((level) => workspace !== 'sassa' || level !== 'institutions') as RankingLevel[]
  const rows = useMemo<RankingRow[]>(() => {
    if (ranking === 'institutions') {
      const institutions = [...new Set(scoped.map((cohort) => cohort.institution).filter(Boolean))]
      return institutions.map((label) => ({ id: label, label, metrics: aggregate(scoped.filter((cohort) => cohort.institution === label), filters) }))
    }
    return reportRows(eligibleAreas.filter((area) => area.level === rankingLevels[ranking]), scoped, filters, geography)
      .map(({ area, metrics }) => ({ id: area.id, label: area.name, area, metrics }))
  }, [eligibleAreas, ranking, scoped, filters, geography])
  const search = query.trim().toLowerCase()
  const matches = search ? geography.areas.filter((area) => area.name.toLowerCase().includes(search)).slice(0, 12) : []
  const update = <K extends keyof GeoFilters>(key: K, value: GeoFilters[K]) => setFilters((current) => ({ ...current, [key]: value }))
  const choose = (area: Area) => {
    setSelection(area)
    setQuery('')
    if (area.level >= 3 && ranking !== 'institutions') setRanking('towns')
    if (area.level < 3 && ranking === 'towns') setRanking('municipalities')
  }
  const openOnMap = (area: Area) => {
    choose(area)
    moduleRef.current?.scrollIntoView({ block: 'start' })
  }
  const exportReport = () => {
    downloadCsv('geographic-risk-' + workspace + '-' + filters.to, [
      ['Area or cohort', 'Workspace', 'Programme', 'From', 'To', 'Merchant category', 'Risk classification', 'Source',
        'Monitored', 'Affected', 'Gambling transactions', 'Gambling spend (ZAR)', 'All observed spend (ZAR)', 'Affected share (%)',
        'Average spend per affected participant (ZAR)', 'Share of observed spend (%)',
        'Review events', 'Review events per 1,000 monitored', 'Observed transactions in category', 'Flagged transaction share (%)',
        'Unusual spending indicators at period end', 'Open referrals at period end', 'Cases for review at period end'],
      ...[{ label: selection.name, metrics }, ...rows].map((row) => {
        const m = row.metrics
        return [row.label, scopeLabels[workspace], workspaceProgrammes.find((programme) => programme.id === filters.programme)?.label ?? 'All authorised',
          filters.from, filters.to, filters.category || 'All', filters.classification || 'All', m ? 'Synthetic aggregate' : 'No reportable coverage',
          m?.monitored ?? '', m?.affected ?? '', m?.gamblingTransactions ?? '', m ? m.gamblingCents / 100 : '', m ? m.observedCents / 100 : '',
          m?.prevalence ?? '', m?.averageCents != null ? m.averageCents / 100 : '', m?.spendingShare ?? '',
          m?.flaggedEvents ?? '', m?.eventRate ?? '', m?.observedTransactions ?? '', m?.flaggedTransactionRate ?? '',
          m?.unusual ?? '', m?.referrals ?? '', m?.cases ?? '']
      }),
    ])
  }

  return <div className="space-y-5">
    <section className="settings-card" ref={moduleRef}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm text-teal">{scopeLabels[workspace]} workspace</p><h2 className="mt-1 text-2xl sm:text-3xl">Geographic Risk Intelligence</h2></div>
        <button type="button" className="settings-button" onClick={exportReport} disabled={!metrics}><Download size={16} aria-hidden="true" /> Export CSV</button>
      </div>
      <div className="my-4 rounded-xl border border-slate-200 p-3 text-sm leading-6">
        <p><strong>Synthetic aggregates</strong> · Last complete reporting month: October 2026. These figures are fictional and are unavailable for areas outside the selected coverage.</p>
        <p className="text-xs opacity-80">Boundaries: <a className="underline" href="https://www.geoboundaries.org/api.html">geoBoundaries</a> (2020, OCHA ROSEA and Municipal Demarcation Board, CC BY 3.0 IGO). Town points: <a className="underline" href="https://www.geonames.org/export/">GeoNames</a> (CC BY). Minimum published cohort: {minimumCohort}.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <SelectFilter label="Programme" value={filters.programme} onChange={(value) => update('programme', value)}>
          <option value="">All authorised programmes</option>
          {workspaceProgrammes.map((programme) => <option key={programme.id} value={programme.id}>{programme.label}</option>)}
        </SelectFilter>
        <SelectFilter label="From month" value={filters.from} onChange={(value) => update('from', value)}>
          {months.filter((month) => month <= filters.to).map((month) => <option key={month}>{month}</option>)}
        </SelectFilter>
        <SelectFilter label="Through month" value={filters.to} onChange={(value) => update('to', value)}>
          {months.filter((month) => month >= filters.from).map((month) => <option key={month}>{month}</option>)}
        </SelectFilter>
        <SelectFilter label="Merchant category" value={filters.category} onChange={(value) => update('category', value as GeoFilters['category'])}>
          <option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}
        </SelectFilter>
        <SelectFilter label="Risk classification" value={filters.classification} onChange={(value) => update('classification', value as GeoFilters['classification'])}>
          <option value="">All classifications</option>{classifications.map((classification) => <option key={classification}>{classification}</option>)}
        </SelectFilter>
        <button type="button" className="settings-button secondary" onClick={() => setFilters(defaultFilters)}>Reset filters</button>
      </div>
    </section>

    <nav aria-label="Geographic selection" className="flex flex-wrap items-center gap-2 text-sm">
      {trail.map((area) => <button type="button" key={area.id} className="rounded-lg border border-slate-400/45 px-3 py-2 hover:bg-teal/10"
        aria-current={selection.id === area.id ? 'location' : undefined} onClick={() => choose(area)}>{area.name}<span className="sr-only"> ({geographyLevels[area.level]})</span></button>)}
    </nav>
    <MetricCards metrics={metrics} workspace={workspace} month={filters.to} />
    <details className="settings-card text-sm"><summary className="cursor-pointer">How these measures are calculated</summary>
      <p className="mt-3 leading-6">The monitored denominator counts distinct participants once within the selected geography, programme and reporting period. Merchant and review filters narrow the transaction numerator. Gambling spending share uses all observed spending as its denominator. Flagged transaction share uses all transactions in the selected merchant category across review classifications. Referral and case counts use the last month of the selected period. Indicators call for human review and do not establish misuse.</p>
    </details>

    <section className="settings-card">
      <label className="grid max-w-xl gap-1 text-sm">Find a province, municipality or town
        <span className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-4 opacity-60" aria-hidden="true" />
          <input type="search" className="settings-input w-full pl-9" value={query} onChange={(event) => setQuery(event.target.value)} /></span>
      </label>
      {search && (matches.length ? <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {matches.map((area) => <li key={area.id}><button type="button" className="rounded-lg p-2 text-left text-sm hover:bg-teal/10" onClick={() => choose(area)}>
          {area.name} · {geographyLevels[area.level]}<span className="block text-xs opacity-75">{geography.lineage(area.id).slice(1, -1).map((item) => item.name).join(' / ')}</span>
        </button></li>)}
      </ul> : <p className="mt-3 text-sm">No matching places.</p>)}
      {mapRows.length > 0 && <div className="mt-4 w-fit max-w-full">
        <SelectFilter label="Drill down to" value="" onChange={(value) => { const area = geography.byId.get(value); if (area) choose(area) }}>
          <option value="">Select a {geographyLevels[selection.level + 1].toLowerCase()}</option>
          {[...mapRows].sort((a, b) => a.area.name.localeCompare(b.area.name)).map(({ area }) => <option key={area.id} value={area.id}>{area.name}</option>)}
        </SelectFilter>
      </div>}
    </section>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <GeographicMap selected={selection} trail={trail} rows={mapRows} measure={measure} onMeasure={setMeasure} onSelect={choose} />
      <ProvinceComparison rows={provinces} measure={measure} onChoose={choose} />
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <GeographicTrends data={scoped} filters={filters} />
      <MerchantBreakdown metrics={metrics} onChoose={(value) => update('category', filters.category === value ? '' : value)} />
    </div>
    <section className="settings-card min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-lg">Geographic rankings</h3><p className="mt-1 text-xs opacity-75">{selection.name} · Select a name to see aggregate details.</p></div>
        <SelectFilter label="Rank by geography" value={ranking} onChange={(value) => setRanking(value as RankingLevel)}>
          {options.map((level) => <option key={level} value={level}>{rankingLabels[level]}</option>)}
        </SelectFilter>
      </div>
      {ranking === 'institutions' && <p className="mt-2 text-xs opacity-75">University and TVET groups are fictional cohorts grouped by town. They do not identify actual institutions.</p>}
      <GeographicRankings key={ranking + selection.id} rows={rows} scope={rankingLabels[ranking]} onOpen={setDetail} />
    </section>
    <section className="settings-card">
      <h3 className="flex items-center gap-2 text-lg"><Bot size={19} aria-hidden="true" /> Reporting questions</h3>
      <button type="button" className="settings-button secondary mt-3" onClick={() => {
        const programme = workspaceProgrammes.find((item) => item.id === filters.programme)?.label
        openAssistant(`Summarise review indicators and gambling-related spending in ${selection.name} for ${displayPeriod(filters.from, filters.to)}${programme ? ', programme: ' + programme : ''}${filters.category ? ', merchant category: ' + filters.category : ''}${filters.classification ? ', classification: ' + filters.classification : ''}.`)
      }}>Ask Lebati AI about this area</button>
    </section>
    {detail && <AreaDrawer row={detail} workspace={workspace} filters={filters} onClose={() => setDetail(null)} onDrill={openOnMap} />}
  </div>
}

export default function GeographicRiskPage({ workspace, access }: { workspace: GeoWorkspace; access: GeoAccess }) {
  const [geography, setGeography] = useState<Geography | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, retry] = useState(0)
  const allowed = allowedProgrammes(access, workspace).length > 0
  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    fetch(import.meta.env.BASE_URL + 'za-geography.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Geography could not be loaded')
        return response.json() as Promise<{ areas: Area[] }>
      })
      .then(({ areas }) => setGeography(indexGeography(areas)))
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [allowed, attempt])
  if (!allowed) return <p role="alert" className="settings-card">This account has no geographic reporting access for this workspace.</p>
  if (geography) return <GeographicDashboard key={workspace} workspace={workspace} access={access} geography={geography} />
  return <div className="settings-card" role="status">
    {failed ? <>Geographic boundaries could not be loaded. <button className="settings-button" type="button" onClick={() => { setFailed(false); retry((value) => value + 1) }}>Retry</button></> : 'Loading geographic boundaries…'}
  </div>
}
