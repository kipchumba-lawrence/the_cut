// The stamped-writer half of openGym's api/sync-stamps.js, for the Supabase API.
//
// openGym's server also rewrites pushes from app versions older than 1.3.9, which do not stamp
// their own changes (`stamped: false`). Every CutGym client stamps, so this keeps only what
// PUT /api/data does for a stamped write: merge the deletion and edit records (both only grow),
// merge monthly challenges, and mark an entry deleted earlier but sent again as added back.
// Copied from sync-stamps.js without changes to the logic.
const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)
const list = v => (Array.isArray(v) ? v : [])
const workoutKey = w => (w?.id != null ? w.id : `${w?.d}|${w?.start}`)
const workoutTime = w => Number(w?._ts) || Number(w?.end) || Number(w?.start) || 0

const DEL_LISTS = {
  workouts: workoutKey,
  routines: x => x?.id,
  customEx: x => x?.id,
  bodyweight: e => e?.d,
  measurements: e => e?.d,
  gymCards: x => x?.id,
  equipProfiles: x => x?.id,
  favEx: x => x,
}
const DEL_TIME = {
  workouts: workoutTime,
  routines: x => Number(x?._ts) || 0,
  customEx: x => Number(x?._ts) || 0,
  bodyweight: e => Number(e?.t) || 0,
  measurements: e => Number(e?.t) || 0,
  gymCards: x => Number(x?._ts) || 0,
  equipProfiles: x => Number(x?._ts) || 0,
}
const DELETED_MAX = 5000
const STAMPED_MAPS = ['balanceOverrides', 'loadKind', 'plates', 'dbLoad', 'dumbbells', 'stackWeights', 'exUnit', 'dayNotes', 'dayPhotos', 'exMerged']
const ENTRY_LISTS = ['routines', 'customEx', 'equipProfiles', 'gymCards', 'workouts']

const capStamps = m => {
  const ks = Object.keys(m)
  if (ks.length <= DELETED_MAX) return m
  ks.sort((x, y) => Math.abs(m[x]) - Math.abs(m[y]))
  for (const k of ks.slice(0, ks.length - DELETED_MAX)) delete m[k]
  return m
}
const laterDel = (v, cur) => {
  const x = Number(v) || 0, y = Number(cur) || 0
  return Math.abs(x) > Math.abs(y) || (Math.abs(x) === Math.abs(y) && x < y)
}

export function mergeDeletions(a, b) {
  const out = {}
  for (const f of Object.keys(DEL_LISTS)) {
    const x = isMap(a?.[f]) ? a[f] : {}, y = isMap(b?.[f]) ? b[f] : {}
    const m = { ...x }
    for (const [k, v] of Object.entries(y)) if (!(k in m) || laterDel(v, m[k])) m[k] = v
    if (Object.keys(m).length) out[f] = capStamps(m)
  }
  return Object.keys(out).length ? out : null
}

export function mergeEdits(a, b) {
  const x = isMap(a) ? a : {}, y = isMap(b) ? b : {}
  const out = { ...x }
  for (const [k, v] of Object.entries(y)) if (!((Number(out[k]) || 0) >= (Number(v) || 0))) out[k] = v
  return Object.keys(out).length ? out : null
}

export function highestStamp(S) {
  let m = 0
  const see = v => { const n = Math.abs(Number(v) || 0); if (n > m) m = n }
  if (!S || typeof S !== 'object') return 0
  see(S._ts); see(S.unitSet?.at); see(S.resetAt)
  if (isMap(S.edited)) for (const v of Object.values(S.edited)) see(v)
  if (isMap(S.deleted)) for (const f of Object.values(S.deleted)) if (isMap(f)) for (const v of Object.values(f)) see(v)
  for (const f of ENTRY_LISTS) {
    for (const x of list(S[f])) {
      if (!x || typeof x !== 'object') continue
      see(x._ts)
      if (isMap(x._f)) for (const v of Object.values(x._f)) see(v)
    }
  }
  for (const f of STAMPED_MAPS) if (isMap(S[f])) for (const v of Object.values(S[f])) see(isMap(v) ? v._ts : 0)
  return m
}

