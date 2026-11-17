import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Download,
  FileText,
  Gauge,
  IdCard,
  LayoutDashboard,
  MapPin,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Sun,
  UserCircle2,
  Users,
  X,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { APP_NAME } from '../../appName'
import BrandLogo from '../../components/BrandLogo'
import AssistantProvider from '../assistant/AssistantProvider'
import WorkspaceOverview from './WorkspaceOverview'
import WorkspaceModule, { type RecordChange } from './WorkspaceModule'
import { initialRecords, moduleDefinitions, workspaces, type ModulePath, type RecordItem, type Workspace } from './workspaceData'
import ProfileMenu from '../settings/ProfileMenu'
import { AccountPage, HelpPage, NotificationsPage, ProfilePage, SecurityPage } from '../settings/SettingsPages'
import { readApprovals, saveApprovals, type QueueRecord } from '../../services/approvalQueue'
import { getStoredSessionUser } from '../../services/mockAuth'
import { getProfile, getNotificationPreferences, formatPreferredDate } from '../../services/mockProfile'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const GeographicRiskPage = lazy(() => import('../geography/GeographicRiskPage'))
const globalGeographicAccess = { role: 'Global Administrator' } as const

type DashboardRole = 'Global Administrator' | 'Compliance Administrator' | 'Gambling Operator' | 'Authorised User'

type DemoUser = {
  name: string
  email: string
  role: DashboardRole
}

type DashboardMetric = {
  label: string
  value: string
  delta: string
  positive: boolean
}

const THEME_STORAGE_KEY = 'lebati-dashboard-theme'
const WORKSPACE_STORAGE_KEY = 'lebathi-workspace'
const RECORDS_STORAGE_KEY = 'lebathi-workspace-records-v1'
const HIGHLIGHT_COLOURS = ['#087E87', '#102235', '#C6A66B', '#16836B', '#C34C4C']

