import { formatPreferredDate } from '../../services/mockProfile'
import BrandLogo from '../../components/BrandLogo'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  ChevronRight,
  CircleCheckBig,
  Clock3,
  CreditCard,
  DoorOpen,
  FileCheck2,
  IdCard,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react'
import {
  type ChangeEvent,
  type ClipboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

const STORAGE_KEY = 'lebati-onboarding-v1'
const OTP_CODE = '482153'
const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
] as const

const ROLE_LABELS = {
  'gambling-operator': 'Gambling Operator',
  'compliance-admin': 'Compliance Administrator',
  'authorised-user': 'Authorised User',
} as const

const roleCards = [
  {
    value: 'gambling-operator',
    title: 'Gambling Operator',
    description: 'Licensed gambling organisation, customer verification access and organisation-specific reporting.',
    icon: DoorOpen,
  },
  {
    value: 'compliance-admin',
    title: 'Compliance Administrator',
    description: 'Registry and restriction oversight, verification monitoring and compliance management.',
    icon: ShieldCheck,
  },
  {
    value: 'authorised-user',
    title: 'Authorised User',
    description: 'Restricted operational access, assigned organisation permissions and role-based verification.',
    icon: Users,
  },
] as const

type Role = (typeof roleCards)[number]['value']
type InvitationStatus = 'valid' | 'expired' | 'accepted' | 'invalid' | 'revoked'
type IdentityStatus = 'not-started' | 'consent-required' | 'in-progress' | 'verified' | 'failed' | 'pending-review' | 'unavailable'
type ContactStatus = 'not-started' | 'in-progress' | 'verified' | 'failed' | 'expired'
type ApplicationStatus = 'not-started' | 'pending-approval' | 'approved' | 'rejected' | 'returned-for-correction' | 'verification-pending'

type Invitation = {
  id: string
  email: string
  organisationName: string
  role: Role
  status: InvitationStatus
  expiryDate: string
  preapprovedOrg?: string
  scenario: 'operator-success' | 'compliance-pending' | 'failed-identity' | 'returned-correction'
}

type OnboardingDraft = {
  invitationId: string
  invitedEmail: string
  organisationName: string
  role: Role | ''
  scenario: Invitation['scenario']
  organisationType: string
  registrationNumber: string
  licenceNumber: string
  businessEmail: string
  contactNumber: string
  province: string
  city: string
  businessAddress: string
  representativeFirstName: string
  representativeSurname: string
  representativeEmail: string
  representativeMobile: string
  identityStatus: IdentityStatus
  contactStatus: ContactStatus
  applicationStatus: ApplicationStatus
  acknowledgements: {
    accuracy: boolean
    terms: boolean
    privacy: boolean
  }
  applicationReference: string
  submissionDate: string
}

const demoInvitations: Invitation[] = [
  {
    id: 'INV-1001',
    email: 'operator@lebati.demo',
    organisationName: 'Cape Gold Betting Group',
    role: 'gambling-operator',
    status: 'valid',
    expiryDate: '2026-12-31',
    preapprovedOrg: 'CAP-GOLD-01',
    scenario: 'operator-success',
  },
  {
    id: 'INV-1002',
    email: 'compliance.admin@lebati.demo',
    organisationName: 'Regulatory Compliance Services',
    role: 'compliance-admin',
    status: 'valid',
    expiryDate: '2026-12-31',
    preapprovedOrg: 'REG-COM-17',
    scenario: 'compliance-pending',
  },
  {
    id: 'INV-1003',
    email: 'authorised.user@lebati.demo',
    organisationName: 'Berea Operators Network',
    role: 'authorised-user',
    status: 'valid',
    expiryDate: '2026-12-31',
    preapprovedOrg: 'BER-OPS-02',
    scenario: 'returned-correction',
  },
  {
    id: 'INV-2001',
    email: 'expired@lebati.demo',
    organisationName: 'Northern Crest Casino',
    role: 'gambling-operator',
    status: 'expired',
    expiryDate: '2025-01-15',
    scenario: 'operator-success',
  },
  {
    id: 'INV-3001',
    email: 'revoked@lebati.demo',
    organisationName: 'Coastal Compliance Holdings',
    role: 'compliance-admin',
    status: 'revoked',
    expiryDate: '2026-12-31',
    scenario: 'compliance-pending',
  },
  {
    id: 'INV-4001',
    email: 'failed.identity@lebati.demo',
    organisationName: 'Urban Play Consortium',
    role: 'gambling-operator',
    status: 'valid',
    expiryDate: '2026-12-31',
    scenario: 'failed-identity',
  },
]