const CH_ID = /^[a-z][a-z0-9-]{0,31}$/
const CH_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const CHALLENGE_MONTHS = 24
const CHALLENGE_PICKS = 3
function cleanChallengePick(p) {
  if (!isMap(p) || !CH_ID.test(p.id)) return null
  const n = Number(p.n)
  if (!Number.isFinite(n) || n <= 0 || n > 1e7) return null
  return p.u === 'kg' || p.u === 'lb' ? { id: p.id, n, u: p.u } : { id: p.id, n }
}
function cleanChallengeMonth(v) {
  if (!isMap(v)) return null
  const picked = []
  for (const p of list(v.picked)) {
    const c = cleanChallengePick(p)
    if (c && !picked.some(x => x.id === c.id)) picked.push(c)
    if (picked.length >= CHALLENGE_PICKS) break
  }
  const ids = picked.map(p => p.id)
  const done = [...new Set(list(v.done).filter(id => typeof id === 'string' && CH_ID.test(id)))]
    .filter(id => !ids.length || ids.includes(id)).slice(0, CHALLENGE_PICKS).sort()
  const at = Number(v.at)
  if (!picked.length && !done.length) return null
  return { picked, done, at: Number.isFinite(at) && at > 0 ? at : 0 }
}
function cleanChallenges(v) {
  if (!isMap(v)) return null
  const out = {}
  for (const k of Object.keys(v).filter(k2 => CH_MONTH.test(k2)).sort().slice(-CHALLENGE_MONTHS)) {
    const m = cleanChallengeMonth(v[k])
    if (m) out[k] = m
  }
  return Object.keys(out).length ? out : null
}
function mergeChallenges(a, b) {
  const x = cleanChallenges(a), y = cleanChallenges(b)
  if (!x || !y) return x || y || undefined
  const out = {}
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    const p = x[k], q = y[k]
    if (!p || !q) { out[k] = p || q; continue }
    const first = !q.picked.length ? p : !p.picked.length ? q
      : (p.at || Infinity) < (q.at || Infinity) ? p : (q.at || Infinity) < (p.at || Infinity) ? q
      : JSON.stringify(p.picked) <= JSON.stringify(q.picked) ? p : q
    out[k] = { picked: first.picked, done: [...p.done, ...q.done], at: first.at }
  }
  return cleanChallenges(out) || undefined
}

function keepHeld(next, now) {
  const del = next.deleted
  if (!isMap(del)) return
  for (const [f, key] of Object.entries(DEL_LISTS)) {
    const m = del[f]
    if (!isMap(m)) continue
    const time = DEL_TIME[f] || (() => 0)
    for (const x of list(next[f])) {
      if (x == null) continue
      const k = String(key(x))
      const at = Number(m[k]) || 0
      if (at > 0 && at >= time(x)) m[k] = -Math.max(now, at + 1)
    }
  }
}

/** PUT /api/data's stamping for a writer that stamps its own changes. Mutates `next`. */
export function stampPut(cur, next, { now = Date.now() } = {}) {
  if (!next || typeof next !== 'object') return next
  const t = Math.max(Number(now) || 0, highestStamp(cur) + 1, highestStamp(next) + 1)
  const reset = (Number(next.resetAt) || 0) > (Number(cur?.resetAt) || 0)
  delete next._unstamped
  delete next._prior
  if (cur && !reset) {
    const d = mergeDeletions(cur.deleted, next.deleted)
    if (d) next.deleted = d; else delete next.deleted
    const e = mergeEdits(cur.edited, next.edited)
    if (e) { delete e._wid; delete e._wids }
    if (e && Object.keys(e).length) next.edited = e; else delete next.edited
    if (isMap(next.challenges) && isMap(cur.challenges)) next.challenges = mergeChallenges(next.challenges, cur.challenges)
  }
  keepHeld(next, t)
  return next
}
