import { Redis } from '@upstash/redis'
import { createHash } from 'node:crypto'

export interface AssistantStore {
  get<T>(key: string): Promise<T | null>
  put(key: string, value: unknown, seconds: number): Promise<void>
  remove(key: string): Promise<void>
  quota(key: string, seconds: number, limit: number): Promise<boolean>
  lock(key: string, owner: string, seconds: number): Promise<boolean>
  unlock(key: string, owner: string): Promise<void>
}

export const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex')

export function redisStore(url: string, token: string): AssistantStore {
  const redis = new Redis({
    url, token, enableTelemetry: false, retry: false,
    signal: () => AbortSignal.timeout(4000),
  })
  const prefix = (key: string) => 'lebati:assistant:v1:' + key
  return {
    get: (key) => redis.get(prefix(key)),
    async put(key, value, seconds) { await redis.set(prefix(key), value, { ex: seconds }) },
    async remove(key) { await redis.del(prefix(key)) },
    async quota(key, seconds, limit) {
      const count = await redis.eval<number[], number>(
        'local n = redis.call("INCR", KEYS[1]); if n == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end; return n',
        [prefix(key)], [seconds],
      )
      return count <= limit
    },
    async lock(key, owner, seconds) {
      return (await redis.set(prefix(key), owner, { nx: true, ex: seconds })) === 'OK'
    },
    async unlock(key, owner) {
      await redis.eval('if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end; return 0', [prefix(key)], [owner])
    },
  }
}
