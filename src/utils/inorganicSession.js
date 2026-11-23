const SESSION_KEY = 'leaper:inorganic:session'
const POSITION_KEY = 'leaper:inorganic:position'

function validPosition(position, count) {
  return Number.isInteger(position) && position >= 0 && position < count
}

export function readInorganicSession(count, storage) {
  let orderedPosition = 0
  try {
    const store = storage ?? globalThis.localStorage
    const previousPosition = Number(store.getItem(POSITION_KEY))
    if (validPosition(previousPosition, count)) orderedPosition = previousPosition
    const saved = JSON.parse(store.getItem(SESSION_KEY))
    if (validPosition(saved?.orderedPosition, count)) orderedPosition = saved.orderedPosition
    const cycle = saved?.random
    if (Array.isArray(cycle?.order) && cycle.order.length === count &&
      new Set(cycle.order).size === count && cycle.order.every((index) => validPosition(index, count)) &&
      validPosition(cycle.position, count)) {
      return { order: saved.order === 'random' ? 'random' : 'source', orderedPosition, random: cycle }
    }
  } catch { /* Fall back to the saved source position, if available. */ }
  return { order: 'source', orderedPosition, random: null }
}

export function saveInorganicSession(session, storage) {
  try {
    const store = storage ?? globalThis.localStorage
    store.setItem(SESSION_KEY, JSON.stringify(session))
  } catch { /* Keep the current session in memory. */ }
}

function shuffleQuestions(count, random, previous = -1) {
  const order = Array.from({ length: count }, (_, index) => index)
  for (let index = count - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const question = order[index]
    order[index] = order[swap]
    order[swap] = question
  }
  if (count > 1 && order[0] === previous) {
    const swap = 1 + Math.floor(random() * (count - 1))
    order[0] = order[swap]
    order[swap] = previous
  }
  return { order, position: 0 }
}

export function selectInorganicOrder(session, order, count, random = Math.random) {
  if (order === 'source') return { ...session, order }
  return { ...session, order, random: session.random ?? shuffleQuestions(count, random) }
}

export function advanceInorganicSession(session, count, random = Math.random) {
  if (session.order === 'source') return { ...session, orderedPosition: (session.orderedPosition + 1) % count }
  const cycle = session.random
  const position = cycle.position + 1
  return {
    ...session,
    random: position < count ? { ...cycle, position } : shuffleQuestions(count, random, cycle.order[cycle.position]),
  }
}
