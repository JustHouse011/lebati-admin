/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { answerGeographicQuestion, suggestions } from './geographicAnswers'
import { aggregate, authorisedCohorts, categories, country, defaultFilters, indexGeography, minimumCohort,
  syntheticCohorts, type Area, type Cohort } from './geographicRisk'

const { areas } = JSON.parse(readFileSync('public/za-geography.json', 'utf8')) as { areas: Area[] }
const geography = indexGeography(areas)
const data = syntheticCohorts(geography)
const globalAccess = { role: 'Global Administrator' } as const

function sample(classification: Cohort['classification'], people: number, affected: number): Cohort {
  const spending = Object.fromEntries(categories.map((category) => [category, { transactions: 0, cents: 0 }])) as Cohort['periods'][number]['spending']
  spending.Gambling = { transactions: affected * 2, cents: affected * 2000 }
  spending.Groceries = { transactions: people, cents: people * 1000 }
  return {
    place: areas.find(({ level }) => level === 4)!.id, programme: 'nsfas-tuition', workspace: 'nsfas', institution: 'University cohort',
    people, gamblingGroup: affected, classification,
    periods: ['2026-08', '2026-09'].map((month) => ({ month, spending, referrals: 0, cases: 0, unusual: 0 })),
  }
}

describe('geographic boundary hierarchy', () => {
  it('contains all provinces, districts and municipal shapes, and assigns each town to its enclosing levels', () => {
    expect(geography.children(country.id)).toHaveLength(9)
    expect(areas.filter(({ level }) => level === 2)).toHaveLength(52)
    expect(areas.filter(({ level }) => level === 3)).toHaveLength(213)
    for (const area of areas) expect(geography.lineage(area.id).map(({ level }) => level)).toEqual(Array.from({ length: area.level + 1 }, (_, i) => i))
    const stellenbosch = areas.find(({ name, level }) => name === 'Stellenbosch' && level === 4)!
    expect(geography.lineage(stellenbosch.id).at(1)?.name).toBe('Western Cape')
    expect(new Set(areas.map(({ id }) => id)).size).toBe(areas.length)
  })
})

describe('geographic publication', () => {
  it('uses unique participants over time and preserves the correct denominators under transaction filters', () => {
    const groups = [sample('Flagged for review', 20, 10), sample('No review indicator', 30, 10)]
    const filtered = aggregate(groups, { ...defaultFilters, category: 'Gambling', classification: 'Flagged for review' })!
    expect(filtered).toMatchObject({
      monitored: 50, affected: 10, gamblingTransactions: 40, gamblingCents: 40000,
      averageCents: 4000, observedCents: 180000, prevalence: 20, eventRate: 800,
      observedTransactions: 80, flaggedTransactionRate: 50,
    })
    expect(filtered.spendingShare).toBeCloseTo(40000 / 180000 * 100)
    expect(aggregate(groups, defaultFilters)?.affected).toBe(20)
  })

  it('withholds unsafe fixed cohorts from broad totals and from every narrower filter', () => {
    const safe = sample('Flagged for review', 25, 12)
    const unsafeA = sample('No review indicator', 25, minimumCohort - 1)
    const unsafeB = sample('Flagged for review', 25, 23)
    const contaminated = { ...safe, periods: safe.periods.map((period) => ({ ...period, referrals: 4 })) }
    expect(aggregate([unsafeA, unsafeB, contaminated], defaultFilters)).toBeNull()
    expect(aggregate([safe, unsafeA], defaultFilters)).toEqual(aggregate([safe], defaultFilters))
    expect(aggregate([safe, unsafeA], { ...defaultFilters, classification: 'No review indicator' })).toMatchObject({ monitored: 25, affected: 0 })
  })

  it('restricts scopes for institutional staff and pairs each agent programme with its authorised area', () => {
    const nsfas = authorisedCohorts(data, { role: 'NSFAS Administrator', programmes: ['nsfas-tuition', 'sassa-child'] }, 'global', geography)
    expect(new Set(nsfas.map(({ programme }) => programme))).toEqual(new Set(['nsfas-tuition']))
    expect(authorisedCohorts(nsfas, globalAccess, 'sassa', geography)).toEqual([])
    const sassa = authorisedCohorts(data, { role: 'SASSA Administrator', programmes: ['sassa-child'] }, 'sassa', geography)
    expect(new Set(sassa.map(({ programme }) => programme))).toEqual(new Set(['sassa-child']))
    const province = geography.children(country.id)[0]
    const grant = { programme: 'sassa-child', area: province.id }
    const agent = authorisedCohorts(data, { role: 'Agent', grants: [grant] }, 'global', geography)
    expect(agent.length).toBeGreaterThan(0)
    expect(agent.every((cohort) => cohort.programme === grant.programme && geography.contains(cohort.place, grant.area))).toBe(true)
  })

  it('answers geographic questions from the scoped aggregate and states its period and denominator', () => {
    const nsfas = authorisedCohorts(data, globalAccess, 'nsfas', geography)
    const spend = answerGeographicQuestion(suggestions[0], nsfas, country, defaultFilters, geography)
    expect(spend).toMatch(/highest recorded gambling-related spending/)
    expect(spend).toMatch(/monitored participants/)
    expect(spend).toMatch(/2026-05 to 2026-10.*synthetic/)
    const rates = answerGeographicQuestion(suggestions[1], nsfas, country, defaultFilters, geography)
    expect(rates).toMatch(/flagged out of .* recorded transactions/)
    expect(answerGeographicQuestion(suggestions[3], nsfas, country, defaultFilters, geography)).toMatch(/No reportable synthetic data/)
  })
})