const organisationSchema = z.object({
  organisationName: z.string().trim().min(2, 'Organisation name is required.'),
  organisationType: z.string().min(2, 'Select the organisation type.'),
  registrationNumber: z.string().trim().min(3, 'Enter the registration number.'),
  licenceNumber: z.string().trim().optional().or(z.literal('')),
  businessEmail: z.string().trim().email('Provide a valid business email.'),
  contactNumber: z.string().trim().min(8, 'Enter a valid contact number.'),
  province: z.string().trim().min(2, 'Choose a province.'),
  city: z.string().trim().min(2, 'Enter the city.'),
  businessAddress: z.string().trim().min(8, 'Enter the business address.'),
  representativeFirstName: z.string().trim().min(2, 'Representative first name is required.'),
  representativeSurname: z.string().trim().min(2, 'Representative surname is required.'),
  representativeEmail: z.string().trim().email('Provide a valid representative email.'),
  representativeMobile: z.string().trim().min(8, 'Enter a valid representative mobile number.'),
})

type OrganisationFormValues = z.infer<typeof organisationSchema>

const createDefaultDraft = (): OnboardingDraft => ({
  invitationId: '',
  invitedEmail: '',
  organisationName: '',
  role: '',
  scenario: 'operator-success',
  organisationType: 'Licensed Gambling Operator',
  registrationNumber: '',
  licenceNumber: '',
  businessEmail: '',
  contactNumber: '',
  province: 'Gauteng',
  city: '',
  businessAddress: '',
  representativeFirstName: '',
  representativeSurname: '',
  representativeEmail: '',
  representativeMobile: '',
  identityStatus: 'not-started',
  contactStatus: 'not-started',
  applicationStatus: 'not-started',
  acknowledgements: {
    accuracy: false,
    terms: false,
    privacy: false,
  },
  applicationReference: '',
  submissionDate: '',
})

function mergeDraft(base: OnboardingDraft, partial: Partial<OnboardingDraft>): OnboardingDraft {
  return {
    ...base,
    ...partial,
    acknowledgements: {
      ...base.acknowledgements,
      ...(partial.acknowledgements ?? {}),
    },
  }
}

function loadDraft(): OnboardingDraft {
  if (typeof window === 'undefined') return createDefaultDraft()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultDraft()
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>
    return mergeDraft(createDefaultDraft(), parsed)
  } catch {
    return createDefaultDraft()
  }
}

function saveDraft(draft: OnboardingDraft) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
}

function getInvitationById(invitationId: string) {
  return demoInvitations.find((invitation) => invitation.id === invitationId) ?? null
}

function getApplicationReference(prefix: string) {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${prefix}-${suffix}`
}

function OnboardingShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#F6F8FA] text-[#102235]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(16,34,53,0.08)]">
          <div className="grid min-h-[92vh] lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="bg-[#102235] p-6 text-white lg:p-8">
              <div className="space-y-2">
                <BrandLogo className="w-48" />
                <div className="text-[10px] uppercase tracking-[0.28em] text-slate-300">Onboarding</div>
              </div>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="mb-2 flex items-center gap-2 text-[#C6A66B]">
                  <BadgeCheck className="h-4 w-4" />
                  <span className="text-[10px] uppercase tracking-[0.25em]">Progress</span>
                </div>
                <div className="space-y-2 text-sm text-slate-200">
                  <OnboardingProgress />
                </div>
              </div>
            </aside>

            <main className="bg-[#FFFFFF] p-5 sm:p-8 lg:p-10">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-light uppercase tracking-[0.25em] text-[#087E87]">Stage B</p>
                  <h1 className="mt-2 text-3xl font-light text-[#102235]">{title}</h1>
                  {subtitle ? <p className="mt-2 max-w-2xl text-sm text-slate-600">{subtitle}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.localStorage.removeItem(STORAGE_KEY)
                    window.location.href = '/onboarding/invitation'
                  }}
                  className="rounded-full border border-slate-200 px-3 py-2 text-xs font-light uppercase tracking-[0.18em] text-[#102235] transition hover:border-[#087E87] hover:text-[#087E87]"
                >
                  Reset demo
                </button>
              </div>
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}

function OnboardingProgress() {
  const location = useLocation()
  const path = location.pathname
  const steps = [
    { path: '/onboarding/invitation', label: 'Invitation' },
    { path: '/onboarding/role', label: 'Role' },
    { path: '/onboarding/organisation', label: 'Organisation' },
    { path: '/onboarding/identity', label: 'Identity' },
    { path: '/onboarding/contact', label: 'Contact' },
    { path: '/onboarding/review', label: 'Review' },
  ]

  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => path.startsWith(step.path)),
  )

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const isActive = index === currentIndex
        const isCompleted = index < currentIndex

        return (
          <div key={step.path} className="flex items-center gap-3">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-light ${
                isCompleted
                  ? 'border-[#087E87] bg-[#087E87] text-white'
                  : isActive
                    ? 'border-[#C6A66B] bg-[#FFF7EC] text-[#102235]'
                    : 'border-white/20 bg-transparent text-slate-300'
              }`}
            >
              {isCompleted ? '✓' : index + 1}
            </div>
            <div className="text-sm">{step.label}</div>
          </div>
        )
      })}
    </div>
  )
}

