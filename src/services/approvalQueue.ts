export type QueueRecord = {
  id: string
  applicant: string
  organisation: string
  type: string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Needs correction' | 'Manual review'
  risk: 'Low' | 'Medium' | 'High'
  owner: string
  verificationStatus: 'verified' | 'incomplete' | 'manual-review'
  submittedAt: string
  lastAction: string
  reason?: string
}

const APPROVAL_STORAGE_KEY = 'lebati-dashboard-approvals'

const initialApprovals: QueueRecord[] = [
  { id: 'APP-1042', applicant: 'Mpho Ndlovu', organisation: 'Cape Gold Betting Group', type: 'Operator onboarding', status: 'Pending', risk: 'Medium', owner: 'Compliance desk', verificationStatus: 'verified', submittedAt: '2026-11-04', lastAction: 'Awaiting review' },
  { id: 'APP-1047', applicant: 'Lerato Mokoena', organisation: 'Harbour Resorts SA', type: 'Beneficiary review', status: 'Manual review', risk: 'High', owner: 'Risk operations', verificationStatus: 'manual-review', submittedAt: '2026-11-03', lastAction: 'Identity mismatch escalated' },
  { id: 'APP-1051', applicant: 'Sipho Mthembu', organisation: 'Berea Operators Network', type: 'Authorised user access', status: 'Needs correction', risk: 'Low', owner: 'Team lead', verificationStatus: 'incomplete', submittedAt: '2026-11-02', lastAction: 'Proof of authority missing', reason: 'Missing delegated authority letter' },
  { id: 'APP-1055', applicant: 'Naledi Van Wyk', organisation: 'Sunset Play', type: 'Operator onboarding', status: 'Approved', risk: 'Low', owner: 'Compliance desk', verificationStatus: 'verified', submittedAt: '2026-11-01', lastAction: 'Approved by review board' },
]


export function readApprovals(): QueueRecord[] {
  try {
    const stored = localStorage.getItem(APPROVAL_STORAGE_KEY)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    return initialApprovals
  }
  return initialApprovals
}

export function saveApprovals(approvals: QueueRecord[]) {
  localStorage.setItem(APPROVAL_STORAGE_KEY, JSON.stringify(approvals))
}

export function submitApproval(record: QueueRecord) {
  saveApprovals([record, ...readApprovals().filter((item) => item.id !== record.id)])
}
