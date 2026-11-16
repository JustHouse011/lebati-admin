export const workspaces = {
  global: 'Global workspace',
  sassa: 'SASSA',
  nsfas: 'NSFAS',
} as const

export type Workspace = keyof typeof workspaces
export type ProgrammeWorkspace = Exclude<Workspace, 'global'>
export const restrictionStates = ['OPEN', 'TEMPORARILY_RESTRICTED', 'RESTRICTED', 'UNDER_REVIEW', 'REOPENED'] as const
export const restrictionTransitions = {
  OPEN: ['TEMPORARILY_RESTRICTED', 'UNDER_REVIEW'],
  TEMPORARILY_RESTRICTED: ['RESTRICTED', 'UNDER_REVIEW', 'REOPENED'],
  RESTRICTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['RESTRICTED', 'REOPENED'],
  REOPENED: ['UNDER_REVIEW'],
} satisfies Record<(typeof restrictionStates)[number], (typeof restrictionStates)[number][]>

type Kind = 'person' | 'programme' | 'transaction' | 'risk' | 'merchant' | 'restriction' |
  'verification' | 'case' | 'intervention' | 'education' | 'audit' | 'user' | 'integration' | 'operator'

export type RecordItem = {
  id: string
  kind: Kind
  workspace: ProgrammeWorkspace
  programme: string
  name: string
  date: string
  status: string
  detail: string
  fields: Record<string, string>
  amount?: number
}

const programmeNames = {
  sassa: ['Older Persons Grant', 'Disability Grant', 'Child Support Grant', 'Social Relief of Distress'],
  nsfas: ['Tuition', 'Accommodation', 'Living allowance', 'Learning materials'],
}

const institutions = {
  sassa: ['North District Service Centre', 'Harbour District Service Centre'],
  nsfas: ['Silverridge Technical College', 'Cedar Valley University'],
}

const merchantProfiles = [
  { name: 'Fern Basket Market', category: 'Groceries', mcc: '5411', licence: 'Not applicable', level: 'Low', description: 'Grocery and pantry purchases' },
  { name: 'Northlight Wagering', category: 'Gambling', mcc: '7995', licence: 'Unverified', level: 'High', description: 'Sports wagering and account deposits' },
  { name: 'Copper Trail Cellars', category: 'Liquor', mcc: '5921', licence: 'Review due', level: 'Moderate', description: 'Packaged beer, wine and spirits' },
  { name: 'Cedar Transit', category: 'Transport', mcc: '4111', licence: 'Not applicable', level: 'Low', description: 'Local commuter fares' },
]

export function classifyNarrative(narrative: string) {
  const text = narrative.trim().toLowerCase()
  if (/\b(wager(?:ing)?|bet(?:ting)?|casino|sportsbook)\b/.test(text)) return 'Gambling indicator'
  if (/\b(liquor|cellars|beer|wine|spirits)\b/.test(text)) return 'Liquor indicator'
  if (/\b(grocery|groceries|pantry|supermarket)\b/.test(text)) return 'Groceries'
  if (/\b(transit|fare|commuter|transport)\b/.test(text)) return 'Transport'
  return 'Needs manual classification'
}

