import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Eye, EyeOff, Save, Upload, Trash2 } from 'lucide-react'
import { NavLink, useBlocker, useNavigate } from 'react-router-dom'
import { changeMockPassword } from '../../services/mockAuth'
import { getInitials, getNotificationPreferences, getPreferences, getProfile, saveNotificationPreferences, savePreferences, saveProfile, type Profile } from '../../services/mockProfile'

function useUnsaved(dirty: boolean) {
  const blocker = useBlocker(dirty)
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
  return blocker.state === 'blocked' ? <div className="settings-overlay" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" onKeyDown={(event) => { if (event.key === 'Escape') blocker.reset(); if (event.key === 'Tab') { event.preventDefault(); const buttons = Array.from(event.currentTarget.querySelectorAll('button')); buttons.find((button) => button !== document.activeElement)?.focus() } }}><div className="settings-card max-w-md"><h2 id="unsaved-title">Unsaved changes</h2><p className="my-4">Leave this page and discard your changes?</p><div className="flex gap-3"><button autoFocus type="button" className="settings-button" onClick={() => blocker.reset()}>Keep editing</button><button type="button" className="settings-button secondary" onClick={() => blocker.proceed()}>Discard and leave</button></div></div></div> : null
}

export function SettingsLayout({ children }: { children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  return <section className="settings-area"><p className="text-xs uppercase tracking-[.2em] text-teal">Your workspace</p><h2 ref={heading} tabIndex={-1} className="mt-2 text-2xl outline-none">Settings</h2><nav aria-label="Settings" className="my-6 flex flex-wrap gap-2">{[['profile', 'My Profile'], ['account', 'Account'], ['security', 'Security'], ['notifications', 'Notifications']].map(([path, label]) => <NavLink key={path} to={`/settings/${path}`} className={({ isActive }) => `rounded-xl border px-4 py-2 text-sm ${isActive ? 'border-teal bg-teal text-white' : 'border-slate-400/30'}`}>{label}</NavLink>)}</nav>{children}</section>
}
function Message({ error, children }: { error?: boolean; children: ReactNode }) { return <p role={error ? 'alert' : 'status'} className={`my-4 rounded-xl border p-3 text-sm ${error ? 'border-red-400/40 text-red-500' : 'border-teal/30 text-teal'}`}>{children}</p> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-2 text-sm"><span>{label}</span>{children}</label> }

export function ProfilePage() {
  const [saved, setSaved] = useState(getProfile)
  const [draft, setDraft] = useState(saved)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const readerRef = useRef<FileReader | null>(null)
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)
  const warning = useUnsaved(dirty)
  useEffect(() => () => readerRef.current?.abort(), [])
  const update = (key: keyof Profile, value: string) => { setDraft((current) => ({ ...current, [key]: value })); setMessage(''); setError('') }
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('')
    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.displayName.trim()) { setError('First name, last name and display name are required.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) { setError('Enter a valid email address.'); return }
    if (draft.mobile && !/^\+?[\d\s()-]{8,20}$/.test(draft.mobile)) { setError('Enter a valid mobile number or leave it blank.'); return }
    try {
      const next = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()])) as Profile
      saveProfile(next); setSaved(next); setDraft(next); setEditing(false); setMessage('Profile saved. Profile email does not change your demo sign-in email.')
    } catch { setError('Profile could not be saved. Check available browser storage and try again.') }
  }
  return <SettingsLayout>{warning}<form onSubmit={submit} className="settings-card"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl">My Profile</h3><p className="mt-2 text-sm opacity-70">Manage your details and profile picture.</p></div>{!editing && <button className="settings-button" type="button" onClick={() => { setEditing(true); setMessage('') }}>Edit profile</button>}</div>
    <div className="my-6 flex flex-wrap items-center gap-4"><span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#102235] text-xl text-white">{draft.picture ? <img src={draft.picture} alt="Profile preview" className="h-full w-full object-cover" /> : getInitials(draft)}</span><div><p className="mb-2 text-sm">Profile Picture</p>{editing && <div className="flex flex-wrap gap-3"><label className="settings-button secondary cursor-pointer"><Upload className="h-4 w-4" />Upload picture<input aria-label="Upload profile picture" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) { setError('Choose a PNG, JPEG or WebP image up to 1 MB.'); return }
      readerRef.current?.abort(); const reader = new FileReader(); readerRef.current = reader; setReading(true)
      reader.onload = () => { update('picture', String(reader.result)); setReading(false) }
      reader.onerror = () => { setError('Could not read this picture.'); setReading(false) }
      reader.readAsDataURL(file)
    }} /></label><button type="button" className="settings-button secondary" disabled={!draft.picture || reading} onClick={() => update('picture', '')}><Trash2 className="h-4 w-4" />Remove</button></div>}<p className="mt-2 text-xs opacity-60">PNG, JPEG or WebP · Up to 1 MB</p></div></div>
    <div className="grid gap-5 md:grid-cols-2">{([['firstName', 'First Name'], ['lastName', 'Last Name'], ['displayName', 'Display Name'], ['email', 'Email Address'], ['mobile', 'Mobile Number'], ['jobTitle', 'Job Title'], ['organisation', 'Organisation']] as [keyof Profile, string][]).map(([key, label]) => <Field key={key} label={label}><input className="settings-input" type={key === 'email' ? 'email' : key === 'mobile' ? 'tel' : 'text'} value={draft[key]} readOnly={!editing} required={['firstName', 'lastName', 'displayName', 'email'].includes(key)} maxLength={160} onChange={(event) => update(key, event.target.value)} /></Field>)}<Field label="Role"><input className="settings-input" readOnly value="Global Administrator" /></Field></div>
    {reading && <p role="status" className="mt-4">Loading picture…</p>}{error && <Message error>{error}</Message>}{message && <Message>{message}</Message>}{editing && <div className="mt-6 flex gap-3"><button disabled={reading} className="settings-button" type="submit"><Save className="h-4 w-4" />Save changes</button><button type="button" className="settings-button secondary" onClick={() => { readerRef.current?.abort(); setReading(false); setDraft(saved); setEditing(false); setError('') }}>Cancel editing</button></div>}</form></SettingsLayout>
}

