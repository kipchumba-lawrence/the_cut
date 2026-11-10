// CutGym API: the parts of openGym's Node server (api/server.js) that the app needs, on Supabase.
//
// The app keeps one JSON document per profile and syncs it with GET/PUT /api/data, guarded by a
// revision counter (`rev`) and a write id (`wid`). This function keeps that document in
// public.og_state and runs the same merge rules as the original server for a stamping client
// (stamps.js, from api/sync-stamps.js), so every client-side sync behaviour of openGym works as before.
//
// Auth is Supabase Auth: the app sends the user's access token as a Bearer token.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { stampPut } from './stamps.js'

const URL_ = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WID_KEEP = 50

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const record = (x: unknown) => !!x && typeof x === 'object' && !Array.isArray(x)
const records = (v: unknown) => (Array.isArray(v) ? v.filter(record) : [])

function forClient(S: any) {
  if (!S || typeof S !== 'object' || !('_unstamped' in S || '_prior' in S)) return S
  const { _unstamped, _prior, ...rest } = S
  return rest
}

const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('')

const publicUser = (u: any) => ({
  id: u.id,
  name: u.user_metadata?.name || (u.email ? String(u.email).split('@')[0] : 'You'),
  email: u.email || null,
  admin: false,
})

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  // Path after the function name: /functions/v1/api/data -> /data
  const path = url.pathname.replace(/^.*?\/api(?=\/|$)/, '') || '/'
  const route = req.method + ' ' + path

  if (route === 'GET /config') {
    return json(200, { invite_only: false, allow_guest: true, password_login: true, coach: null, supabase: true })
  }

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const db = createClient(URL_, ANON, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false } })
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } }
  const user = auth?.user
  if (!user) return json(401, { error: 'not signed in' })

  switch (route) {
    case 'GET /me':
      return json(200, { user: publicUser(user) })

    case 'POST /logout': case 'POST /logout/all': case 'POST /activity':
      return json(200, { ok: true })

    case 'GET /data': {
      const { data, error } = await db.from('og_state').select('doc, rev').eq('user_id', user.id).maybeSingle()
      if (error) return json(503, { error: 'state unreadable' })
      return json(200, { state: data ? forClient(data.doc) : null, rev: data?.rev || 0 })
    }

    case 'GET /data/rev': {
      const { data, error } = await db.from('og_state').select('rev, wid').eq('user_id', user.id).maybeSingle()
      if (error) return json(503, { error: 'state unreadable' })
      return json(200, { rev: data?.rev || 0, ...(data?.wid ? { wid: data.wid } : {}) })
    }

    case 'PUT /data': {
      let body: any
      try { body = await req.json() } catch { return json(400, { error: 'invalid json' }) }
      if (!body.state || typeof body.state !== 'object') return json(400, { error: 'state required' })
      if (!Array.isArray(body.state) && !Object.keys(body.state).some(k => k !== '_rev' && k !== '_ts')) return json(400, { error: 'state required' })
      const list = (v: unknown) => v == null || Array.isArray(v)
      if (Array.isArray(body.state) || !list(body.state.workouts) || !list(body.state.routines)) return json(400, { error: 'invalid state' })
      for (const k of ['workouts', 'routines']) if (Array.isArray(body.state[k])) body.state[k] = records(body.state[k])

      const { data: row, error: readErr } = await db.from('og_state').select('doc, rev').eq('user_id', user.id).maybeSingle()
      if (readErr) return json(503, { error: 'state unreadable' })
      const cur: any = row?.doc || null
      const curRev = row?.rev || 0
      if ((body.baseRev != null && body.baseRev !== curRev) ||
          (body.baseRev != null && typeof body.baseWid === 'string' && cur?._wid && body.baseWid !== cur._wid)) {
        return json(409, { error: 'conflict', rev: curRev, state: forClient(cur) })
      }
      delete body.state.active
      const storedReset = Number(cur?.resetAt) || 0
      if (storedReset > (Number(body.state.resetAt) || 0)) {
        body.state.resetAt = cur.resetAt
        if (cur.resetIds && typeof cur.resetIds === 'object') body.state.resetIds = cur.resetIds
        else delete body.state.resetIds
      }
      try { stampPut(cur, body.state) }
      catch (e) { if (e instanceof RangeError) return json(400, { error: 'invalid state' }); throw e }
      const nextRev = curRev + 1
      body.state._rev = nextRev
      body.state._wids = [...(Array.isArray(cur?._wids) ? cur._wids : []), ...(cur?._wid ? [cur._wid] : [])]
        .filter((x: unknown) => typeof x === 'string').slice(-WID_KEEP)
      body.state._wid = hex(8)

      // Compare-and-swap on the revision, so two devices writing at once cannot both win.
      if (row) {
        const { data: upd, error } = await db.from('og_state')
          .update({ doc: body.state, rev: nextRev, wid: body.state._wid, updated_at: new Date().toISOString() })
          .eq('user_id', user.id).eq('rev', curRev).select('rev')
        if (error) return json(500, { error: 'write failed' })
        if (!upd?.length) {
          const { data: now } = await db.from('og_state').select('doc, rev').eq('user_id', user.id).maybeSingle()
          return json(409, { error: 'conflict', rev: now?.rev || 0, state: forClient(now?.doc || null) })
        }
      } else {
        const { error } = await db.from('og_state').insert({ user_id: user.id, doc: body.state, rev: nextRev, wid: body.state._wid })
        if (error) {
          const { data: now } = await db.from('og_state').select('doc, rev').eq('user_id', user.id).maybeSingle()
          return json(409, { error: 'conflict', rev: now?.rev || 0, state: forClient(now?.doc || null) })
        }
      }
      return json(200, { ok: true, ts: body.state._ts || null, rev: curRev + 1, wid: body.state._wid })
    }

    case 'POST /account/delete': {
      const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
      const { error } = await admin.auth.admin.deleteUser(user.id)
      if (error) return json(500, { error: 'could not delete account' })
      return json(200, { ok: true })
    }
  }
  return json(404, { error: 'not available on this server', code: 'not-available' })
})