function createProgrammeData(workspace: ProgrammeWorkspace): RecordItem[] {
  const prefix = workspace.toUpperCase()
  const make = (kind: Kind, id: string, name: string, status: string, programme = '', fields: RecordItem['fields'] = {}, date = '2026-11-12', detail = ''): RecordItem =>
    ({ id: prefix + '-' + id, kind, workspace, programme, name, date, status, detail, fields })

  const programmes = programmeNames[workspace].map((name, i) =>
    make('programme', 'PR-' + (i + 1), name, 'Active', prefix + '-PR-' + (i + 1), { Owner: 'Programme services', 'Review cycle': 'Quarterly' }))
  const people = Array.from({ length: workspace === 'sassa' ? 38 : 26 }, (_, i) => {
    const number = String(i + 1).padStart(3, '0')
    const label = workspace === 'sassa' ? 'Beneficiary' : 'Student'
    return make('person', 'P-' + number, label + ' ' + number, i % 7 === 0 ? 'Pending' : 'Active', programmes[i % programmes.length].id, {
      Institution: institutions[workspace][Math.floor(i / 2) % 2],
      'Identity reference': 'SYN-' + prefix + '-' + number,
      'Monitoring history': i % 7 === 0 ? 'Enrolment evidence requested' : 'Enrolment confirmed',
    }, '2026-0' + (5 + i % 4) + '-01')
  })
  const merchants = merchantProfiles.map((item, i) =>
    make('merchant', 'M-' + (i + 1), item.name, item.licence, '', {
      Category: item.category, MCC: item.mcc, 'Risk level': item.level,
      'Classification basis': item.description, 'Monitoring history': 'Merchant profile reviewed on 12 November',
    }))
  const transactions = Array.from({ length: workspace === 'sassa' ? 132 : 108 }, (_, i) => {
    const person = people[i % people.length]
    const merchant = merchants[(i + Math.floor(i / 7)) % merchants.length]
    const month = String(6 + i % 6).padStart(2, '0')
    const day = String(1 + (i * 3) % 15).padStart(2, '0')
    const risk = merchant.fields.Category === 'Gambling' || (i % 13 === 0)
      ? 'Flagged' : merchant.fields.Category === 'Liquor' ? 'Monitoring' : 'Reviewed'
    const amount = (i % 13 === 0 ? 1280 : 36 + (i * 37) % 620) + 0.5
    return {
      ...make('transaction', 'TX-' + (i + 1), merchant.name, risk, person.programme, {
        'Account reference': person.id, Merchant: merchant.id, Category: merchant.fields.Category, MCC: merchant.fields.MCC,
        Narrative: merchant.fields['Classification basis'], Amount: String(amount),
        'Narrative classification': classifyNarrative(merchant.fields['Classification basis']),
      }, '2026-' + month + '-' + day),
      amount,
    }
  })
  const risks = transactions.filter((item) => item.status !== 'Reviewed').map((item, i) =>
    make('risk', 'R-' + (i + 1), item.fields.Category === 'Gambling' ? 'Gambling merchant indicator' :
      item.fields.Category === 'Liquor' ? 'Liquor merchant indicator' : 'Unusual transaction amount',
    i % 5 === 0 ? 'Reviewed' : 'Open', item.programme, {
      Transaction: item.id, Merchant: item.name, Evidence: item.fields.Narrative, 'Account reference': item.fields['Account reference'],
    }, item.date, 'Review the transaction and supporting context before recording a finding.'))
  const cases = risks.slice(0, workspace === 'sassa' ? 12 : 8).map((risk, i) =>
    make('case', 'C-' + (i + 1), risk.name, ['Open', 'Under review', 'Resolved'][i % 3], risk.programme, {
      Reviewer: ['Unassigned', 'Compliance desk', 'Programme services'][i % 3],
      Evidence: risk.id, 'Account reference': risk.fields['Account reference'], 'Appeal pathway': 'Request an independent programme review',
    }, risk.date, 'Review of the transaction evidence and account context.'))
  const restrictions = restrictionStates.map((status, i) => {
    const record = cases[i]
    return make('restriction', 'RS-' + (i + 1), record.fields['Account reference'], status, record.programme, {
      'Policy reference': 'LB-POL-04',
      Reason: 'Review of transaction evidence under programme policy',
      'Decision-maker': 'Compliance review panel',
      Evidence: record.id,
      'Effective date': '2026-11-05',
      'Review date': '2026-11-30',
      'Appeal pathway': 'Request independent review through the programme office',
    }, '2026-11-05', 'Policy record only. No account action is sent.')
  })
  const verifications = people.slice(0, 12).map((person, i) =>
    make('verification', 'V-' + (i + 1), person.name, i % 3 === 0 ? 'Pending' : 'Reviewed', person.programme, {
      'Account reference': person.id, Check: 'Enrolment evidence', Source: 'Workspace records',
    }, '2026-11-10'))
  const interventions = cases.slice(0, 6).map((item, i) =>
    make('intervention', 'I-' + (i + 1), ['Budget planning', 'Financial education', 'Independent case review'][i % 3],
      i < 2 ? 'Completed' : 'Scheduled', item.programme, {
        Case: item.id, 'Assigned team': 'Financial wellbeing', Outcome: i < 2 ? 'Follow-up plan recorded' : 'Awaiting follow-up',
      }))
  const education = ['Budget planning', 'Understanding merchant risk', 'Managing irregular expenses'].map((name, i) =>
    make('education', 'E-' + (i + 1), name, 'Available', '', { Format: 'Guided session', Duration: '30 minutes' }, '2026-11-01',
      ['List essential costs, set a weekly allowance and set aside an emergency buffer.', 'Review the merchant, amount and context before making a spending decision.', 'Set aside part of each payment for upcoming costs and compare spending with your plan.'][i]))
  const audit = restrictions.map((item, i) =>
    make('audit', 'A-' + (i + 1), 'Restriction record created', 'Recorded', item.programme,
      { Record: item.id, Actor: 'Compliance review panel', Decision: item.status }, item.date))
  const users = ['Programme administrator', 'Compliance reviewer', 'Financial wellbeing adviser'].map((name, i) =>
    make('user', 'U-' + (i + 1), name, 'Active', '', { Role: name, Access: workspaces[workspace] }))
  const integrations = ['Identity verification', 'Transaction feed', 'Institutional reporting'].map((name, i) =>
    make('integration', 'X-' + (i + 1), name, 'Disconnected', '', { Source: 'Workspace records', Connection: 'No external provider configured' }))
  const operators = institutions[workspace].map((name, i) =>
    make('operator', 'OP-' + (i + 1), name, 'Active', '', { Scope: workspaces[workspace], Contact: 'Programme services' }))
  return [...programmes, ...people, ...merchants, ...transactions, ...risks, ...cases, ...restrictions,
    ...verifications, ...interventions, ...education, ...audit, ...users, ...integrations, ...operators]
}

export const initialRecords = [...createProgrammeData('sassa'), ...createProgrammeData('nsfas')]

export const moduleDefinitions = {
  'beneficiary-registry': { label: 'Beneficiary Registry', kind: 'person' },
  programmes: { label: 'Programme Management', kind: 'programme' },
  transactions: { label: 'Transaction Monitoring', kind: 'transaction' },
  'risk-intelligence': { label: 'Risk Intelligence', kind: 'risk' },
  merchants: { label: 'Merchant Registry', kind: 'merchant' },
  restrictions: { label: 'Restrictions & Policies', kind: 'restriction' },
  verifications: { label: 'Verification Queue', kind: 'verification' },
  cases: { label: 'Cases & Appeals', kind: 'case' },
  interventions: { label: 'Referrals & Interventions', kind: 'intervention' },
  education: { label: 'Financial Education', kind: 'education' },
  'audit-logs': { label: 'Audit Logs', kind: 'audit' },
  'users-roles': { label: 'Users & Roles', kind: 'user' },
  integrations: { label: 'Integrations', kind: 'integration' },
  operators: { label: 'Operators', kind: 'operator' },
} as const satisfies Record<string, { label: string; kind: Kind }>

export type ModulePath = keyof typeof moduleDefinitions
