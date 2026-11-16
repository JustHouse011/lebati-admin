export type Area = {
  id: string
  name: string
  level: 0 | 1 | 2 | 3 | 4
  parent?: string
  path?: string
  frame?: [number, number, number, number]
  point?: [number, number]
}

export type ProgrammeScope = 'nsfas' | 'sassa'
export type GeoWorkspace = 'global' | ProgrammeScope
export type GeoAccess =
  | { role: 'Global Administrator' }
  | { role: 'NSFAS Administrator'; programmes: string[] }
  | { role: 'SASSA Administrator'; programmes: string[] }
  | { role: 'Agent'; grants: { programme: string; area: string }[] }

export const geographyLevels = ['Country', 'Province', 'District or metro', 'Municipality', 'Town or city'] as const
export const country: Area = { id: 'ZA', name: 'South Africa', level: 0, frame: [0, 0, 780, 590] }
export const minimumCohort = 10
export const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'] as const
export const categories = ['Gambling', 'Groceries', 'Transport', 'Liquor', 'Education', 'Other'] as const
export type Category = typeof categories[number]
export const classifications = ['Flagged for review', 'No review indicator'] as const
export type Classification = typeof classifications[number]
export const programmes = [
  { id: 'nsfas-tuition', label: 'Tuition', workspace: 'nsfas' },
  { id: 'nsfas-accommodation', label: 'Accommodation', workspace: 'nsfas' },
  { id: 'nsfas-living', label: 'Living allowance', workspace: 'nsfas' },
  { id: 'sassa-older', label: 'Older Persons Grant', workspace: 'sassa' },
  { id: 'sassa-disability', label: 'Disability Grant', workspace: 'sassa' },
  { id: 'sassa-child', label: 'Child Support Grant', workspace: 'sassa' },
  { id: 'sassa-relief', label: 'Social Relief of Distress', workspace: 'sassa' },
] as const

export type GeoFilters = { programme: string; from: string; to: string; category: '' | Category; classification: '' | Classification }
export type MapMeasure = 'eventRate' | 'gamblingCents' | 'prevalence'
export const defaultFilters: GeoFilters = { programme: '', from: months[0], to: months[months.length - 1], category: '', classification: '' }

export type Cohort = {
  place: string
  programme: string
  workspace: ProgrammeScope
  institution: string
  people: number
  gamblingGroup: number
  classification: Classification
  periods: readonly CohortPeriod[]
}
type CohortPeriod = {
  month: string
  spending: Record<Category, { transactions: number; cents: number }>
  referrals: number
  cases: number
  unusual: number
}

export type Metrics = {
  monitored: number
  affected: number
  gamblingTransactions: number
  gamblingCents: number
  observedCents: number
  totalTransactions: number
  observedTransactions: number
  flaggedEvents: number
  referrals: number
  cases: number
  unusual: number
  averageCents: number | null
  spendingShare: number | null
  prevalence: number | null
  eventRate: number | null
  flaggedTransactionRate: number | null
  spending: { category: Category; cents: number; transactions: number }[]
}

export function indexGeography(areas: Area[]) {
  const byId = new Map([country, ...areas].map((area) => [area.id, area]))
  const lineage = (id: string) => {
    const trail: Area[] = []
    let area = byId.get(id)
    while (area) {
      trail.unshift(area)
      area = area.parent ? byId.get(area.parent) : area.id === country.id ? undefined : country
    }
    return trail
  }
  const children = (id: string) => areas.filter((area) => (area.parent ?? country.id) === id)
  const contains = (place: string, area: string) => lineage(place).some((item) => item.id === area)
  return { areas, byId, lineage, children, contains }
}
export type Geography = ReturnType<typeof indexGeography>

function seed(text: string) {
  return [...text].reduce((hash, letter) => (Math.imul(hash, 31) + letter.charCodeAt(0)) >>> 0, 17)
}

export function syntheticCohorts(geography: Geography): Cohort[] {
  return geography.areas.filter((area) => area.level === 4).flatMap((place) => programmes.flatMap((programme) => {
    const institutions = programme.workspace === 'nsfas'
      ? [place.name + ' · University cohort', place.name + ' · TVET college cohort'] : ['']
    return institutions.flatMap((institution) => classifications.map((classification) => {
      const key = seed(place.id + programme.id + institution + classification)
      const flagged = classification === 'Flagged for review'
      const people = (flagged ? 30 : 110) + key % 73
      const gamblingGroup = flagged ? minimumCohort + key % 17 : key % 4 === 0 ? minimumCohort + key % 10 : 0
      const periods = months.map((month, index) => {
        const spending = {} as CohortPeriod['spending']
        categories.forEach((category, categoryIndex) => {
          const members = category === 'Gambling' ? gamblingGroup : people
          const transactions = members * (1 + (key + index * (categoryIndex + 1)) % (category === 'Gambling' ? 3 : 5))
          const average = [95, 210, 120, 75, 420, 130][categoryIndex] + (key + index * 17) % 107
          spending[category] = { transactions, cents: transactions * average * 100 }
        })
        return {
          month, spending,
          referrals: flagged && (key + index) % 3 === 0 ? minimumCohort + key % 8 : 0,
          cases: flagged && (key + index) % 4 === 0 ? minimumCohort + key % 6 : 0,
          unusual: flagged && (key + index) % 2 === 0 ? minimumCohort + key % 9 : 0,
        }
      })
      return { place: place.id, programme: programme.id, workspace: programme.workspace, institution, people, gamblingGroup, classification, periods }
    }))
  }))
}