const navMap = {
  'Global Administrator': [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Verifications', path: '/dashboard/verifications', icon: ShieldCheck },
    { label: 'Beneficiary Registry', path: '/dashboard/beneficiary-registry', icon: Building2 },
    { label: 'Programmes', path: '/dashboard/programmes', icon: BriefcaseBusiness },
    { label: 'Transactions', path: '/dashboard/transactions', icon: CreditCard },
    { label: 'Risk Intelligence', path: '/dashboard/risk-intelligence', icon: Gauge },
    { label: 'Geographic Risk Intelligence', path: '/dashboard/geographic-risk', icon: MapPin },
    { label: 'Merchants', path: '/dashboard/merchants', icon: Building2 },
    { label: 'Restrictions', path: '/dashboard/restrictions', icon: AlertTriangle },
    { label: 'Cases & Appeals', path: '/dashboard/cases', icon: FileText },
    { label: 'Interventions', path: '/dashboard/interventions', icon: ShieldCheck },
    { label: 'Financial Education', path: '/dashboard/education', icon: CircleHelp },
    { label: 'Operators', path: '/dashboard/operators', icon: BriefcaseBusiness },
    { label: 'Onboarding Approvals', path: '/dashboard/approvals', icon: Users },
    { label: 'Users & Roles', path: '/dashboard/users-roles', icon: UserCircle2 },
    { label: 'Audit Logs', path: '/dashboard/audit-logs', icon: FileText },
    { label: 'Reports', path: '/dashboard/reports', icon: Gauge },
    { label: 'Integrations', path: '/dashboard/integrations', icon: Plug },
    { label: 'Settings', path: '/settings/account', icon: Settings },
  ],
  'Compliance Administrator': [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Restrictions', path: '/dashboard/restrictions', icon: AlertTriangle },
    { label: 'Exceptions', path: '/dashboard/exceptions', icon: ShieldX },
    { label: 'Reviews', path: '/dashboard/reviews', icon: FileText },
    { label: 'Audit Activity', path: '/dashboard/audit-activity', icon: Gauge },
    { label: 'Approvals', path: '/dashboard/approvals', icon: Users },
  ],
  'Gambling Operator': [
    { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { label: 'New Verification', path: '/dashboard/new-verification', icon: Sparkles },
    { label: 'Verification History', path: '/dashboard/verification-history', icon: FileText },
    { label: 'Restriction Results', path: '/dashboard/restriction-results', icon: ShieldCheck },
    { label: 'Organisation', path: '/dashboard/organisation', icon: Building2 },
    { label: 'Team Members', path: '/dashboard/team-members', icon: Users },
  ],
  'Authorised User': [
    { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Assigned Records', path: '/dashboard/assigned-records', icon: FileText },
    { label: 'Permitted Actions', path: '/dashboard/permitted-actions', icon: Check },
    { label: 'Organisation', path: '/dashboard/organisation', icon: Building2 },
  ],
} as const

const verificationTrend = [
  { name: 'Jan', total: 180, passes: 130, reviews: 22 },
  { name: 'Feb', total: 220, passes: 170, reviews: 31 },
  { name: 'Mar', total: 260, passes: 190, reviews: 36 },
  { name: 'Apr', total: 290, passes: 220, reviews: 44 },
  { name: 'May', total: 330, passes: 260, reviews: 49 },
  { name: 'Jun', total: 370, passes: 290, reviews: 54 },
]

const doorStatusData = [
  { name: 'Open', value: 46 },
  { name: 'Monitoring', value: 28 },
  { name: 'Restricted', value: 14 },
  { name: 'Manual review', value: 12 },
]

const operatorActivity = [
  { name: 'Cape Gold', checks: 120, completions: 96 },
  { name: 'Sunset Play', checks: 98, completions: 82 },
  { name: 'Ridge Resorts', checks: 84, completions: 68 },
  { name: 'Harbour Group', checks: 72, completions: 54 },
]

const approvalPipeline = [
  { name: 'Received', value: 42 },
  { name: 'Screening', value: 27 },
  { name: 'Review', value: 18 },
  { name: 'Approved', value: 10 },
  { name: 'Corrections', value: 7 },
]

function readSession(): DemoUser | null { return getStoredSessionUser() }

function getAllowedPaths(role: DashboardRole) {
  return navMap[role].map((item) => item.path)
}

function DashboardHeader({ user, workspace, onWorkspaceChange, onThemeToggle, theme, onNotificationsToggle, notificationsOpen }: {
  user: DemoUser
  workspace: Workspace
  onWorkspaceChange: (workspace: Workspace) => void
  onThemeToggle: () => void
  theme: 'light' | 'dark'
  onNotificationsToggle: () => void
  notificationsOpen: boolean
}) {
  const [profile, setProfile] = useState(getProfile)
  const [notificationPreferences, setNotificationPreferences] = useState(getNotificationPreferences)
  useEffect(() => {
    const refresh = () => { setProfile(getProfile()); setNotificationPreferences(getNotificationPreferences()) }
    window.addEventListener('lebati-profile-change', refresh)
    return () => window.removeEventListener('lebati-profile-change', refresh)
  }, [])
  const isDark = theme === 'dark'
  const themeButtonLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <header className={`mb-6 flex flex-col gap-4 rounded-[24px] border p-4 shadow-[0_12px_30px_rgba(16,34,53,0.04)] sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-slate-700 bg-[#0f172a]' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-3">
        <div>
          <BrandLogo className="w-32" />
          <h1 className={`mt-1 text-3xl font-light ${isDark ? 'text-white' : 'text-[#102235]'}`}>{user.role}</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {user.role === 'Global Administrator' && <label className="grid min-w-0 gap-1 text-xs">
          <span className="sr-only">Workspace</span>
          <select aria-label="Workspace" className="settings-input max-w-full py-2 text-sm" value={workspace} onChange={(event) => onWorkspaceChange(event.target.value as Workspace)}>
            {Object.entries(workspaces).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>}
        <button type="button" aria-label={themeButtonLabel} title={themeButtonLabel} onClick={onThemeToggle} className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${isDark ? 'border-slate-700 bg-slate-900 text-[#C6A66B]' : 'border-slate-200 bg-[#F8FAFB] text-[#102235]'}`}>
          {isDark ? <Sun className="h-4 w-4" strokeWidth={1.75} /> : <Moon className="h-4 w-4" strokeWidth={1.75} />}
        </button>
        <div className="relative">
          <button type="button" aria-label="Notifications" title="Notifications" onClick={onNotificationsToggle} className={`relative rounded-full border p-2.5 ${isDark ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-slate-200 bg-[#F8FAFB] text-slate-600'}`}>
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#C6A66B]" />
          </button>
          {notificationsOpen ? (
            <div className={`absolute right-0 top-14 z-20 w-80 max-w-[calc(100vw-6rem)] rounded-[20px] border p-3 shadow-[0_18px_42px_rgba(16,34,53,0.12)] ${isDark ? 'border-slate-700 bg-[#111827]' : 'border-slate-200 bg-white'}`}>
              <div className="mb-2 flex items-center justify-between"><span className={`text-xs uppercase tracking-[0.18em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Notifications</span><span className="text-xs text-[#087E87]">{notificationPreferences.inApp ? [notificationPreferences.restrictions, notificationPreferences.approvals, notificationPreferences.exceptions].filter(Boolean).length : 0} new</span></div>
              {!notificationPreferences.inApp && <p className="p-2 text-sm">In-app notifications are turned off.</p>}
              <div className="space-y-2">
                {(notificationPreferences.inApp ? [notificationPreferences.restrictions && 'New restriction review assigned', notificationPreferences.approvals && 'Onboarding approval updated', notificationPreferences.exceptions && 'Verification exception cleared'].filter(Boolean) : []).map((item) => (
                  <div key={item} className={`rounded-2xl border p-2 text-sm ${isDark ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-200 bg-[#F8FAFB] text-slate-700'}`}>{item}</div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <ProfileMenu profile={profile} role={user.role} dark={isDark} />
      </div>
    </header>
  )
}

function DashboardSidebar({ user, theme, workspace }: { user: DemoUser; theme: 'light' | 'dark'; workspace: Workspace }) {
  const location = useLocation()
  const items = navMap[user.role]
  const isDark = theme === 'dark'
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('lebati-sidebar-collapsed') === 'true')
  const toggleSidebar = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('lebati-sidebar-collapsed', String(next))
  }

  return (
    <aside aria-label="Main sidebar" className={`sticky top-0 flex h-dvh shrink-0 flex-col border-r transition-[width] duration-200 motion-reduce:transition-none ${isDark ? 'border-slate-700 bg-[#0f172a]' : 'border-slate-200 bg-white'} w-16 md:w-20 ${collapsed ? 'lg:w-20' : 'lg:w-[260px]'}`}>
      <div className={`flex min-h-20 flex-col justify-center gap-2 border-b px-2 py-4 md:px-3 ${collapsed ? '' : 'lg:px-5'} ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <BrandLogo className="w-full lg:w-44" />
        <div className={`hidden text-xs ${collapsed ? '' : 'lg:block'} ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{APP_NAME}</div>
        <button type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed} aria-controls="workspace-navigation" onClick={toggleSidebar}
          className="hidden h-9 items-center justify-center gap-2 rounded-lg border border-slate-400/40 text-xs hover:bg-teal/10 focus-visible:outline-2 focus-visible:outline-teal lg:flex">
          {collapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <><PanelLeftClose size={17} aria-hidden="true" /><span>Collapse sidebar</span></>}
        </button>
      </div>
      <nav id="workspace-navigation" aria-label="Workspace navigation" className="mt-4 flex-1 space-y-1.5 overflow-y-auto px-2 py-2">
        {items.map(({ label, path, icon: Icon }) => {
          const isActive = location.pathname === path || (path === '/settings/account' && location.pathname.startsWith('/settings/')) || (path !== '/dashboard' && location.pathname.startsWith(path))
          const itemLabel = workspace === 'nsfas' && path === '/dashboard/beneficiary-registry' ? 'Student Registry' : label
          return (
            <NavLink key={path} to={path} end={path === '/dashboard'} aria-label={itemLabel} title={itemLabel} className={`flex items-center justify-center gap-3 rounded-2xl px-2 py-2.5 text-sm transition ${collapsed ? '' : 'lg:justify-start lg:px-3'} ${isActive ? 'bg-[#087E87] text-white shadow-[0_12px_24px_rgba(8,126,135,0.25)]' : isDark ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-[#F3F7FA] hover:text-[#102235]'}`}>
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              <span className={collapsed ? 'hidden' : 'hidden lg:inline'}>{itemLabel}</span>
            </NavLink>
          )
        })}
      </nav>
      <div className={`mt-auto hidden ${collapsed ? '' : 'lg:block'} rounded-[26px] border p-4 ${isDark ? 'border-slate-700 bg-slate-900/70' : 'border-[#C6A66B]/30 bg-[#FFF9F0]'}`}>
        <div className={`mb-2 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-[#102235]'}`}>
          <ShieldCheck className="h-4 w-4 text-[#087E87]" strokeWidth={1.75} />
          <span className="text-[10px] uppercase tracking-[0.2em]">Status</span>
        </div>
        <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Workspace records are managed in this browser.</p>
      </div>
    </aside>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div role="status" className="settings-card flex items-center gap-4"><BrandLogo className="w-28" /><span className="text-sm">Loading workspace</span></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-[24px] border border-slate-200 bg-slate-100" />)}</div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
        <div className="h-64 animate-pulse rounded-[28px] border border-slate-200 bg-slate-100" />
        <div className="h-64 animate-pulse rounded-[28px] border border-slate-200 bg-slate-100" />
      </div>
    </div>
  )
}

function OverviewPage({ user }: { user: DemoUser }) {
  const metrics: DashboardMetric[] = user.role === 'Global Administrator'
    ? [
        { label: 'Total verifications', value: '1,284', delta: '+8.4%', positive: true },
        { label: 'Active restrictions', value: '74', delta: '-12%', positive: false },
        { label: 'Registered operators', value: '26', delta: '+3', positive: true },
        { label: 'Pending approvals', value: '18', delta: '+6%', positive: true },
      ]
    : user.role === 'Compliance Administrator'
      ? [
          { label: 'Restriction alerts', value: '42', delta: '+9%', positive: true },
          { label: 'Exceptions open', value: '12', delta: '-2%', positive: false },
          { label: 'Pending reviews', value: '08', delta: '+4%', positive: true },
          { label: 'Audit drift', value: '1.6%', delta: '-0.4%', positive: false },
        ]
      : user.role === 'Gambling Operator'
        ? [
            { label: 'Open checks', value: '18', delta: '+6%', positive: true },
            { label: 'Approved today', value: '32', delta: '+14%', positive: true },
            { label: 'Restrictions triggered', value: '04', delta: '-1', positive: false },
            { label: 'Response time', value: '3.2h', delta: '-0.5h', positive: true },
          ]
        : [
            { label: 'Assigned records', value: '12', delta: '+2', positive: true },
            { label: 'Approved actions', value: '34', delta: '+8%', positive: true },
            { label: 'Open tasks', value: '05', delta: '-1', positive: false },
            { label: 'Permitted scope', value: '3/4', delta: '+1', positive: true },
          ]

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#087E87]">Operational summary</p>
          <h2 className="mt-2 text-2xl font-light text-[#102235]">{user.role === 'Global Administrator' ? 'Platform oversight' : user.role === 'Compliance Administrator' ? 'Restriction monitoring' : user.role === 'Gambling Operator' ? 'Organisation overview' : 'Assigned activity'}</h2>
        </div>
        <button type="button" className="inline-flex items-center gap-2 rounded-full border border-[#C6A66B]/60 bg-[#FFF9F0] px-3 py-2 text-sm font-light text-[#102235]">
          <Download className="h-4 w-4" />
          Export report
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <motion.div key={metric.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(16,34,53,0.03)]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{metric.label}</span>
              <span className={`rounded-full px-2 py-1 text-[10px] font-light uppercase tracking-[0.16em] ${metric.positive ? 'bg-[#EAF8F3] text-[#16836B]' : 'bg-[#FEF3F3] text-[#C34C4C]'}`}>{metric.delta}</span>
            </div>
            <div className="mt-5 text-3xl font-light text-[#102235]">{metric.value}</div>
          </motion.div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-slate-200 bg-white p-5">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Performance</p>
              <h3 className="mt-2 text-xl font-light text-[#102235]">Verification activity</h3>
            </div>
            <button type="button" className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600">Week <ChevronDown className="h-3.5 w-3.5" /></button>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer>
              <AreaChart data={verificationTrend}>
                <defs>
                  <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#087E87" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#087E87" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="total" stroke="#087E87" fill="url(#trendFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Distribution</p>
              <h3 className="mt-2 text-xl font-light text-[#102235]">Door status</h3>
            </div>
            <span className="rounded-full bg-[#FFF7EC] px-2 py-1 text-[10px] font-light uppercase tracking-[0.18em] text-[#102235]">Live</span>
          </div>
          <div className="mt-4 h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={doorStatusData} dataKey="value" nameKey="name" innerRadius={32} outerRadius={60} paddingAngle={4}>
                  {doorStatusData.map((entry, index) => <Cell key={entry.name} fill={HIGHLIGHT_COLOURS[index % HIGHLIGHT_COLOURS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 text-sm text-slate-700">
            {doorStatusData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HIGHLIGHT_COLOURS[index % HIGHLIGHT_COLOURS.length] }} />{item.name}</div>
                <span className="font-light text-[#102235]">{item.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
      {user.role === 'Global Administrator' ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1.2fr]">
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Operator activity</p>
                <h3 className="mt-2 text-xl font-light text-[#102235]">Verification activity</h3>
              </div>
            </div>
            <div className="h-52">
              <ResponsiveContainer>
                <BarChart data={operatorActivity}>
                  <CartesianGrid stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="checks" radius={[8, 8, 0, 0]} fill="#102235" />
                  <Bar dataKey="completions" radius={[8, 8, 0, 0]} fill="#087E87" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.section>
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Pipeline</p>
                <h3 className="mt-2 text-xl font-light text-[#102235]">Onboarding approval</h3>
              </div>
            </div>
            <div className="h-52">
              <ResponsiveContainer>
                <BarChart data={approvalPipeline} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={90} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#C6A66B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.section>
        </div>
      ) : null}
    </>
  )
}

function ApprovalQueuePage() {
  const [approvals, setApprovals] = useState(readApprovals)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | QueueRecord['status']>('all')
  const [selectedId, setSelectedId] = useState<string | null>(approvals[0]?.id ?? null)
  const [sortKey, setSortKey] = useState<'submittedAt' | 'risk'>('submittedAt')
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [decisionReason, setDecisionReason] = useState('')

  useEffect(() => {
    const refresh = () => setApprovals(readApprovals())
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  const filtered = useMemo(() => {
    const query = search.toLowerCase()
    return approvals.filter((item) => (statusFilter === 'all' ? true : item.status === statusFilter)).filter((item) => !query || [item.id, item.applicant, item.organisation, item.type].join(' ').toLowerCase().includes(query)).sort((a, b) => {
      if (sortKey === 'risk') {
        const order = { High: 3, Medium: 2, Low: 1 }
        return order[b.risk] - order[a.risk]
      }
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    })
  }, [approvals, search, sortKey, statusFilter])

  const pageSize = 3
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)
  const selected = approvals.find((entry) => entry.id === selectedId) ?? pageItems[0] ?? null

  function completeDecision(action: 'Approve' | 'Reject' | 'Return for Correction' | 'Request Manual Review', item: QueueRecord) {
    if (action === 'Approve' && item.verificationStatus !== 'verified') {
      window.alert('Approval blocked. Verification checks are incomplete for this application.')
      return
    }
    if ((action === 'Reject' || action === 'Return for Correction') && !decisionReason.trim()) {
      window.alert('A reason is required before rejecting or returning an application for correction.')
      return
    }
    const nextStatus: QueueRecord['status'] = action === 'Approve' ? 'Approved' : action === 'Reject' ? 'Rejected' : action === 'Return for Correction' ? 'Needs correction' : 'Manual review'
    const updated = readApprovals().map((entry) => (entry.id === item.id ? { ...entry, status: nextStatus, lastAction: 'Application status updated to ' + nextStatus.toLowerCase(), reason: decisionReason.trim() || entry.reason } : entry))
    try {
      saveApprovals(updated)
    } catch {
      window.alert('This decision could not be saved in this browser.')
      return
    }
    setApprovals(updated)
    setDecisionReason('')
    setDrawerOpen(false)
  }

  const allowApproval = selected?.verificationStatus === 'verified'

  return (
    <div className="space-y-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#087E87]">Approvals</p>
          <h2 className="mt-2 text-2xl font-light text-[#102235]">Onboarding approval queue</h2>
        </div>
        <button type="button" onClick={() => setDrawerOpen(true)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-[#102235]">View details</button>
      </div>
      <div className="rounded-[28px] border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-[#F8FAFB] px-3 py-2 text-sm text-slate-600">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applications" className="w-48 bg-transparent outline-none" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | QueueRecord['status'])} className="rounded-full border border-slate-200 bg-[#F8FAFB] px-3 py-2 text-sm text-[#102235]">
              <option value="all">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Manual review">Manual review</option>
              <option value="Needs correction">Needs correction</option>
              <option value="Approved">Approved</option>
            </select>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as 'submittedAt' | 'risk')} className="rounded-full border border-slate-200 bg-[#F8FAFB] px-3 py-2 text-sm text-[#102235]">
              <option value="submittedAt">Newest</option>
              <option value="risk">Risk</option>
            </select>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-slate-300 bg-[#F8FAFB] p-8 text-center text-slate-600">No applications match the current filter selection.</div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="overflow-hidden rounded-[20px] border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-[#F8FAFB] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-light">Applicant</th>
                    <th className="px-4 py-3 font-light">Org</th>
                    <th className="px-4 py-3 font-light">Status</th>
                    <th className="px-4 py-3 font-light">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => (
                    <tr key={item.id} className={`cursor-pointer border-t border-slate-200 ${selectedId === item.id ? 'bg-[#F1FBF6]' : 'bg-white'}`} onClick={() => { setSelectedId(item.id); setDrawerOpen(true) }}>
                      <td className="px-4 py-3"><div className="font-light text-[#102235]">{item.applicant}</div><div className="text-xs text-slate-500">{item.id}</div></td>
                      <td className="px-4 py-3 text-slate-600">{item.organisation}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${item.status === 'Approved' ? 'bg-[#EAF8F3] text-[#16836B]' : item.status === 'Rejected' ? 'bg-[#FEF3F3] text-[#C34C4C]' : item.status === 'Needs correction' ? 'bg-[#FFF7EC] text-[#102235]' : 'bg-[#EEF4FF] text-[#102235]'}`}>{item.status}</span></td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${item.risk === 'High' ? 'bg-[#FEF3F3] text-[#C34C4C]' : item.risk === 'Medium' ? 'bg-[#FFF7EC] text-[#102235]' : 'bg-[#EAF8F3] text-[#16836B]'}`}>{item.risk}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-[#F8FAFB] p-4">
              {selected ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Selected application</p>
                      <h3 className="mt-2 text-xl font-light text-[#102235]">{selected.applicant}</h3>
                    </div>
                    <span className="rounded-full bg-[#EAF8F3] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#16836B]">{selected.status}</span>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div className="flex justify-between"><span>Organisation</span><span>{selected.organisation}</span></div>
                    <div className="flex justify-between"><span>Type</span><span>{selected.type}</span></div>
                    <div className="flex justify-between"><span>Verification</span><span>{selected.verificationStatus}</span></div>
                    <div className="flex justify-between"><span>Owner</span><span>{selected.owner}</span></div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <button type="button" onClick={() => { setSelectedId(selected.id); setDrawerOpen(true) }} className="w-full rounded-xl bg-[#102235] px-4 py-3 text-sm font-light text-white">View application</button>
                    <button type="button" onClick={() => completeDecision('Approve', selected)} disabled={!allowApproval} className="w-full rounded-xl border border-[#087E87] bg-[#EAF8F3] px-4 py-3 text-sm font-light text-[#087E87] disabled:cursor-not-allowed disabled:opacity-50">Approve</button>
                    <button type="button" onClick={() => completeDecision('Request Manual Review', selected)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-light text-[#102235]">Request manual review</button>
                    <button type="button" onClick={() => { setDecisionReason(''); setDrawerOpen(true) }} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-light text-[#102235]">Reject or correct</button>
                  </div>
                </>
              ) : <div className="py-10 text-sm text-slate-600">Select an application to preview details.</div>}
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-full border border-slate-200 px-3 py-2 text-sm text-[#102235] disabled:opacity-40">Previous</button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-full border border-slate-200 px-3 py-2 text-sm text-[#102235] disabled:opacity-40">Next</button>
        </div>
      </div>
      {drawerOpen && selected ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#102235]/40 p-4">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(16,34,53,0.18)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-light text-[#102235]">{selected.applicant}</h3>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-full border border-slate-200 p-2 text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-[#F8FAFB] p-4 text-sm text-slate-700">
                <div className="mb-2 flex items-center gap-2 text-[#102235]"><IdCard className="h-4 w-4" /> Verification check</div>
                <div className="flex justify-between"><span>Status</span><span>{selected.verificationStatus}</span></div>
                <div className="mt-2 flex justify-between"><span>Submitted</span><span>{formatPreferredDate(selected.submittedAt)}</span></div>
                <div className="mt-2 flex justify-between"><span>Risk</span><span>{selected.risk}</span></div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#F8FAFB] p-4 text-sm text-slate-700">
                <div className="mb-2 flex items-center gap-2 text-[#102235]"><ShieldCheck className="h-4 w-4" /> Decision history</div>
                <div className="flex justify-between"><span>Last action</span><span>{selected.lastAction}</span></div>
                <div className="mt-2 flex justify-between"><span>Owner</span><span>{selected.owner}</span></div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-[#F8FAFB] p-4 text-sm text-slate-700">
              <div className="mb-2 font-light text-[#102235]">Reason</div>
              <textarea value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} rows={3} placeholder="Optional note for approval, rejection or correction" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-[#087E87]" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => completeDecision('Approve', selected)} disabled={!allowApproval} className="rounded-xl bg-[#102235] px-4 py-3 text-sm font-light text-white disabled:cursor-not-allowed disabled:opacity-50">Approve</button>
              <button type="button" onClick={() => completeDecision('Reject', selected)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-light text-[#102235]">Reject</button>
              <button type="button" onClick={() => completeDecision('Return for Correction', selected)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-light text-[#102235]">Return for correction</button>
              <button type="button" onClick={() => completeDecision('Request Manual Review', selected)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-light text-[#102235]">Manual review</button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  )
}

function DashboardView({ user, workspace, records, change }: { user: DemoUser; workspace: Workspace; records: RecordItem[]; change: RecordChange }) {
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 300)
    return () => window.clearTimeout(timer)
  }, [])

  if (loading) return <DashboardSkeleton />

  const routePath = location.pathname
  if (!getAllowedPaths(user.role).includes(routePath) && routePath !== '/dashboard' && routePath !== '/dashboard/settings') {
    return <div className="rounded-[28px] border border-[#F1C5C5] bg-[#FEF3F3] p-6 text-[#C34C4C]">This dashboard view is not available for {user.role}. Contact your administrator for access.</div>
  }

  if (routePath === '/dashboard/settings') return <AccountPage />
  if (routePath === '/dashboard/approvals') return <ApprovalQueuePage />
  if (user.role === 'Global Administrator') {
    if (routePath === '/dashboard/geographic-risk') return (
      <Suspense fallback={<DashboardSkeleton />}>
        <GeographicRiskPage workspace={workspace} access={globalGeographicAccess} />
      </Suspense>
    )
    const module = routePath.split('/')[2] as ModulePath
    const scopedRecords = workspace === 'global' ? records : records.filter((item) => item.workspace === workspace)
    if (Object.hasOwn(moduleDefinitions, module)) return <WorkspaceModule key={workspace + module} workspace={workspace} module={module} records={scopedRecords} change={change} />
    return <WorkspaceOverview key={workspace} workspace={workspace} records={scopedRecords} reports={routePath === '/dashboard/reports'} />
  }
  return <OverviewPage user={user} />
}

function readWorkspace(): Workspace {
  const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY)
  return stored === 'sassa' || stored === 'nsfas' ? stored : 'global'
}

function readRecords(): RecordItem[] {
  try {
    const saved = localStorage.getItem(RECORDS_STORAGE_KEY)
    if (saved) {
      const records: unknown = JSON.parse(saved)
      if (Array.isArray(records) && records.every((item) => item && typeof item.id === 'string' && typeof item.fields === 'object' && item.fields)) return records
    }
  } catch {
    return initialRecords
  }
  return initialRecords
}

function DashboardShell() {
  const navigate = useNavigate()
  const [user, setUser] = useState<DemoUser | null>(() => readSession())
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  })
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [workspace, setWorkspace] = useState(readWorkspace)
  const [records, setRecords] = useState(readRecords)
  const location = useLocation()
  const changeRecord: RecordChange = (record, action, add) => {
    const current = readRecords()
    const audit: RecordItem = {
      id: 'A-' + crypto.randomUUID(),
      kind: 'audit',
      workspace: record.workspace,
      programme: record.programme,
      name: action,
      date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Africa/Johannesburg' }),
      status: 'Recorded',
      detail: 'Recorded in this browser.',
      fields: {
        Record: record.id,
        Actor: user?.role ?? 'Global Administrator',
        Decision: record.status,
        ...(record.kind === 'restriction' ? {
          'Policy reference': record.fields['Policy reference'],
          Reason: record.fields.Reason,
          Evidence: record.fields.Evidence,
          'Review date': record.fields['Review date'],
        } : {}),
        ...(record.kind === 'case' && record.fields['Review decision'] ? { Notes: record.fields['Review decision'] } : {}),
      },
    }
    const next = [...(add ? [...current, record] : current.map((item) => item.id === record.id ? record : item)), audit]
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(next))
    setRecords(next)
  }
  const changeWorkspace = (next: Workspace) => {
    setWorkspace(next)
    localStorage.setItem(WORKSPACE_STORAGE_KEY, next)
    navigate('/dashboard')
  }
  useEffect(() => {
    const refresh = () => setTheme(window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light')
    window.addEventListener('lebati-preferences-change', refresh)
    return () => window.removeEventListener('lebati-preferences-change', refresh)
  }, [])

  useEffect(() => {
    const activeUser = readSession()
    if (!activeUser) {
      navigate('/login', { replace: true })
      return
    }
    setUser(activeUser)
  }, [navigate])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
  }, [theme])

  if (!user) return null
  const page = <DashboardView user={user} workspace={workspace} records={records} change={changeRecord} />

  return (
    <div data-theme={theme} className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-[#F6F8FA] text-[#102235]'}`}>
      <AssistantProvider workspace={workspace}>
      <div className="flex min-h-screen">
        <DashboardSidebar user={user} theme={theme} workspace={workspace} />
        <main className={`min-w-0 flex-1 p-4 sm:p-6 lg:p-8 ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#F6F8FA]'}`}>
          <DashboardHeader user={user} workspace={workspace} onWorkspaceChange={changeWorkspace} onThemeToggle={() => setTheme((value) => (value === 'light' ? 'dark' : 'light'))} theme={theme} onNotificationsToggle={() => setNotificationsOpen((value) => !value)} notificationsOpen={notificationsOpen} />
          {location.pathname.startsWith('/settings') ? <Routes>
            <Route path="profile" element={<ProfilePage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="help" element={<HelpPage />} />
            <Route path="*" element={<AccountPage />} />
          </Routes> : <Routes>
            <Route path="*" element={page} />
          </Routes>}
        </main>
      </div>
      </AssistantProvider>
    </div>
  )
}

export default DashboardShell
