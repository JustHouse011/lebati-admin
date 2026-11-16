export type Profile = {
  firstName: string
  lastName: string
  displayName: string
  email: string
  mobile: string
  jobTitle: string
  organisation: string
  picture: string
}
export type Preferences = {
  language: 'en-ZA'
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD'
  timeZone: string
  theme: 'light' | 'dark'
  landingPage: '/dashboard' | '/dashboard/approvals'
}
export type NotificationPreferences = Record<'security' | 'approvals' | 'exceptions' | 'restrictions' | 'system' | 'email' | 'inApp', boolean>

const defaults: Profile = { firstName: 'Bongani', lastName: 'Nombamba', displayName: 'Bongani Nombamba', email: 'bnombamba@icloud.com', mobile: '', jobTitle: '', organisation: '', picture: '' }
const preferences: Preferences = { language: 'en-ZA', dateFormat: 'DD/MM/YYYY', timeZone: 'Africa/Johannesburg', theme: 'light', landingPage: '/dashboard' }
const notifications: NotificationPreferences = { security: true, approvals: true, exceptions: true, restrictions: true, system: true, email: true, inApp: true }

function read<T extends object>(key: string, fallback: T): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!value || typeof value !== 'object') return { ...fallback }
    const result = { ...fallback }
    for (const field of Object.keys(fallback) as (keyof T)[]) {
      if (typeof value[field as keyof typeof value] === typeof fallback[field]) result[field] = (value as T)[field]
    }
    return result
  } catch { return { ...fallback } }
}
function write(key: string, value: object) {
  localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new Event('lebati-profile-change'))
}
export const getProfile = () => read('lebati-profile-v1', defaults)
export const saveProfile = (profile: Profile) => write('lebati-profile-v1', profile)
export const getPreferences = () => {
  const result = read('lebati-preferences-v1', preferences)
  result.theme = localStorage.getItem('lebati-dashboard-theme') === 'dark' ? 'dark' : 'light'
  result.language = 'en-ZA'
  if (!['DD/MM/YYYY', 'YYYY-MM-DD'].includes(result.dateFormat)) result.dateFormat = preferences.dateFormat
  if (!['/dashboard', '/dashboard/approvals'].includes(result.landingPage)) result.landingPage = '/dashboard'
  try { new Intl.DateTimeFormat('en-ZA', { timeZone: result.timeZone }) } catch { result.timeZone = preferences.timeZone }
  return result
}
export const savePreferences = (value: Preferences) => {
  localStorage.setItem('lebati-dashboard-theme', value.theme)
  write('lebati-preferences-v1', value)
  window.dispatchEvent(new Event('lebati-preferences-change'))
}
export const getNotificationPreferences = () => read('lebati-notifications-v1', notifications)
export const saveNotificationPreferences = (value: NotificationPreferences) => write('lebati-notifications-v1', value)
export function formatPreferredDate(value: string, includeTime = false) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const settings = getPreferences()
  const parts = new Intl.DateTimeFormat(settings.language, { timeZone: settings.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? ''
  const formatted = settings.dateFormat === 'YYYY-MM-DD' ? `${part('year')}-${part('month')}-${part('day')}` : `${part('day')}/${part('month')}/${part('year')}`
  return includeTime ? `${formatted} ${new Intl.DateTimeFormat(settings.language, { timeZone: settings.timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(date)}` : formatted
}
export function getInitials(profile: Pick<Profile, 'firstName' | 'lastName' | 'displayName'>) {
  const name = `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim() || profile.displayName.trim()
  const words = name.split(/\s+/).filter(Boolean)
  return words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase() : (words[0]?.slice(0, 2).toUpperCase() || '?')
}
