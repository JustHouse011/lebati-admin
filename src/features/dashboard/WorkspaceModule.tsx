import { ArrowUpRight, Download, Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { WorkspaceFilters } from './WorkspaceOverview'
import { downloadCsv, filterRecords, matchesStatus, recordFilters } from './workspaceRecords'
import { classifyNarrative, moduleDefinitions, restrictionStates, restrictionTransitions, workspaces, type ModulePath, type RecordItem, type Workspace } from './workspaceData'

export type RecordChange = (record: RecordItem, action: string, add?: boolean) => void

const amountFormat = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })
const readable = (value: string) => value.replaceAll('_', ' ')
const generatedDate = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Africa/Johannesburg' })

function Field({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs opacity-70">{label}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>
}

function MerchantClassifier() {
  const [narrative, setNarrative] = useState('')
  return <section className="settings-card">
    <h3 className="mb-3 text-lg">Classify a transaction narrative</h3>
    <label className="grid max-w-xl gap-1 text-sm">Narrative
      <input className="settings-input" value={narrative} onChange={(event) => setNarrative(event.target.value)} maxLength={160} placeholder="Enter a merchant description" />
    </label>
    {narrative.trim() && <p className="mt-3 text-sm" aria-live="polite">{classifyNarrative(narrative)}. Review the merchant record before reaching a finding.</p>}
  </section>
}

function BudgetPlanner() {
  const [available, setAvailable] = useState('')
  const [essential, setEssential] = useState('')
  return <section className="settings-card">
    <h3 className="mb-3 text-lg">Monthly budget planner</h3>
    <div className="flex flex-wrap gap-3">
      <label className="grid gap-1 text-sm">Available funds (ZAR)
        <input type="number" min="0" step="0.01" className="settings-input w-44" value={available} onChange={(event) => setAvailable(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">Essential expenses (ZAR)
        <input type="number" min="0" step="0.01" className="settings-input w-44" value={essential} onChange={(event) => setEssential(event.target.value)} />
      </label>
    </div>
    {available && essential && Number(available) >= 0 && Number(essential) >= 0 &&
      <p className="mt-3 text-sm" aria-live="polite">Balance after essentials: {amountFormat.format(Number(available) - Number(essential))}</p>}
  </section>
}

function RecordDrawer({ record, records, change, close }: {
  record: RecordItem
  records: RecordItem[]
  change: RecordChange
  close: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [notice, setNotice] = useState('')
  const [referral, setReferral] = useState('Budget planning')
  const programmes = records.filter((item) => item.kind === 'programme' && item.workspace === record.workspace)
  const history = records.filter((item) => item.kind === 'audit' && item.fields.Record === record.id).toReversed()
  const matchingCase = records.find((item) => item.kind === 'case' && item.fields.Evidence === record.id)
  const matchingReferral = records.find((item) => item.kind === 'intervention' && item.fields.Case === record.id && item.name === referral)

  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close() }
  }, [])

  const save = (next: RecordItem, action: string) => {
    try {
      change(next, action)
      setNotice('Saved in this browser.')
    } catch {
      setNotice('The change could not be saved in this browser.')
    }
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const value = (name: string) => String(data.get(name) ?? '').trim()
    if (record.kind === 'restriction' && !value('reason')) {
      setNotice('Enter a reason and evidence for this decision.')
      return
    }
    const next = { ...record, fields: { ...record.fields } }
    const status = value('status')
    if (status) next.status = status
    if (value('name')) next.name = value('name')
    if (value('programme')) next.programme = value('programme')
    if (value('reviewer')) next.fields.Reviewer = value('reviewer')
    if (record.kind === 'restriction') next.fields.Reason = value('reason')
    if (record.kind === 'case' && value('reason')) next.fields['Review decision'] = value('reason')
    if (value('outcome')) next.fields.Outcome = value('outcome')
    if (next.kind === 'restriction' && next.status !== record.status) {
      next.fields['Effective date'] = generatedDate()
      next.fields['Review date'] = value('reviewDate')
      next.fields['Decision-maker'] = 'Global Administrator'
    }
    save(next, next.status === record.status ? 'Record updated' : 'Status updated to ' + readable(next.status))
  }

  const createCase = () => {
    if (matchingCase) return
    try {
      change({
        id: record.workspace.toUpperCase() + '-C-' + crypto.randomUUID().slice(0, 8),
        kind: 'case', workspace: record.workspace, programme: record.programme,
        name: record.name, status: 'Open', date: generatedDate(), detail: 'Review the linked risk evidence and account context.',
        fields: { Reviewer: 'Unassigned', Evidence: record.id, 'Account reference': record.fields['Account reference'], 'Appeal pathway': 'Request an independent programme review' },
      }, 'Case opened', true)
      setNotice('Case opened in this browser.')
    } catch {
      setNotice('The case could not be saved in this browser.')
    }
  }
  const createReferral = () => {
    if (matchingReferral) return
    try {
      change({
        id: record.workspace.toUpperCase() + '-I-' + crypto.randomUUID().slice(0, 8),
        kind: 'intervention', workspace: record.workspace, programme: record.programme,
        name: referral, status: 'Scheduled', date: generatedDate(), detail: 'Follow up with the assigned workspace team.',
        fields: { Case: record.id, 'Assigned team': 'Financial wellbeing', Outcome: 'Awaiting follow-up' },
      }, 'Referral recorded', true)
      setNotice('Referral saved in this browser.')
    } catch {
      setNotice('The referral could not be saved in this browser.')
    }
  }

  let statuses: string[] = []
  if (record.kind === 'restriction') statuses = restrictionTransitions[record.status as keyof typeof restrictionTransitions] ?? []
  if (record.kind === 'case') statuses = ['Open', 'Under review', 'Resolved', 'Appealed']
  if (record.kind === 'programme') statuses = ['Active', 'Closed']
  if (record.kind === 'person') statuses = ['Active', 'Pending', 'Closed']
  if (record.kind === 'verification') statuses = ['Pending', 'Reviewed', 'Needs evidence']
  if (record.kind === 'intervention') statuses = ['Scheduled', 'In progress', 'Completed']
  if (record.kind === 'risk') statuses = ['Open', 'Reviewed']
  if (record.kind === 'user') statuses = ['Active', 'Suspended']
  const programme = programmes.find((item) => item.id === record.programme)
  const related = records.filter((item) => item.kind !== 'audit' && item.id !== record.id &&
    (Object.values(item.fields).includes(record.id) || Object.values(record.fields).includes(item.id)))

  return (
    <dialog ref={ref} className="workspace-drawer settings-card" onCancel={(event) => { event.preventDefault(); close() }} aria-labelledby="record-title">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest opacity-70">{record.id}</p>
          <h2 id="record-title" className="mt-1 text-2xl">{record.name}</h2>
          <p className="mt-1 text-sm opacity-75">{workspaces[record.workspace]} · {readable(record.status)}</p>
        </div>
        <button className="settings-button secondary" type="button" aria-label="Close record details" onClick={close}><X size={16} /></button>
      </div>
      {record.detail && <p className="my-4 text-sm leading-6">{record.detail}</p>}
      <dl className="my-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Record date" value={record.date} />
        {programme && <Field label="Programme" value={programme.name} />}
        {Object.entries(record.fields).map(([label, value]) => <Field key={label} label={label} value={label === 'Amount' && record.amount ? amountFormat.format(record.amount) : value} />)}
      </dl>
      {record.kind === 'restriction' && <section className="border-t border-slate-200 py-4">
        <h3 className="mb-2 text-lg">Restriction lifecycle</h3>
        <ol className="flex flex-wrap gap-2 text-xs">
          {restrictionStates.map((status) => <li key={status} aria-current={status === record.status ? 'step' : undefined} className={status === record.status ? 'rounded-full bg-teal px-3 py-2 text-white' : 'rounded-full border border-slate-200 px-3 py-2'}>{readable(status)}</li>)}
        </ol>
      </section>}
      {statuses.length > 0 && <form className="space-y-3 border-t border-slate-200 py-4" onSubmit={submit} key={record.status + record.name + record.programme}>
        <h3 className="text-lg">Update record</h3>
        {record.kind === 'programme' && <label className="grid gap-1 text-sm">Programme name<input name="name" className="settings-input" required maxLength={100} defaultValue={record.name} /></label>}
        {record.kind === 'person' && <label className="grid gap-1 text-sm">Programme enrolment<select aria-label="Programme enrolment" name="programme" className="settings-input" defaultValue={record.programme}>
          {programmes.filter((item) => item.status === 'Active' || item.id === record.programme).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>}
        <label className="grid gap-1 text-sm">Status
          <select aria-label="Status" className="settings-input" name="status" defaultValue={record.kind === 'restriction' ? '' : record.status} required>
            {record.kind === 'restriction' && <option value="" disabled>Select the next state</option>}
            {statuses.map((status) => <option key={status} value={status}>{readable(status)}</option>)}
          </select>
        </label>
        {record.kind === 'case' && <label className="grid gap-1 text-sm">Reviewer
          <select aria-label="Reviewer" className="settings-input" name="reviewer" defaultValue={record.fields.Reviewer}>
            {['Unassigned', 'Compliance desk', 'Programme services', 'Financial wellbeing'].map((reviewer) => <option key={reviewer}>{reviewer}</option>)}
          </select>
        </label>}
        {record.kind === 'restriction' && <label className="grid gap-1 text-sm">Review date<input className="settings-input" name="reviewDate" type="date" min={generatedDate()} required /></label>}
        {(record.kind === 'case' || record.kind === 'restriction') && <label className="grid gap-1 text-sm">Decision and evidence notes
          <textarea name="reason" className="settings-input" maxLength={500} required={record.kind === 'restriction'} defaultValue={record.kind === 'case' ? record.fields['Review decision'] : ''} />
        </label>}
        {record.kind === 'intervention' && <label className="grid gap-1 text-sm">Outcome<textarea name="outcome" className="settings-input" maxLength={500} defaultValue={record.fields.Outcome} /></label>}
        <button type="submit" className="settings-button">Save changes</button>
      </form>}
      {record.kind === 'risk' && <div className="my-4">
        {matchingCase ? <Link to={'/dashboard/cases?record=' + matchingCase.id} className="settings-button">Open case {matchingCase.id}</Link>
          : <button type="button" className="settings-button" onClick={createCase}>Create case</button>}
      </div>}
      {record.kind === 'case' && <section className="my-4 space-y-3 border-t border-slate-200 pt-4">
        <h3 className="text-lg">Refer for support</h3>
        <label className="grid gap-1 text-sm">Intervention
          <select aria-label="Intervention" className="settings-input" value={referral} onChange={(event) => setReferral(event.target.value)}>
            {['Budget planning', 'Financial education', 'Independent case review'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        {matchingReferral ? <Link to={'/dashboard/interventions?record=' + matchingReferral.id} className="settings-button">Open referral</Link>
          : <button type="button" className="settings-button" onClick={createReferral}>Record referral</button>}
      </section>}
      {notice && <p role="status" className="my-3 text-sm">{notice}</p>}
      {related.length > 0 && <section className="border-t border-slate-200 py-4">
        <h3 className="mb-2 text-lg">Related records</h3>
        <ul className="space-y-1 text-sm">{related.map((item) => {
          const destination = (Object.keys(moduleDefinitions) as ModulePath[]).find((path) => moduleDefinitions[path].kind === item.kind)
          return destination ? <li key={item.id}><Link to={'/dashboard/' + destination + '?record=' + item.id} className="inline-flex items-center gap-1 underline">{item.id} · {item.name}<ArrowUpRight size={12} /></Link></li> : null
        })}</ul>
      </section>}
      {history.length > 0 && <section className="border-t border-slate-200 py-4">
        <h3 className="mb-2 text-lg">Audit history</h3>
        <ul className="space-y-2 text-sm">{history.map((item) => <li key={item.id}>{item.date} · {item.name} · {item.fields.Actor}</li>)}</ul>
      </section>}
    </dialog>
  )
}

export default function WorkspaceModule({ workspace, module, records, change }: {
  workspace: Workspace
  module: ModulePath
  records: RecordItem[]
  change: RecordChange
}) {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const definition = moduleDefinitions[module]
  const entries = records.filter((record) => record.kind === definition.kind)
  const statuses = [...new Set(entries.map((record) => record.status))]
  const status = params.get('status') ?? ''
  const institution = params.get('institution') ?? ''
  const programmes = records.filter((item) => item.kind === 'programme')
  const programmeName = (id: string) => programmes.find((item) => item.id === id)?.name ?? '—'
  const query = search.trim().toLowerCase()
  const results = filterRecords(entries, recordFilters(params))
    .filter((record) => matchesStatus(record.status, status) && (!institution || record.fields.Institution === institution) &&
      [record.id, record.name, record.status, programmeName(record.programme), ...Object.values(record.fields)].join(' ').toLowerCase().includes(query))
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id, undefined, { numeric: true }))
  const activePage = Math.min(page, Math.max(0, Math.ceil(results.length / 15) - 1))
  const visible = results.slice(activePage * 15, (activePage + 1) * 15)
  const selected = entries.find((record) => record.id === params.get('record'))
  const label = workspace === 'nsfas' && module === 'beneficiary-registry' ? 'Student Registry' : definition.label
  const tableField = definition.kind === 'person' ? 'Institution' : definition.kind === 'transaction' ? 'Amount' : definition.kind === 'merchant' ? 'Category' : ''
  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true, flushSync: true })
  }
  return (
    <div className="space-y-4">
      <section className="settings-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-widest text-teal">{workspaces[workspace]}</p>
            <h2 className="text-2xl">{label}</h2>
            {module === 'risk-intelligence' && <p className="mt-2 text-sm opacity-75">Indicators require review before any finding can be made.</p>}
            {module === 'integrations' && <p className="mt-2 text-sm opacity-75">No external provider is connected.</p>}
            {module === 'restrictions' && <p className="mt-2 text-sm opacity-75">Decisions recorded here apply only to workspace records.</p>}
          </div>
          <button type="button" className="settings-button secondary" onClick={() => downloadCsv(workspace + '-' + module, [
            ['Reference', 'Name', 'Workspace', 'Programme', 'Status', 'Date'],
            ...results.map((item) => [item.id, item.name, workspaces[item.workspace], programmeName(item.programme), readable(item.status), item.date]),
          ])}><Download size={16} aria-hidden="true" /> Export CSV</button>
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs">Search records
            <span className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-3.5 opacity-60" aria-hidden="true" />
              <input className="settings-input w-full pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} />
            </span>
          </label>
          <label className="grid gap-1 text-xs">Status
            <select aria-label="Status" className="settings-input" value={status} onChange={(event) => { updateParam('status', event.target.value); setPage(0) }}>
              <option value="">All statuses</option>
              {status && !statuses.includes(status) && <option value={status}>{status}</option>}
              {statuses.map((item) => <option key={item} value={item}>{readable(item)}</option>)}
            </select>
          </label>
          {definition.kind === 'person' && <label className="grid min-w-0 gap-1 text-xs">Institution
            <select aria-label="Institution" className="settings-input" value={institution} onChange={(event) => { updateParam('institution', event.target.value); setPage(0) }}>
              <option value="">All institutions</option>
              {[...new Set(entries.map((item) => item.fields.Institution))].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>}
          <WorkspaceFilters programmes={programmes} />
        </div>
      </section>
      {module === 'merchants' && <MerchantClassifier />}
      {module === 'education' && <BudgetPlanner />}
      {module === 'restrictions' && <section className="settings-card">
        <h3 className="text-lg">LB-POL-04 · Transaction review</h3>
        <p className="mt-2 text-sm">Record supporting evidence, an authorised decision, the next review date and an independent appeal route. Eligibility for funding is insufficient grounds for a restriction.</p>
      </section>}
      <section className="settings-card">
        <p aria-live="polite" className="mb-3 text-sm opacity-75">{results.length} {results.length === 1 ? 'record' : 'records'}</p>
        {visible.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[585px] text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs opacity-75">
              <th scope="col" className="p-2">Record</th><th scope="col" className="p-2">Workspace</th><th scope="col" className="p-2">Programme</th>{tableField && <th scope="col" className="p-2">{tableField}</th>}<th scope="col" className="p-2">Status</th><th scope="col" className="p-2">Date</th>
            </tr></thead>
            <tbody>{visible.map((item) => <tr key={item.id} className="border-b border-slate-200 last:border-0">
              <td className="p-2"><button className="text-left underline-offset-4 hover:underline focus-visible:underline" type="button" onClick={() => updateParam('record', item.id)}><span className="block">{item.name}</span><span className="text-xs opacity-75">{item.id}</span></button></td>
              <td className="p-2">{workspaces[item.workspace]}</td><td className="p-2">{programmeName(item.programme)}</td>
              {tableField && <td className="p-2">{tableField === 'Amount' && item.amount !== undefined ? amountFormat.format(item.amount) : item.fields[tableField]}</td>}
              <td className="p-2"><span className="inline-block whitespace-nowrap rounded-full border border-slate-200 px-2 py-1 text-xs">{readable(item.status)}</span></td><td className="whitespace-nowrap p-2">{item.date}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p className="py-6 text-sm">No records match your filters.</p>}
        {results.length > 15 && <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button className="settings-button secondary" type="button" disabled={!activePage} onClick={() => setPage(activePage - 1)}>Previous</button>
          <span className="text-xs">{activePage * 15 + 1}–{Math.min((activePage + 1) * 15, results.length)} of {results.length}</span>
          <button className="settings-button secondary" type="button" disabled={(activePage + 1) * 15 >= results.length} onClick={() => setPage(activePage + 1)}>Next</button>
        </div>}
      </section>
      {selected && <RecordDrawer key={selected.id} record={selected} records={records} change={change} close={() => updateParam('record', '')} />}
    </div>
  )
}
