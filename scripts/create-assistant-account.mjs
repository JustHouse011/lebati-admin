import { randomBytes, scryptSync } from 'node:crypto'

const [username, role = 'Global Administrator'] = process.argv.slice(2)
const grants = {
  'Global Administrator': {},
  'NSFAS Administrator': { programmes: [] },
  'SASSA Administrator': { programmes: [] },
  Agent: { grants: [], cases: [] },
}

if (!username || !/^[a-z0-9._-]{2,64}$/.test(username) || !Object.hasOwn(grants, role)) {
  console.error('Usage: node scripts/create-assistant-account.mjs <username> ["Global Administrator" | "NSFAS Administrator" | "SASSA Administrator" | "Agent"]')
  process.exitCode = 1
} else {
  const password = randomBytes(24).toString('base64url')
  const salt = randomBytes(16)
  const passwordHash = salt.toString('hex') + ':' + scryptSync(password, salt, 64).toString('hex')
  console.log(JSON.stringify([{ username, role, passwordHash, ...grants[role] }]))
  console.error('One-time copy of the generated password. Store it in an approved password manager: ' + password)
}