function permitsProgramme(access: GeoAccess, programme: typeof programmes[number]) {
  switch (access.role) {
    case 'Global Administrator': return true
    case 'NSFAS Administrator': return programme.workspace === 'nsfas' && access.programmes.includes(programme.id)
    case 'SASSA Administrator': return programme.workspace === 'sassa' && access.programmes.includes(programme.id)
    case 'Agent': return access.grants.some((grant) => grant.programme === programme.id)
  }
}

export function allowedProgrammes(access: GeoAccess, workspace: GeoWorkspace) {
  return programmes.filter((programme) => (workspace === 'global' || workspace === programme.workspace) && permitsProgramme(access, programme))
}

export function authorisedCohorts(cohorts: readonly Cohort[], access: GeoAccess, workspace: GeoWorkspace, geography: Geography) {
  const allowed = new Set<string>(allowedProgrammes(access, workspace).map((programme) => programme.id))
  return cohorts.filter((cohort) => {
    const programme = programmes.find((item) => item.id === cohort.programme)
    return programme?.workspace === cohort.workspace && allowed.has(cohort.programme) &&
      (access.role !== 'Agent' || access.grants.some((grant) => grant.programme === cohort.programme && geography.contains(cohort.place, grant.area)))
  })
}

function isPublishable(cohort: Cohort) {
  const eligible = (count: number) => count === 0 || count >= minimumCohort
  return cohort.people >= minimumCohort && eligible(cohort.gamblingGroup) && eligible(cohort.people - cohort.gamblingGroup) &&
    cohort.periods.every((period) => eligible(period.referrals) && eligible(period.cases) && eligible(period.unusual) &&
      Object.values(period.spending).every((entry) => eligible(entry.transactions)))
}

// Release whole fixed, disjoint cohorts or withhold them from every view. No individual records are generated.
export function aggregate(cohorts: readonly Cohort[], filters: GeoFilters): Metrics | null {
  const scope = cohorts.filter((cohort) => (!filters.programme || cohort.programme === filters.programme) && isPublishable(cohort))
  const spending = categories.map((category) => ({ category, cents: 0, transactions: 0 }))
  let monitored = 0, affected = 0, observedCents = 0, eligibleTransactions = 0, flaggedEvents = 0, referrals = 0, cases = 0, unusual = 0
  for (const cohort of scope) {
    const periods = cohort.periods.filter(({ month }) => month >= filters.from && month <= filters.to)
    if (!periods.length) continue
    monitored += cohort.people
    const matches = !filters.classification || filters.classification === cohort.classification
    if (matches && (!filters.category || filters.category === 'Gambling') &&
      periods.some((period) => period.spending.Gambling.transactions > 0)) affected += cohort.gamblingGroup
    for (const period of periods) {
      for (const item of spending) {
        const entry = period.spending[item.category]
        observedCents += entry.cents
        if (filters.category && filters.category !== item.category) continue
        eligibleTransactions += entry.transactions
        if (!matches) continue
        item.cents += entry.cents
        item.transactions += entry.transactions
        if (cohort.classification === 'Flagged for review') flaggedEvents += entry.transactions
      }
    }
    if (matches) {
      const snapshot = periods[periods.length - 1]
      referrals += snapshot.referrals
      cases += snapshot.cases
      unusual += filters.category ? 0 : snapshot.unusual
    }
  }
  if (monitored < minimumCohort) return null
  const gambling = spending[0]
  const totalTransactions = spending.reduce((sum, entry) => sum + entry.transactions, 0)
  return {
    monitored, affected, gamblingTransactions: gambling.transactions, gamblingCents: gambling.cents, observedCents,
    totalTransactions, observedTransactions: eligibleTransactions, flaggedEvents, referrals, cases, unusual, spending,
    averageCents: affected ? gambling.cents / affected : null,
    spendingShare: observedCents ? 100 * gambling.cents / observedCents : null,
    prevalence: 100 * affected / monitored,
    eventRate: 1000 * flaggedEvents / monitored,
    flaggedTransactionRate: eligibleTransactions ? 100 * flaggedEvents / eligibleTransactions : null,
  }
}

export function reportRows(areas: Area[], data: Cohort[], filters: GeoFilters, geography: Geography) {
  return areas.map((area) => ({ area, metrics: aggregate(data.filter((cohort) => geography.contains(cohort.place, area.id)), filters) }))
}

export const formatCount = (value: number) => new Intl.NumberFormat('en-ZA').format(value)
const currency = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2 })
export const formatMoney = (cents: number) => currency.format(cents / 100)
export const formatRate = (value: number) => value.toFixed(1)
export const displayPeriod = (from: string, to: string) => from === to ? from : from + ' to ' + to
export const showMeasure = (measure: MapMeasure, value: number) =>
  measure === 'gamblingCents' ? formatMoney(value) : formatRate(value) + (measure === 'prevalence' ? '%' : '')
