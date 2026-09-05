import { Redis } from '@upstash/redis'

const TOTAL_KEY = 'leaper:global-quiz-count'
const BATCH_KEY_PREFIX = 'leaper:global-quiz-count:batch:'
const MAX_INCREMENT = 5000
const BATCH_ID_PATTERN = /^[a-zA-Z0-9_-]{16,100}$/
const BATCH_TTL_SECONDS = 60 * 60 * 24 * 30

const incrementOnceScript = `
  if redis.call('SET', KEYS[2], '1', 'NX', 'EX', ARGV[2]) then
    return redis.call('INCRBY', KEYS[1], ARGV[1])
  end
  return tonumber(redis.call('GET', KEYS[1]) or '0')
`

function sendJson(response, status, body) {
  response.setHeader('Cache-Control', 'no-store')
  response.status(status).json(body)
}

export function createGlobalQuizCountHandler(redis) {
  const incrementOnce = redis.createScript(incrementOnceScript)

  return async function handler(request, response) {
    try {
      if (request.method === 'GET') {
        const count = Number(await redis.get(TOTAL_KEY) ?? 0)
        sendJson(response, 200, { count })
        return
      }

      if (request.method === 'POST') {
        const increment = Number(request.body?.increment)
        const batchId = request.body?.batchId
        if (!Number.isSafeInteger(increment) || increment < 1 || increment > MAX_INCREMENT ||
          typeof batchId !== 'string' || !BATCH_ID_PATTERN.test(batchId)) {
          sendJson(response, 400, { error: 'Invalid increment batch' })
          return
        }

        const count = Number(await incrementOnce.eval(
          [TOTAL_KEY, `${BATCH_KEY_PREFIX}${batchId}`],
          [increment.toString(), BATCH_TTL_SECONDS.toString()],
        ))
        sendJson(response, 200, { count })
        return
      }

      response.setHeader('Allow', 'GET, POST')
      sendJson(response, 405, { error: 'Method not allowed' })
    } catch (error) {
      console.error('共有累計語数APIエラー:', error)
      sendJson(response, 503, { error: 'Global count is temporarily unavailable' })
    }
  }
}

let handler

export default function globalQuizCountHandler(request, response) {
  if (!handler) handler = createGlobalQuizCountHandler(Redis.fromEnv())
  return handler(request, response)
}
