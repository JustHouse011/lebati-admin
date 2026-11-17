import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import {
  aggregate, allowedProgrammes, authorisedCohorts, categories, classifications, country, defaultFilters, indexGeography,
  months, syntheticCohorts, type Area, type Cohort, type GeoFilters, type GeoWorkspace, type Geography, type Metrics,
} from '../../src/features/geography/geographicRisk'
import type { SafeAccount } from './access'
import { knowledge } from './knowledge'

const toolHelp = {
  getDashboardSummary: 'Summarise monitored participants, spending and review indicators in the authorised workspace or area.',
  getGeographicRiskStatistics: 'Show or rank provinces, districts, municipalities or towns. Rank by spending volume, prevalence, gambling transaction share, review rate, or change in flagged activity from the first month to the last.',
  compareProvinces: 'Compare exactly two South African provinces by name.',
  getMerchantRiskBreakdown: 'Summarise observed spending and transaction counts by merchant category.',
  getCaseSummary: 'Read a synthetic case evidence summary by reference, or list up to five case references available to the caller.',
  getPolicyExplanation: 'Look up approved platform guidance by its document ID, such as restriction-lifecycle.',
  getProgrammeStatistics: 'Compare allowed programmes or return statistics on a specified programme.',
  getTransactionTrends: 'Return monthly monitored counts, spending and review rates. Select a range such as the last six available months.',
  searchApprovedKnowledgeBase: 'Find approved portal workflow and reporting documentation.',
} as const
const month = z.enum(months)
const measure = z.enum(['spending', 'prevalence', 'gamblingTransactionShare', 'reviewRate', 'flaggedIncrease'])
const filters = {
  institution: z.enum(['nsfas', 'sassa']).nullable().describe('Narrow an authorised Global report to NSFAS or SASSA; null uses the current workspace'),
  programme: z.string().max(80).nullable(),
  from: month.nullable(), to: month.nullable(),
  area: z.string().max(110).nullable(),
  category: z.enum(categories).nullable(),
  classification: z.enum(classifications).nullable(),
}
const text = (size = 110) => z.string().trim().min(1).max(size)
const scopes = {
  getDashboardSummary: z.object(filters).strict(),
  getGeographicRiskStatistics: z.object({
    ...filters, level: z.enum(['province', 'district', 'municipality', 'town']), measure,
  }).strict(),
  compareProvinces: z.object({ ...filters, first: text(), second: text() }).strict(),
  getMerchantRiskBreakdown: z.object(filters).strict(),
  getCaseSummary: z.object({ id: text(80).nullable() }).strict(),
  getPolicyExplanation: z.object({ id: text(80) }).strict(),
  getProgrammeStatistics: z.object(filters).strict(),
  getTransactionTrends: z.object(filters).strict(),
  searchApprovedKnowledgeBase: z.object({ query: text(180) }).strict(),
} as const
export type ToolName = keyof typeof toolHelp
function providerSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema)
  // The provider's strict schema is a subset of JSON Schema. Zod also enforces size limits at execution.
  return JSON.parse(JSON.stringify(json, (key, value) => ['$schema', 'maxLength', 'minLength'].includes(key) ? undefined : value)) as Record<string, unknown>
}
export const assistantTools = (Object.keys(toolHelp) as ToolName[]).map((name) => ({
  type: 'function' as const, name, description: toolHelp[name], strict: true, parameters: providerSchema(scopes[name]),
}))
const isTool = (name: string): name is ToolName => Object.hasOwn(scopes, name)

const source = { status: 'Fictional synthetic records', coverage: [months[0], months.at(-1)], freshness: 'Through October 2026' }
const policySource = { status: 'Approved portal workflow guidance', version: '2026-11-17' }
let geographyPromise: Promise<Geography> | undefined
function loadGeography() {
  geographyPromise ??= readFile(resolve('public/za-geography.json'), 'utf8')
    .then((value) => indexGeography((JSON.parse(value) as { areas: Area[] }).areas))
    .catch((error) => { geographyPromise = undefined; throw error })
  return geographyPromise
}

const dataSources = [
  { reference: 'NSFAS-REVIEW-001', programme: 'nsfas-tuition', town: 'Pretoria', evidence: ['Synthetic merchant classification'], missing: ['Independent merchant verification', 'Confirmed transaction context'] },
  { reference: 'SASSA-REVIEW-001', programme: 'sassa-child', town: 'Cape Town', evidence: ['Synthetic unusual amount indicator'], missing: ['Baseline spending comparison', 'Reviewer rationale'] },
]

