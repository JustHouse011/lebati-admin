import { AnimatePresence, motion } from 'framer-motion'
import { Bell, ChevronDown, CircleHelp, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getInitials, type Profile } from '../../services/mockProfile'

export default function ProfileMenu({ profile, role, dark }: { profile: Profile; role: string; dark: boolean }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const close = () => { setOpen(false); trigger.current?.focus() }
  const actions = [
    { label: 'My Profile', icon: UserRound, path: '/settings/profile' },
    { label: 'Account Settings', icon: Settings, path: '/settings/account' },
    { label: 'Security & Password', icon: ShieldCheck, path: '/settings/security' },
    { label: 'Notifications', icon: Bell, path: '/settings/notifications' },
    { label: 'Help & Support', icon: CircleHelp, path: '/settings/help' },
    { label: 'Log Out', icon: LogOut, path: '/login' },
  ]
  return <div ref={root} className="relative ml-auto" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false) }}>
    <button ref={trigger} type="button" aria-label="Open profile menu" aria-haspopup="menu" aria-expanded={open} aria-controls="profile-menu" onClick={() => setOpen(!open)} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) } }} className="flex items-center gap-1 rounded-full outline-offset-4 focus-visible:outline-2 focus-visible:outline-teal">
      <span className="flex h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-full border border-transparent bg-[#102235] text-sm text-white transition hover:border-[#087E87]">{profile.picture ? <img src={profile.picture} alt="" className="h-full w-full object-cover" /> : getInitials(profile)}</span><ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
    <AnimatePresence>{open && <motion.div ref={menu} id="profile-menu" role="menu" aria-label="Profile" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .15 }} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      }
    }} className={`absolute right-0 top-14 z-50 w-72 max-w-[calc(100vw-6rem)] rounded-2xl border p-2 shadow-lg ${dark ? 'border-slate-700 bg-[#111827] text-slate-200' : 'border-slate-200 bg-white text-[#102235]'}`}>
      <div role="presentation" className="break-words border-b border-slate-400/25 px-3 py-3"><p>{profile.displayName || `${profile.firstName} ${profile.lastName}`}</p><p className="mt-1 text-xs opacity-70">{role}</p><p className="mt-1 text-xs opacity-70">{profile.email}</p></div>
      {actions.map(({ label, icon: Icon, path }) => <button key={path} role="menuitem" type="button" onClick={() => { close(); navigate(path, { state: path === '/login' ? { logout: true } : null }) }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-teal/10 focus-visible:bg-teal/10 focus-visible:outline-2 focus-visible:outline-teal ${path === '/login' ? 'mt-1 border-t border-slate-400/25 text-red-500' : ''}`}><Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />{label}</button>)}
    </motion.div>}</AnimatePresence>
  </div>
}
