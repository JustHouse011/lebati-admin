import { aggregate, displayPeriod, formatCount, formatMoney, formatRate, months, programmes, reportRows,
  type Area, type Cohort, type Geography, type GeoFilters } from './geographicRisk'

export const suggestions = [
  'Which province has the highest recorded gambling-related spending among monitored NSFAS students?',
  'Which municipality has the highest rate of flagged transactions?',
  'How has gambling-related spending changed over the past three months?',
  'Which SASSA programme has the most open financial wellness referrals?',
  'Explain why this area has been flagged.',
]

export function answerGeographicQuestion(question: string, data: Cohort[], area: Area, filters: GeoFilters, geography: Geography) {
  const query = question.toLowerCase()
  let scoped = data.filter((cohort) => geography.contains(cohort.place, area.id))
  if (query.includes('nsfas')) scoped = scoped.filter((cohort) => cohort.workspace === 'nsfas')
  if (query.includes('sassa')) scoped = scoped.filter((cohort) => cohort.workspace === 'sassa')
  const summary = aggregate(scoped, filters)
  if (!summary) return `No reportable synthetic data is available for this scope in ${displayPeriod(filters.from, filters.to)}. The monitored denominator is unavailable.`
  const context = `Reporting period: ${displayPeriod(filters.from, filters.to)}. Scope: ${area.name}. Source: synthetic workspace records.`
  const denominator = ` ${formatCount(summary.monitored)} distinct monitored participants in scope.`
  if (/provinc/.test(query) && /gambl|spend/.test(query)) {
    const [top] = reportRows(geography.areas.filter((unit) => unit.level === 1), scoped, filters, geography)
      .filter((row) => row.metrics && row.metrics.gamblingCents > 0)
      .sort((a, b) => b.metrics!.gamblingCents - a.metrics!.gamblingCents || a.area.name.localeCompare(b.area.name))
    if (!top?.metrics) return `No gambling spending matched these filters. ${context}${denominator}`
    return `${top.area.name} has the highest recorded gambling-related spending at ${formatMoney(top.metrics.gamblingCents)}, among ${formatCount(top.metrics.monitored)} monitored participants in that province. This ranking compares spending volume. ${context}`
  }
  if (/municipal/.test(query) && /rate|flag/.test(query)) {
    const [top] = reportRows(geography.areas.filter((unit) => unit.level === 3), scoped, filters, geography)
      .filter((row) => row.metrics && row.metrics.flaggedEvents > 0)
      .sort((a, b) => b.metrics!.flaggedTransactionRate! - a.metrics!.flaggedTransactionRate! || a.area.name.localeCompare(b.area.name))
    if (!top?.metrics || top.metrics.flaggedTransactionRate == null) return `No flagged transaction rate can be ranked for these filters. ${context}${denominator}`
    return `${top.area.name} has the highest share of transactions flagged for review at ${formatRate(top.metrics.flaggedTransactionRate)}% (${formatCount(top.metrics.flaggedEvents)} flagged out of ${formatCount(top.metrics.observedTransactions)} recorded transactions across review classifications). ${formatCount(top.metrics.monitored)} participants were monitored there. ${context}`
  }
  if (/three month|3 month|chang|trend/.test(query) && /gambl|spend/.test(query)) {
    const selected = months.filter((month) => month >= filters.from && month <= filters.to).slice(-3)
    if (selected.length < 3) return `Select a reporting range with at least three months. ${context}${denominator}`
    const figures = selected.map((month) => aggregate(scoped, { ...filters, from: month, to: month }))
    const values = selected.map((month, index) => `${month}: ${figures[index] ? formatMoney(figures[index].gamblingCents) : 'unavailable'}`).join(', ')
    const delta = figures[2] && figures[0] ? figures[2].gamblingCents - figures[0].gamblingCents : null
    const change = delta === null ? '' : ` Net change: ${formatMoney(delta)}.`
    return `Gambling-related spending for ${displayPeriod(selected[0], selected[2])}: ${values}.${change} ${context}${denominator}`
  }
  if (/referral/.test(query)) {
    const rows = programmes.filter((programme) => programme.workspace === 'sassa' && (!filters.programme || programme.id === filters.programme))
      .map((programme) => ({ programme, metrics: aggregate(scoped, { ...filters, programme: programme.id }) }))
      .filter((row) => row.metrics && row.metrics.referrals > 0)
      .sort((a, b) => b.metrics!.referrals - a.metrics!.referrals)
    const [top] = rows
    if (!top?.metrics) return `No open SASSA referrals matched these filters. ${context}${denominator}`
    return `${top.programme.label} has the most open financial wellness referrals, with ${formatCount(top.metrics.referrals)} as of ${filters.to} among ${formatCount(top.metrics.monitored)} monitored beneficiaries. ${context}`
  }
  if (/why|explain/.test(query) && /flag|risk|area/.test(query)) {
    if (!summary.flaggedEvents) return `${area.name} has no recorded review indicators under these filters. ${context}${denominator}`
    const flagged = aggregate(scoped, { ...filters, classification: 'Flagged for review' })
    const largest = flagged?.spending.slice().sort((a, b) => b.transactions - a.transactions)[0]
    const concentration = largest?.transactions ? ` ${largest.category} had the most indicators, with ${formatCount(largest.transactions)} flagged transactions.` : ''
    return `${area.name} recorded ${formatCount(summary.flaggedEvents)} transaction review indicators, or ${formatRate(summary.eventRate ?? 0)} per 1,000 monitored participants.${concentration} The synthetic merchant and review classifications identify records for human review. ${context}${denominator}`
  }
  return `I can calculate province spending rankings, municipal transaction rates, three-month spending trends, open SASSA referrals, and review-indicator summaries. ${context}${denominator}`
}