function stats(metrics: Metrics | null) {
  if (!metrics) return null
  const gamblingShare = metrics.observedTransactions ? metrics.gamblingTransactions / metrics.observedTransactions * 100 : null
  return {
    monitoredDistinctParticipants: metrics.monitored, affectedDistinctParticipants: metrics.affected,
    gamblingTransactions: metrics.gamblingTransactions, gamblingSpendZar: metrics.gamblingCents / 100,
    averageSpendPerAffectedZar: metrics.averageCents == null ? null : metrics.averageCents / 100,
    allObservedSpendZar: metrics.observedCents / 100,
    gamblingSpendSharePercent: metrics.spendingShare, affectedSharePercent: metrics.prevalence,
    observedCategoryTransactions: metrics.observedTransactions, gamblingTransactionSharePercent: gamblingShare,
    flaggedEvents: metrics.flaggedEvents, reviewEventsPer1000: metrics.eventRate, flaggedTransactionSharePercent: metrics.flaggedTransactionRate,
    openReferralsAtPeriodEnd: metrics.referrals, casesForHumanReviewAtPeriodEnd: metrics.cases,
  }
}

function areaByName(geography: Geography, value: string | null, level?: number) {
  if (!value) return country
  const key = value.toLowerCase().trim()
  const matches = [country, ...geography.areas].filter((area) => (level == null || area.level === level) &&
    (area.id.toLowerCase() === key || area.name.toLowerCase() === key))
  return matches.find((area) => area.id.toLowerCase() === key) ?? (matches.length === 1 ? matches[0] : undefined)
}

function findCases(account: SafeAccount, workspace: GeoWorkspace, allowed: Cohort[], geography: Geography) {
  return dataSources.flatMap((record) => {
    const area = areaByName(geography, record.town, 4)
    if (!area) return []
    const inScope = allowed.some((cohort) => cohort.programme === record.programme && cohort.place === area.id)
    const assigned = account.role === 'Global Administrator' || (account.role === 'Agent' && account.cases.includes(record.reference))
    return inScope && assigned ? [{
      ...record, workspace, status: 'Awaiting human review', source, reportingPeriod: defaultFilters.to,
      reviewStep: 'Confirm the missing evidence with the case owner before recording any decision.',
    }] : []
  })
}

