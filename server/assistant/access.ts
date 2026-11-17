import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { z } from 'zod'
import { allowedProgrammes, type GeoAccess, type GeoWorkspace } from '../../src/features/geography/geographicRisk'
import { fingerprint, type AssistantStore } from './store'

const derive = promisify(scrypt)
const identifier = z.string().min(1).max(80)
const passwords = {
  username: z.string().regex(/^[a-z0-9._-]{2,64}$/),
  passwordHash: z.string().regex(/^[a-f0-9]{32}:[a-f0-9]{128}$/),
}
const accountSchema = z.discriminatedUnion('role', [
  z.object({ ...passwords, role: z.literal('Global Administrator') }).strict(),
  z.object({ ...passwords, role: z.literal('NSFAS Administrator'), programmes: z.array(identifier).max(20) }).strict(),
  z.object({ ...passwords, role: z.literal('SASSA Administrator'), programmes: z.array(identifier).max(20) }).strict(),
  z.object({
    ...passwords, role: z.literal('Agent'),
    grants: z.array(z.object({ programme: identifier, area: identifier }).strict()).max(40),
    cases: z.array(identifier).max(40),
  }).strict(),
])
export type Account = z.infer<typeof accountSchema>
export type SafeAccount = Omit<Extract<Account, { role: 'Global Administrator' }>, 'passwordHash'>
  | Omit<Extract<Account, { role: 'NSFAS Administrator' }>, 'passwordHash'>
  | Omit<Extract<Account, { role: 'SASSA Administrator' }>, 'passwordHash'>
  | Omit<Extract<Account, { role: 'Agent' }>, 'passwordHash'>

export function parseAccounts(raw: string | undefined): Account[] | null {
  if (!raw) return null
  try {
    const accounts = z.array(accountSchema).min(1).max(100).parse(JSON.parse(raw))
    return new Set(accounts.map((account) => account.username)).size === accounts.length ? accounts : null
  } catch { return null }
}

const unusedDigest = '0'.repeat(32) + ':' + '0'.repeat(128)
export async function verifyPassword(username: string, password: string, accounts: Account[]) {
  const account = accounts.find((entry) => entry.username === username)
  const [salt, hash] = (account?.passwordHash ?? unusedDigest).split(':')
  const derived = await derive(password, Buffer.from(salt, 'hex'), 64) as Buffer
  return timingSafeEqual(derived, Buffer.from(hash, 'hex')) ? account : undefined
}

export function publicAccount(account: Account): SafeAccount {
  const { passwordHash: _passwordHash, ...claims } = account
  return claims
}

const sessionSeconds = 60 * 60
const sessionKey = (token: string) => 'session:' + fingerprint(token)
const cookieName = (request: Request) => new URL(request.url).protocol === 'https:' ? '__Host-lebati_ai' : 'lebati_ai'
const accountVersion = (account: Account) => fingerprint(JSON.stringify(account))
export function sessionToken(request: Request) {
  const cookie = request.headers.get('cookie')?.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(cookieName(request) + '='))
  const value = cookie?.split('=')[1]
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null
}

export function sessionCookie(request: Request, token = '') {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? sessionSeconds : 0}${secure}`
}

export async function establishSession(request: Request, store: AssistantStore, account: Account) {
  const old = sessionToken(request)
  if (old) await store.remove(sessionKey(old))
  const token = randomBytes(32).toString('base64url')
  await store.put(sessionKey(token), { username: account.username, version: accountVersion(account) }, sessionSeconds)
  return sessionCookie(request, token)
}

export async function currentSession(request: Request, store: AssistantStore, accounts: Account[]) {
  const token = sessionToken(request)
  if (!token) return null
  const key = sessionKey(token)
  const session = await store.get<{ username: string; version: string }>(key)
  const account = accounts.find((entry) => entry.username === session?.username && accountVersion(entry) === session.version)
  return account ? { key, account: publicAccount(account) } : null
}

export async function revokeSession(request: Request, store: AssistantStore) {
  const token = sessionToken(request)
  if (token) await store.remove(sessionKey(token))
}

export const workspaceSchema = z.enum(['global', 'nsfas', 'sassa'])
export function permittedWorkspaces(account: SafeAccount): GeoWorkspace[] {
  return workspaceSchema.options.filter((workspace) => {
    if (account.role !== 'Global Administrator' && workspace === 'global') return false
    return allowedProgrammes(account as GeoAccess, workspace).length > 0
  })
}