export function AccountPage() {
  const [saved, setSaved] = useState(getPreferences)
  const [draft, setDraft] = useState(saved)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const profile = getProfile()
  const warning = useUnsaved(JSON.stringify(saved) !== JSON.stringify(draft))
  return <SettingsLayout>{warning}<form className="settings-card" onSubmit={(event) => { event.preventDefault(); try { savePreferences(draft); setSaved(draft); setMessage('Account preferences saved.'); setError('') } catch { setError('Could not save preferences. Please try again.') } }}><h3 className="text-xl">Account information</h3><dl className="my-5 grid gap-3 text-sm"><div><dt className="opacity-60">Email</dt><dd>{profile.email}</dd></div><div><dt className="opacity-60">Role</dt><dd>Global Administrator</dd></div></dl><h3 className="mb-5 text-xl">Display preferences</h3><div className="grid gap-5 md:grid-cols-2"><Field label="Language"><select className="settings-input" value={draft.language} onChange={() => setDraft({ ...draft, language: 'en-ZA' })}><option value="en-ZA">English (South Africa)</option></select></Field><Field label="Date format"><select className="settings-input" value={draft.dateFormat} onChange={(event) => setDraft({ ...draft, dateFormat: event.target.value as typeof draft.dateFormat })}><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option></select></Field><Field label="Time zone"><select className="settings-input" value={draft.timeZone} onChange={(event) => setDraft({ ...draft, timeZone: event.target.value })}>{['Africa/Johannesburg', 'UTC', 'Europe/London'].map((zone) => <option key={zone}>{zone}</option>)}</select></Field><Field label="Theme preference"><select className="settings-input" value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as 'light' | 'dark' })}><option value="light">Light</option><option value="dark">Dark</option></select></Field><Field label="Default dashboard landing page"><select className="settings-input" value={draft.landingPage} onChange={(event) => setDraft({ ...draft, landingPage: event.target.value as typeof draft.landingPage })}><option value="/dashboard">Dashboard</option><option value="/dashboard/approvals">Onboarding approvals</option></select></Field></div><p className="mt-4 text-sm opacity-60">English (South Africa) is currently supported. Date and time preferences apply to application submission dates.</p>{message && <Message>{message}</Message>}{error && <Message error>{error}</Message>}<button type="submit" className="settings-button mt-6">Save preferences</button></form></SettingsLayout>
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [shown, setShown] = useState(false)
  return <Field label={label}><span className="relative block"><input className="settings-input w-full pr-12" type={shown ? 'text' : 'password'} required value={value} autoComplete={label === 'Current Password' ? 'current-password' : 'new-password'} onChange={(event) => onChange(event.target.value)} /><button type="button" className="absolute right-3 top-3" aria-label={`${shown ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setShown(!shown)}>{shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></Field>
}
export function SecurityPage() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [preview, setPreview] = useState(false)
  const [method, setMethod] = useState('authenticator')
  const warning = useUnsaved(Boolean(current || password || confirm))
  const strength = [password.length >= 8, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^a-zA-Z0-9]/.test(password)].filter(Boolean).length
  return <SettingsLayout>{warning}<div className="space-y-5"><form className="settings-card" onSubmit={(event) => { event.preventDefault(); setError(''); setSuccess(''); if (password !== confirm) { setError('New passwords do not match.'); return } try { changeMockPassword(current, password); setCurrent(''); setPassword(''); setConfirm(''); setSuccess('Demo password changed for this page session. Reloading restores the original demo password.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Password change failed.') } }}><h3 className="text-xl">Change password</h3><p className="my-4 text-sm opacity-70">Mock authentication only. This simulation does not secure a production account. Passwords are held only in memory and are never saved to browser storage.</p><div className="grid max-w-xl gap-4"><PasswordField label="Current Password" value={current} onChange={setCurrent} /><PasswordField label="New Password" value={password} onChange={setPassword} /><p className="text-xs opacity-70">Use at least 8 characters, uppercase, lowercase and a number.</p><div><meter aria-label="Password strength" min={0} max={4} value={strength} className="w-full" /><p className="text-xs">Strength: {password ? ['Weak', 'Weak', 'Fair', 'Good', 'Strong'][strength] : 'Not entered'}</p></div><PasswordField label="Confirm New Password" value={confirm} onChange={setConfirm} /></div>{error && <Message error>{error}</Message>}{success && <Message>{success}</Message>}<button type="submit" className="settings-button mt-5">Save password</button></form>
    <section className="settings-card"><h3 className="text-xl">Two-factor authentication</h3><p className="my-3 text-sm">Status: Disabled</p><p className="mb-4 text-sm opacity-70">Configuration preview only. No authenticator secrets or recovery codes are generated, and this preview does not protect your account or change sign-in.</p><Field label="Method"><select className="settings-input max-w-xl" value={method} onChange={(event) => setMethod(event.target.value)}><option value="authenticator">Authenticator app</option><option value="email">Email OTP</option></select></Field><button className="settings-button secondary mt-4" type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? 'Disable configuration preview' : 'Enable configuration preview'}</button>{preview && <Message>Preview: {method === 'authenticator' ? 'An authenticator app would scan a server-issued QR code.' : 'A server would send a verification code to your verified email.'} Recovery codes would be issued by a future authentication service. 2FA remains disabled.</Message>}</section>
    <section className="settings-card"><h3 className="text-xl">Active sessions</h3><p className="my-3 text-sm">Current session · This browser</p><p className="break-all text-xs opacity-70">Browser information: {navigator.userAgent}</p><p className="my-3 text-sm opacity-70">Device platform: {navigator.platform || 'Not available'}</p><div className="flex flex-wrap gap-3"><button className="settings-button" type="button" onClick={() => { navigate('/login', { state: { logout: true } }) }}>Sign out current session</button><button className="settings-button secondary" type="button" disabled title="Requires server-managed sessions">Sign out other sessions</button></div><p className="mt-3 text-xs opacity-60">Other sessions require server-managed authentication.</p></section>
    <section className="settings-card"><h3 className="text-xl">Security activity</h3><p className="my-3 text-sm opacity-70">Simulated activity preview — these examples are not verified security logs.</p><ul className="space-y-3 text-sm"><li>Example: Administrator signs in to the demo workspace.</li><li>Example: Password change is requested.</li><li>Example: Account preferences are updated.</li></ul></section>
  </div></SettingsLayout>
}

export function NotificationsPage() {
  const [saved, setSaved] = useState(getNotificationPreferences)
  const [draft, setDraft] = useState(saved)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const warning = useUnsaved(JSON.stringify(saved) !== JSON.stringify(draft))
  const labels = { security: 'Security alerts', approvals: 'Onboarding approvals', exceptions: 'Verification exceptions', restrictions: 'Restriction reviews', system: 'System notifications', email: 'Email notifications', inApp: 'In-app notifications' }
  return <SettingsLayout>{warning}<form className="settings-card" onSubmit={(event) => { event.preventDefault(); try { saveNotificationPreferences(draft); setSaved(draft); setMessage('Notification preferences saved.'); setError('') } catch { setError('Could not save notification preferences.') } }}><h3 className="text-xl">Notification preferences</h3><p className="my-4 text-sm opacity-70">Choose your topics and channels. Email delivery is not connected in this prototype.</p><div className="divide-y divide-slate-400/20">{Object.entries(labels).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-4 py-4 text-sm"><span>{label}</span><input type="checkbox" className="h-5 w-5 accent-[#087E87]" checked={draft[key as keyof typeof draft]} onChange={(event) => { setDraft({ ...draft, [key]: event.target.checked }); setMessage('') }} /></label>)}</div>{message && <Message>{message}</Message>}{error && <Message error>{error}</Message>}<button className="settings-button mt-4" type="submit">Save notifications</button></form></SettingsLayout>
}
export function HelpPage() { return <SettingsLayout><section className="settings-card"><h3 className="text-xl">Help & Support</h3><p className="mt-4 text-sm leading-7">Lebati is a frontend prototype. For help with this review, record the page, action and observed result and share them with the project owner. A support service is not connected.</p></section></SettingsLayout> }