export async function executeTool(name: string, input: string, account: SafeAccount, workspace: GeoWorkspace) {
  const allowed = allowedProgrammes(account, workspace)
  if ((account.role !== 'Global Administrator' && workspace === 'global') || !allowed.length) return { error: 'Scope unavailable' }
  if (!isTool(name) || input.length > 1600) return { error: 'Invalid tool request' }
  let raw: unknown
  try { raw = JSON.parse(input) } catch { return { error: 'Invalid tool arguments' } }
  if (!scopes[name].safeParse(raw).success) return { error: 'Invalid tool arguments' }

  if (name === 'searchApprovedKnowledgeBase') {
    const { query } = scopes[name].parse(raw)
    const tokens = new Set(query.toLowerCase().match(/[a-z]{3,}/g) ?? [])
    const results = knowledge.map((document) => ({
      document, score: [...tokens].filter((token) => (document.id + ' ' + document.title + ' ' + document.text).toLowerCase().includes(token)).length,
    })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(({ document }) => document)
    return { source: policySource, results }
  }
  if (name === 'getPolicyExplanation') {
    const { id } = scopes[name].parse(raw)
    return { source: policySource, document: knowledge.find((document) => document.id === id) ?? null }
  }

  const geography = await loadGeography()
  const cohorts = authorisedCohorts(syntheticCohorts(geography), account, workspace, geography)
  if (name === 'getCaseSummary') {
    const { id } = scopes[name].parse(raw)
    const cases = findCases(account, workspace, cohorts, geography)
    return id ? { source, case: cases.find((record) => record.reference === id) ?? null } :
      { source, availableReferences: cases.map((record) => record.reference).slice(0, 5) }
  }
  const parsed = z.object(filters).parse(raw)
  if (parsed.institution && workspace !== 'global' && parsed.institution !== workspace) return { error: 'Institution unavailable in this scope', source }
  const scope = parsed.institution ?? workspace
  const programmes = allowedProgrammes(account, scope)
  const area = areaByName(geography, parsed.area)
  const programmeName = parsed.programme?.toLowerCase()
  const programme = programmeName ? programmes.find((item) => [item.id, item.label.toLowerCase()].includes(programmeName)) : undefined
  if (!area || (parsed.programme && !programme)) return { error: 'Area or programme unavailable in this scope', source }
  const query: GeoFilters = {
    from: parsed.from ?? defaultFilters.from, to: parsed.to ?? defaultFilters.to, programme: programme?.id ?? '',
    category: parsed.category ?? '', classification: parsed.classification ?? '',
  }
  if (query.from > query.to) return { error: 'Invalid reporting period', source }
  const scoped = cohorts.filter((row) => (scope === 'global' || scope === row.workspace) && geography.contains(row.place, area.id))
  const metrics = aggregate(scoped, query)
  const metadata = {
    area: area.name, source, workspace: scope, programme: programme?.label ?? 'All authorised',
    reportingPeriod: { from: query.from, through: query.to }, category: query.category || 'All', classification: query.classification || 'All',
    denominators: {
      prevalence: 'Distinct monitored participants', reviewRate: 'Flagged events per 1,000 distinct monitored participants',
      flaggedTransactionShare: 'All observed transactions in the selected category across review classifications',
      gamblingTransactionShare: 'All observed transactions across merchant categories and classifications',
      spendingShare: 'All observed spending in the period',
    },
  }
  const forArea = (target: Area, range = query) => aggregate(scoped.filter((row) => geography.contains(row.place, target.id)), range)
  if (name === 'getGeographicRiskStatistics') {
    const args = scopes[name].parse(raw)
    const levels = { province: 1, district: 2, municipality: 3, town: 4 }
    if (args.measure === 'flaggedIncrease' && query.from === query.to) return { ...metadata, error: 'Select at least two months for change' }
    const ranked = geography.areas.filter((unit) => unit.level === levels[args.level] && geography.contains(unit.id, area.id)).flatMap((unit) => {
      const values = stats(forArea(unit, { ...query, category: args.measure === 'gamblingTransactionShare' ? '' : query.category }))
      if (!values) return []
      const first = args.measure === 'flaggedIncrease' ? stats(forArea(unit, { ...query, to: query.from })) : null
      const last = args.measure === 'flaggedIncrease' ? stats(forArea(unit, { ...query, from: query.to })) : null
      const figures = {
        spending: values.gamblingSpendZar, prevalence: values.affectedSharePercent,
        gamblingTransactionShare: values.gamblingTransactionSharePercent, reviewRate: values.reviewEventsPer1000,
        flaggedIncrease: first && last ? last.flaggedEvents - first.flaggedEvents : null,
      }
      const value = figures[args.measure]
      return value === null ? [] : [{ area: unit.name, value, statistics: values, ...(first && last ? { firstMonth: first, lastMonth: last } : {}) }]
    }).sort((a, b) => b.value - a.value || a.area.localeCompare(b.area)).slice(0, 10)
    return { ...metadata, category: args.measure === 'gamblingTransactionShare' ? 'All' : metadata.category, measure: args.measure, results: ranked }
  }
  if (name === 'compareProvinces') {
    const { first, second } = scopes[name].parse(raw)
    const provinces = [areaByName(geography, first, 1), areaByName(geography, second, 1)]
    if (provinces.some((province) => !province) || provinces[0]?.id === provinces[1]?.id) return { ...metadata, error: 'Provide two distinct provinces' }
    return { ...metadata, results: provinces.flatMap((province) => province ? [{ province: province.name, statistics: stats(forArea(province)) }] : []) }
  }
  if (name === 'getMerchantRiskBreakdown') {
    return { ...metadata, monitoredDistinctParticipants: metrics?.monitored ?? null, categories: metrics?.spending.map((category) =>
      ({ category: category.category, transactions: category.transactions, spendingZar: category.cents / 100 })) ?? [] }
  }
  if (name === 'getProgrammeStatistics') {
    return { ...metadata, results: programmes.filter((item) => !programme || item.id === programme.id).map((item) =>
      ({ programme: item.label, statistics: stats(aggregate(scoped, { ...query, programme: item.id })) })) }
  }
  if (name === 'getTransactionTrends') {
    return { ...metadata, periods: months.filter((value) => value >= query.from && value <= query.to)
      .map((value) => ({ month: value, statistics: stats(aggregate(scoped, { ...query, from: value, to: value })) })) }
  }
  return { ...metadata, statistics: stats(metrics) }
}