function InvitationPage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<OnboardingDraft>(() => loadDraft())

  const selectInvitation = (invitation: Invitation) => {
    setDraft((current) =>
      mergeDraft(current, {
        invitationId: invitation.id,
        invitedEmail: invitation.email,
        organisationName: invitation.organisationName,
        role: invitation.status === 'valid' ? invitation.role : '',
        scenario: invitation.scenario,
      }),
    )
  }

  const continueToRole = () => {
    const invitation = getInvitationById(draft.invitationId)
    if (!invitation || invitation.status !== 'valid') return
    const nextDraft = mergeDraft(draft, {
      role: invitation.role,
      organisationName: invitation.organisationName,
      invitedEmail: invitation.email,
    })
    saveDraft(nextDraft)
    navigate('/onboarding/role')
  }

  return (
    <OnboardingShell
      title="Invitation check"
      subtitle="Select a demo invitation to explore valid, expired, rejected and correction onboarding journeys."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {demoInvitations.map((invitation) => {
          const selected = draft.invitationId === invitation.id
          const isValid = invitation.status === 'valid'
          return (
            <button
              key={invitation.id}
              type="button"
              onClick={() => selectInvitation(invitation)}
              className={`rounded-[28px] border p-4 text-left transition ${
                selected
                  ? 'border-[#087E87] bg-[#F0FBFB] shadow-[0_12px_30px_rgba(8,126,135,0.12)]'
                  : 'border-slate-200 bg-[#F8FAFB] hover:border-[#C6A66B] hover:bg-[#FFF7EC]'
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#087E87]">
                    {isValid ? <BadgeCheck className="h-4 w-4" /> : <AlertCircle className="h-4 w-4 text-[#C34C4C]" />}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{invitation.id}</div>
                    <div className="text-sm font-light text-[#102235]">{ROLE_LABELS[invitation.role]}</div>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                  invitation.status === 'valid'
                    ? 'bg-[#EAF8F3] text-[#16836B]'
                    : 'bg-[#FEF3F3] text-[#C34C4C]'
                }`}>
                  {invitation.status}
                </span>
              </div>

              <div className="space-y-2 text-sm text-slate-700">
                <div className="font-light text-[#102235]">{invitation.organisationName}</div>
                <div>{invitation.email}</div>
                <div className="text-slate-500">Expires {invitation.expiryDate}</div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-8 rounded-[28px] border border-slate-200 bg-[#F8FAFB] p-5">
        <div className="mb-3 flex items-center gap-2 text-[#102235]">
          <KeyRound className="h-4 w-4 text-[#087E87]" />
          <span className="text-sm font-light uppercase tracking-[0.18em]">Demo scenario</span>
        </div>
        <p className="text-sm text-slate-600">The selected invitation determines the route and application status used during demo review.</p>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={continueToRole}
          disabled={!draft.invitationId}
          className="inline-flex items-center gap-2 rounded-xl bg-[#102235] px-5 py-3 text-sm font-light text-white transition hover:bg-[#0d1d2b] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Continue
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </OnboardingShell>
  )
}

function RolePage() {
  const navigate = useNavigate()
  const draft = loadDraft()
  const invitation = getInvitationById(draft.invitationId)

  const allowedRole = invitation?.status === 'valid' ? invitation.role : null

  const continueRoleSelection = () => {
    if (!allowedRole || !draft.role) return
    const nextDraft = mergeDraft(draft, { role: draft.role })
    saveDraft(nextDraft)
    navigate('/onboarding/organisation')
  }

  const handleRoleClick = (role: Role) => {
    const nextDraft = mergeDraft(draft, { role })
    saveDraft(nextDraft)
    navigate('/onboarding/organisation')
  }

  return (
    <OnboardingShell
      title="Select your role"
      subtitle="Choose the role associated with your invitation. The invitation determines which roles are permitted for this onboarding route."
    >
      {!invitation || invitation.status !== 'valid' ? (
        <div className="rounded-2xl border border-[#F1C5C5] bg-[#FEF3F3] p-4 text-sm text-[#C34C4C]">
          This invitation is not valid or has expired. Please return to the invitation page and choose an active invite.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {roleCards.map((card) => {
            const Icon = card.icon
            const disabled = card.value !== allowedRole
            const selected = draft.role === card.value || (!draft.role && card.value === allowedRole)
            return (
              <button
                key={card.value}
                type="button"
                disabled={disabled}
                onClick={() => handleRoleClick(card.value)}
                className={`group rounded-[28px] border p-5 text-left transition ${
                  selected
                    ? 'border-[#087E87] bg-[#F0FBFB] shadow-[0_12px_30px_rgba(8,126,135,0.12)]'
                    : disabled
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-65'
                      : 'border-slate-200 bg-[#F8FAFB] hover:border-[#C6A66B] hover:bg-[#FFF7EC]'
                }`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#087E87] shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  {selected ? (
                    <span className="rounded-full bg-[#EAF8F3] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#16836B]">selected</span>
                  ) : null}
                </div>
                <h2 className="text-xl font-light text-[#102235]">{card.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
                {disabled ? (
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#C34C4C]">Unavailable for this invitation</p>
                ) : (
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#087E87]">Allowed by invitation</p>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/onboarding/invitation')}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-light text-[#102235] transition hover:border-[#087E87] hover:text-[#087E87]"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </button>
        <button
          type="button"
          onClick={continueRoleSelection}
          disabled={!draft.role || !allowedRole || draft.role !== allowedRole}
          className="inline-flex items-center gap-2 rounded-xl bg-[#102235] px-5 py-3 text-sm font-light text-white transition hover:bg-[#0d1d2b] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </OnboardingShell>
  )
}

function OrganisationPage() {
  const navigate = useNavigate()
  const draft = loadDraft()
  const invitation = getInvitationById(draft.invitationId)

  const { register, handleSubmit, formState: { errors } } = useForm<OrganisationFormValues>({
    resolver: zodResolver(organisationSchema),
    defaultValues: {
      organisationName: draft.organisationName || invitation?.organisationName || '',
      organisationType: draft.organisationType || 'Licensed Gambling Operator',
      registrationNumber: draft.registrationNumber,
      licenceNumber: draft.licenceNumber,
      businessEmail: draft.businessEmail || draft.invitedEmail,
      contactNumber: draft.contactNumber,
      province: draft.province,
      city: draft.city,
      businessAddress: draft.businessAddress,
      representativeFirstName: draft.representativeFirstName,
      representativeSurname: draft.representativeSurname,
      representativeEmail: draft.representativeEmail,
      representativeMobile: draft.representativeMobile,
    },
  })

  const onSubmit = (values: OrganisationFormValues) => {
    const nextDraft = mergeDraft(draft, {
      organisationName: values.organisationName,
      organisationType: values.organisationType,
      registrationNumber: values.registrationNumber,
      licenceNumber: values.licenceNumber,
      businessEmail: values.businessEmail,
      contactNumber: values.contactNumber,
      province: values.province,
      city: values.city,
      businessAddress: values.businessAddress,
      representativeFirstName: values.representativeFirstName,
      representativeSurname: values.representativeSurname,
      representativeEmail: values.representativeEmail,
      representativeMobile: values.representativeMobile,
    })
    saveDraft(nextDraft)
    navigate('/onboarding/identity')
  }

  if (!draft.invitationId || !invitation) {
    return <Navigate to="/onboarding/invitation" replace />
  }

  return (
    <OnboardingShell
      title="Organisation details"
      subtitle="Enter your organisation and representative details. Relevant fields are prefilled for valid invitations where the organisation is already known."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-light text-[#102235]">Registered organisation name</label>
            <input {...register('organisationName')} className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20" />
            {errors.organisationName ? <p className="mt-1 text-sm text-[#C34C4C]">{errors.organisationName.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-light text-[#102235]">Organisation type</label>
            <select {...register('organisationType')} className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20">
              <option>Licensed Gambling Operator</option>
              <option>Compliance Organisation</option>
              <option>Government / Regulatory Organisation</option>
              <option>Other Authorised Organisation</option>
            </select>
            {errors.organisationType ? <p className="mt-1 text-sm text-[#C34C4C]">{errors.organisationType.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-light text-[#102235]">Company registration number</label>
            <input {...register('registrationNumber')} className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20" />
            {errors.registrationNumber ? <p className="mt-1 text-sm text-[#C34C4C]">{errors.registrationNumber.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-light text-[#102235]">Gambling licence number</label>
            <input {...register('licenceNumber')} className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20" placeholder="Optional for non-operators" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-light text-[#102235]">Business email</label>
            <input {...register('businessEmail')} className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20" />
            {errors.businessEmail ? <p className="mt-1 text-sm text-[#C34C4C]">{errors.businessEmail.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-light text-[#102235]">Contact number</label>
            <input {...register('contactNumber')} className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20" />
            {errors.contactNumber ? <p className="mt-1 text-sm text-[#C34C4C]">{errors.contactNumber.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-light text-[#102235]">Province</label>
            <select {...register('province')} className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20">
              {PROVINCES.map((province) => (
                <option key={province} value={province}>{province}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-light text-[#102235]">City</label>
            <input {...register('city')} className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20" />
            {errors.city ? <p className="mt-1 text-sm text-[#C34C4C]">{errors.city.message}</p> : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-light text-[#102235]">Business address</label>
            <textarea {...register('businessAddress')} rows={3} className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20" />
            {errors.businessAddress ? <p className="mt-1 text-sm text-[#C34C4C]">{errors.businessAddress.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-light text-[#102235]">Authorised representative first name</label>
            <input {...register('representativeFirstName')} className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20" />
            {errors.representativeFirstName ? <p className="mt-1 text-sm text-[#C34C4C]">{errors.representativeFirstName.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-light text-[#102235]">Authorised representative surname</label>
            <input {...register('representativeSurname')} className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20" />
            {errors.representativeSurname ? <p className="mt-1 text-sm text-[#C34C4C]">{errors.representativeSurname.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-light text-[#102235]">Representative email</label>
            <input {...register('representativeEmail')} className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20" />
            {errors.representativeEmail ? <p className="mt-1 text-sm text-[#C34C4C]">{errors.representativeEmail.message}</p> : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-light text-[#102235]">Representative mobile number</label>
            <input {...register('representativeMobile')} className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20" />
            {errors.representativeMobile ? <p className="mt-1 text-sm text-[#C34C4C]">{errors.representativeMobile.message}</p> : null}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <button type="button" onClick={() => navigate('/onboarding/role')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-light text-[#102235] hover:border-[#087E87] hover:text-[#087E87]">
            <ArrowLeft className="h-4 w-4" /> Previous
          </button>
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#102235] px-5 py-3 text-sm font-light text-white hover:bg-[#0d1d2b]">
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </OnboardingShell>
  )
}

function IdentityPage() {
  const navigate = useNavigate()
  const draft = loadDraft()
  const hasInvitation = Boolean(draft.invitationId)
  const [status, setStatus] = useState<IdentityStatus>(draft.identityStatus)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!hasInvitation) return
    const nextDraft = mergeDraft(draft, { identityStatus: status })
    saveDraft(nextDraft)
  }, [draft, hasInvitation, status])

  if (!hasInvitation) {
    return <Navigate to="/onboarding/invitation" replace />
  }

  const startVerification = () => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      const outcome = draft.scenario === 'failed-identity' ? 'failed' : 'verified'
      setStatus(outcome)
    }, 1200)
  }

  const handleOutcomeChange = (nextStatus: IdentityStatus) => {
    setStatus(nextStatus)
  }

  const canContinue = status === 'verified' || status === 'pending-review'

  return (
    <OnboardingShell
      title="Verify your identity"
      subtitle="Complete your identity verification securely through Who You. This is a simulated workflow for demo and approval purposes only."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-[#F8FAFB] p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#087E87] shadow-sm">
              <IdCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#087E87]">Who You</p>
              <h2 className="text-xl font-light text-[#102235]">Identity verification</h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-[#102235]">
                <ShieldCheck className="h-4 w-4 text-[#087E87]" />
                <span className="text-sm font-light">Process overview</span>
              </div>
              <p className="text-sm leading-6 text-slate-600">We use a mock Who You workflow to demonstrate verification states without collecting or storing real identity documents or biometric data.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-[#102235]">
                <FileCheck2 className="h-4 w-4 text-[#C6A66B]" />
                <span className="text-sm font-light">Privacy notice</span>
              </div>
              <p className="text-sm leading-6 text-slate-600">Identity verification is a simulated UI flow. No live identity numbers, government records, scans, selfies, or biometric data are collected in this demo.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <label className="mb-2 block text-sm font-light text-[#102235]">Demo outcome</label>
              <select
                value={status}
                onChange={(event) => handleOutcomeChange(event.target.value as IdentityStatus)}
                className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20"
              >
                <option value="not-started">Not started</option>
                <option value="consent-required">Consent required</option>
                <option value="in-progress">Verification in progress</option>
                <option value="verified">Identity verified</option>
                <option value="failed">Verification failed</option>
                <option value="pending-review">Pending manual review</option>
                <option value="unavailable">Verification unavailable</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={startVerification} className="rounded-xl bg-[#102235] px-4 py-3 text-sm font-light text-white hover:bg-[#0d1d2b]">
                {isLoading ? 'Starting...' : 'Start verification'}
              </button>
              {status === 'failed' ? (
                <button type="button" onClick={() => setStatus('in-progress')} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-light text-[#102235] hover:border-[#087E87] hover:text-[#087E87]">
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5">
          {isLoading ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 text-[#087E87]">
                <Clock3 className="h-5 w-5 animate-pulse" />
                <span className="text-sm font-light uppercase tracking-[0.18em]">Verification in progress</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <motion.div initial={{ width: '0%' }} animate={{ width: '78%' }} className="h-full rounded-full bg-[#087E87]" />
              </div>
            </div>
          ) : status === 'verified' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#16836B]">
                <CircleCheckBig className="h-5 w-5" />
                <span className="text-sm font-light uppercase tracking-[0.18em]">Verified</span>
              </div>
              <h3 className="text-2xl font-light text-[#102235]">Identity verified</h3>
              <div className="rounded-2xl border border-[#CFE9E1] bg-[#F1FBF6] p-4 text-sm text-slate-700">
                <div className="flex justify-between py-2"><span>Reference</span><span className="font-light text-[#102235]">WY-2026-482153</span></div>
                <div className="flex justify-between py-2"><span>Timestamp</span><span className="font-light text-[#102235]">2026-11-04 21:44</span></div>
                <div className="flex justify-between py-2"><span>Masked identifier</span><span className="font-light text-[#102235]">******4821</span></div>
              </div>
            </div>
          ) : status === 'failed' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#C34C4C]">
                <XCircle className="h-5 w-5" />
                <span className="text-sm font-light uppercase tracking-[0.18em]">Verification failed</span>
              </div>
              <h3 className="text-2xl font-light text-[#102235]">Review required</h3>
              <p className="text-sm leading-6 text-slate-600">The mock verification review did not pass the simulated checks. You may retry or request manual review.</p>
            </div>
          ) : status === 'pending-review' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#C6A66B]">
                <Clock3 className="h-5 w-5" />
                <span className="text-sm font-light uppercase tracking-[0.18em]">Pending review</span>
              </div>
              <h3 className="text-2xl font-light text-[#102235]">Awaiting manual review</h3>
              <p className="text-sm leading-6 text-slate-600">Your application has been paused pending a manual identity review. No privileged access will be granted until this is resolved.</p>
            </div>
          ) : status === 'unavailable' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#C34C4C]">
                <ShieldAlert className="h-5 w-5" />
                <span className="text-sm font-light uppercase tracking-[0.18em]">Unavailable</span>
              </div>
              <h3 className="text-2xl font-light text-[#102235]">Verification unavailable</h3>
              <p className="text-sm leading-6 text-slate-600">The mock service is temporarily unavailable. Please try again later.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-600">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-light uppercase tracking-[0.18em]">Not started</span>
              </div>
              <h3 className="text-2xl font-light text-[#102235]">Ready to start</h3>
              <p className="text-sm leading-6 text-slate-600">No verification has yet been completed. Start the self-service identity check to continue the onboarding flow.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
        <button type="button" onClick={() => navigate('/onboarding/organisation')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-light text-[#102235] hover:border-[#087E87] hover:text-[#087E87]">
          <ArrowLeft className="h-4 w-4" /> Previous
        </button>
        <button
          type="button"
          onClick={() => {
            const nextDraft = mergeDraft(draft, { identityStatus: status })
            saveDraft(nextDraft)
            navigate('/onboarding/contact')
          }}
          disabled={!canContinue}
          className="inline-flex items-center gap-2 rounded-xl bg-[#102235] px-5 py-3 text-sm font-light text-white hover:bg-[#0d1d2b] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </OnboardingShell>
  )
}

function ContactPage() {
  const navigate = useNavigate()
  const draft = loadDraft()
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''))
  const [status, setStatus] = useState<ContactStatus>(draft.contactStatus)
  const [countdown, setCountdown] = useState(30)
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (countdown === 0) {
      setStatus('expired')
      return
    }
    const timer = window.setInterval(() => setCountdown((current) => (current > 0 ? current - 1 : 0)), 1000)
    return () => window.clearInterval(timer)
  }, [countdown])

  useEffect(() => {
    const nextDraft = mergeDraft(draft, { contactStatus: status })
    saveDraft(nextDraft)
  }, [draft, status])

  const handleDigitChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return
    const nextValues = [...otpDigits]
    nextValues[index] = value
    setOtpDigits(nextValues)
    setStatus('in-progress')
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) inputRefs.current[index - 1]?.focus()
    if (event.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus()
    if (event.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const clipboardValue = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!clipboardValue) return
    event.preventDefault()
    const nextValues = Array.from({ length: 6 }, (_, index) => clipboardValue[index] ?? '')
    setOtpDigits(nextValues)
    setStatus('in-progress')
  }

  const verifyCode = () => {
    const code = otpDigits.join('')
    if (code === OTP_CODE) {
      setStatus('verified')
      return
    }
    setStatus('failed')
  }

  const resendCode = () => {
    setOtpDigits(Array(6).fill(''))
    setStatus('in-progress')
    setCountdown(30)
    inputRefs.current[0]?.focus()
  }

  const isComplete = otpDigits.every((digit) => digit !== '')

  return (
    <OnboardingShell
      title="Verify your contact details"
      subtitle="A fictional OTP challenge confirms the contact channel used for your onboarding application."
    >
      <div className="mx-auto max-w-3xl rounded-[30px] border border-slate-200 bg-[#F8FAFB] p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#087E87] shadow-sm">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#087E87]">OTP verification</p>
              <h2 className="mt-1 text-2xl font-light text-[#102235]">Your contact details have been verified successfully.</h2>
            </div>
          </div>
          <div className="rounded-full border border-[#C6A66B] bg-[#FFF7EC] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#102235]">{countdown}s</div>
        </div>

        <div className="mt-8 flex justify-between gap-3">
          {otpDigits.map((digit, index) => (
            <input
              key={index}
              ref={(node) => {
                inputRefs.current[index] = node
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(event: ChangeEvent<HTMLInputElement>) => handleDigitChange(index, event.target.value)}
              onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(index, event)}
              onPaste={handlePaste}
              aria-label={`OTP digit ${index + 1}`}
              className="h-14 w-12 rounded-xl border border-slate-200 bg-white text-center text-xl font-light text-[#102235] shadow-sm outline-none focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20"
            />
          ))}
        </div>

        {status === 'failed' ? (
          <div className="mt-4 rounded-xl border border-[#F1C5C5] bg-[#FEF3F3] px-3 py-2 text-sm text-[#C34C4C]">The code entered was invalid. Use the demo OTP: {OTP_CODE}.</div>
        ) : null}

        {status === 'expired' ? (
          <div className="mt-4 rounded-xl border border-[#F1C5C5] bg-[#FEF3F3] px-3 py-2 text-sm text-[#C34C4C]">This mock OTP has expired. Please request a new code.</div>
        ) : null}

        {status === 'verified' ? (
          <div className="mt-4 rounded-xl border border-[#BFE6D8] bg-[#EAF8F3] px-3 py-2 text-sm text-[#16836B]">Your contact details have been verified successfully.</div>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={resendCode} className="text-sm font-light text-[#087E87] hover:text-[#065d68]">Resend code</button>
          <button type="button" onClick={verifyCode} disabled={!isComplete} className="rounded-xl bg-[#102235] px-5 py-3 text-sm font-light text-white hover:bg-[#0d1d2b] disabled:cursor-not-allowed disabled:bg-slate-300">
            Verify code
          </button>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
        <button type="button" onClick={() => navigate('/onboarding/identity')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-light text-[#102235] hover:border-[#087E87] hover:text-[#087E87]">
          <ArrowLeft className="h-4 w-4" /> Previous
        </button>
        <button type="button" onClick={() => navigate('/onboarding/review')} disabled={status !== 'verified'} className="inline-flex items-center gap-2 rounded-xl bg-[#102235] px-5 py-3 text-sm font-light text-white hover:bg-[#0d1d2b] disabled:cursor-not-allowed disabled:bg-slate-300">
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </OnboardingShell>
  )
}

function ReviewPage() {
  const navigate = useNavigate()
  const draft = loadDraft()
  const [acknowledgements, setAcknowledgements] = useState(draft.acknowledgements)

  const canSubmit = acknowledgements.accuracy && acknowledgements.terms && acknowledgements.privacy

  const handleSubmitApplication = () => {
    if (!canSubmit) return

    const status: ApplicationStatus =
      draft.scenario === 'operator-success'
        ? 'approved'
        : draft.scenario === 'compliance-pending'
          ? 'pending-approval'
          : draft.scenario === 'failed-identity'
            ? 'verification-pending'
            : 'returned-for-correction'

    const nextDraft = mergeDraft(draft, {
      acknowledgements,
      applicationStatus: status,
      applicationReference: getApplicationReference('LBT-APP'),
      submissionDate: new Date().toISOString(),
    })

    saveDraft(nextDraft)
    navigate('/onboarding/status')
  }

  return (
    <OnboardingShell
      title="Review your application"
      subtitle="Confirm the details of your onboarding application before submitting to the demo approval queue."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="rounded-[28px] border border-slate-200 bg-[#F8FAFB] p-5">
            <div className="mb-4 flex items-center gap-2 text-[#102235]">
              <Building2 className="h-4 w-4 text-[#087E87]" />
              <span className="text-sm font-light uppercase tracking-[0.18em]">Organisation</span>
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <div><span className="font-light text-[#102235]">Name:</span> {draft.organisationName}</div>
              <div><span className="font-light text-[#102235]">Type:</span> {draft.organisationType}</div>
              <div><span className="font-light text-[#102235]">Registration:</span> {draft.registrationNumber}</div>
              <div><span className="font-light text-[#102235]">Location:</span> {draft.city}, {draft.province}</div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-[#F8FAFB] p-5">
            <div className="mb-4 flex items-center gap-2 text-[#102235]">
              <UserRound className="h-4 w-4 text-[#087E87]" />
              <span className="text-sm font-light uppercase tracking-[0.18em]">Representative</span>
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <div>{draft.representativeFirstName} {draft.representativeSurname}</div>
              <div>{draft.representativeEmail}</div>
              <div>{draft.representativeMobile}</div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-[#F8FAFB] p-5">
            <div className="mb-4 flex items-center gap-2 text-[#102235]">
              <ShieldCheck className="h-4 w-4 text-[#087E87]" />
              <span className="text-sm font-light uppercase tracking-[0.18em]">Verification</span>
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <div><span className="font-light text-[#102235]">Who You:</span> {draft.identityStatus}</div>
              <div><span className="font-light text-[#102235]">Mobile / email OTP:</span> {draft.contactStatus}</div>
              <div><span className="font-light text-[#102235]">Invitation:</span> {draft.invitationId}</div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2 text-[#102235]">
            <CreditCard className="h-4 w-4 text-[#087E87]" />
            <span className="text-sm font-light uppercase tracking-[0.18em]">Mandatory declarations</span>
          </div>
          <div className="space-y-4 text-sm text-slate-700">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-[#F8FAFB] p-3">
              <input type="checkbox" checked={acknowledgements.accuracy} onChange={() => setAcknowledgements((current) => ({ ...current, accuracy: !current.accuracy }))} className="mt-1 h-4 w-4 rounded border-slate-300 text-[#087E87]" />
              <span>I confirm that the information provided is accurate to the best of my knowledge.</span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-[#F8FAFB] p-3">
              <input type="checkbox" checked={acknowledgements.terms} onChange={() => setAcknowledgements((current) => ({ ...current, terms: !current.terms }))} className="mt-1 h-4 w-4 rounded border-slate-300 text-[#087E87]" />
              <span>I accept the Lebati platform terms applicable to this onboarding journey.</span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-[#F8FAFB] p-3">
              <input type="checkbox" checked={acknowledgements.privacy} onChange={() => setAcknowledgements((current) => ({ ...current, privacy: !current.privacy }))} className="mt-1 h-4 w-4 rounded border-slate-300 text-[#087E87]" />
              <span>I acknowledge the privacy notice and understand the simulation is demo-only.</span>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
        <button type="button" onClick={() => navigate('/onboarding/contact')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-light text-[#102235] hover:border-[#087E87] hover:text-[#087E87]">
          <ArrowLeft className="h-4 w-4" /> Previous
        </button>
        <button type="button" onClick={handleSubmitApplication} disabled={!canSubmit} className="inline-flex items-center gap-2 rounded-xl bg-[#102235] px-5 py-3 text-sm font-light text-white hover:bg-[#0d1d2b] disabled:cursor-not-allowed disabled:bg-slate-300">
          Submit application
        </button>
      </div>
    </OnboardingShell>
  )
}

function StatusPage() {
  const navigate = useNavigate()
  const draft = loadDraft()

  const statusMeta: Record<ApplicationStatus, { title: string; description: string; action: string; tone: string }> = {
    'pending-approval': {
      title: 'Pending approval',
      description: 'Your onboarding application has been received and is awaiting administrator review. No privileged access has been granted yet.',
      action: 'Return to login',
      tone: 'bg-[#EAF8F3] text-[#16836B]',
    },
    approved: {
      title: 'Application approved',
      description: 'Your organisation and role have been confirmed in this mock environment. You may continue to the demo workspace.',
      action: 'Continue to demo workspace',
      tone: 'bg-[#EAF8F3] text-[#16836B]',
    },
    rejected: {
      title: 'Application rejected',
      description: 'Your onboarding application has been rejected in this fictional workflow. Contact support for guidance on the next steps.',
      action: 'Review feedback',
      tone: 'bg-[#FEF3F3] text-[#C34C4C]',
    },
    'returned-for-correction': {
      title: 'Returned for correction',
      description: 'Some fields require additional attention before resubmission. You may return to onboarding and correct the indicated information.',
      action: 'Resume onboarding',
      tone: 'bg-[#FFF7EC] text-[#102235]',
    },
    'verification-pending': {
      title: 'Verification pending',
      description: 'Your identity verification is under manual review. No approval or activation will occur until the review is resolved.',
      action: 'Review status',
      tone: 'bg-[#FFF7EC] text-[#102235]',
    },
    'not-started': {
      title: 'Not started',
      description: 'The onboarding flow has not yet been submitted.',
      action: 'Return to review',
      tone: 'bg-[#F8FAFB] text-[#102235]',
    },
  }

  const state = statusMeta[draft.applicationStatus]

  return (
    <OnboardingShell title="Application status" subtitle="Your onboarding result is tracked in this mock workflow for demo and design review.">
      <div className="mx-auto max-w-2xl rounded-[32px] border border-slate-200 bg-[#F8FAFB] p-8 text-center">
        <div className={`mx-auto inline-flex items-center rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] ${state.tone}`}>
          {state.title}
        </div>
        <h2 className="mt-6 text-3xl font-light text-[#102235]">{state.title}</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600">{state.description}</p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-left text-sm text-slate-700">
          <div className="flex justify-between gap-3 py-2"><span>Reference</span><span className="font-light text-[#102235]">{draft.applicationReference || 'LBT-APP-0000'}</span></div>
          <div className="flex justify-between gap-3 py-2"><span>Submitted</span><span className="font-light text-[#102235]">{draft.submissionDate ? formatPreferredDate(draft.submissionDate, true) : 'Not available'}</span></div>
          <div className="flex justify-between gap-3 py-2"><span>Role</span><span className="font-light text-[#102235]">{draft.role ? ROLE_LABELS[draft.role as Role] : 'Not chosen'}</span></div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={() => navigate('/onboarding/review')} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-light text-[#102235] hover:border-[#087E87] hover:text-[#087E87]">
            Review details
          </button>
          <button type="button" onClick={() => navigate('/login')} className="rounded-xl bg-[#102235] px-4 py-3 text-sm font-light text-white hover:bg-[#0d1d2b]">
            {state.action}
          </button>
        </div>
      </div>
    </OnboardingShell>
  )
}

export function OnboardingFlow() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/onboarding/invitation" replace />} />
      <Route path="/invitation" element={<InvitationPage />} />
      <Route path="/role" element={<RolePage />} />
      <Route path="/organisation" element={<OrganisationPage />} />
      <Route path="/identity" element={<IdentityPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/review" element={<ReviewPage />} />
      <Route path="/status" element={<StatusPage />} />
    </Routes>
  )
}

export default OnboardingFlow
