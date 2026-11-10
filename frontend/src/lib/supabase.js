// CutGym runs openGym's app against Supabase instead of the Node server.
//
// - Sign-in, sign-up, password changes and sign-out are Supabase Auth, done here in the browser.
// - The workout document sync (GET/PUT /api/data, /api/data/rev, /api/me) goes to the `api` Edge
//   Function (supabase/functions/api), which keeps openGym's revision and merge rules.
// - Nutrition (meal log, targets, meal plan) is plain tables with row-level security.
import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qmtylgbxirvownqoemti.supabase.co'
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtdHlsZ2J4aXJ2b3ducW9lbXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3ODM3NjIsImV4cCI6MjEwNTM1OTc2Mn0.5aWU6x0DOWTRYrlG8bdYq-yT7kx5hAKsPggPdKxL27w'
export const FUNCTIONS_URL = SUPABASE_URL + '/functions/v1/api'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cutgym_auth' },
})

export async function accessToken() {
  try { const { data } = await supabase.auth.getSession(); return data.session?.access_token || null }
  catch { return null }
}

const fail = (message, code, status = 400) => Object.assign(new Error(message), { status, data: { error: message, code } })

// The user object the rest of the app expects (api/server.js publicUser).
export const publicUser = u => u && ({
  id: u.id,
  name: u.user_metadata?.name || (u.email ? String(u.email).split('@')[0] : 'You'),
  email: u.email || null,
  admin: false,
})

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password })
  if (error) throw fail(error.message === 'Invalid login credentials' ? 'Wrong e-mail or password.' : error.message, 'bad-credentials', error.status || 400)
  return publicUser(data.user)
}

export async function signUp(name, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: String(email).trim(), password,
    options: { data: { name: String(name || '').trim() }, emailRedirectTo: window.location.origin },
  })
  if (error) throw fail(error.message, 'signup', error.status || 400)
  // With "Confirm email" on in Supabase Auth there is no session until the link is opened.
  if (!data.session) throw fail('Check your inbox: we sent you a link to confirm your e-mail, then sign in.', 'confirm-email', 200)
  return publicUser(data.user)
}

export async function sendReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: window.location.origin })
  if (error) throw fail(error.message, 'reset', error.status || 400)
}

export async function signOut() {
  try { await supabase.auth.signOut() } catch { /* already signed out */ }
}

// Routes the app calls that have no server side here: answered in the browser.
export async function localRoute(path, init) {
  const method = (init?.method || 'GET').toUpperCase()
  const body = (() => { try { return JSON.parse(init?.body || '{}') } catch { return {} } })()
  if (path === '/api/logout' || path === '/api/logout/all') { await signOut(); return { ok: true } }
  if (path === '/api/account/password' && method === 'GET') {
    const { data } = await supabase.auth.getUser()
    return { set: true, name: data.user?.email || '', email: null, passkeys: 0 }
  }
  if (path === '/api/account/password' && method !== 'GET') {
    const next = body.next || body.password
    if (!next) throw fail('Enter a new password.', 'too-short')
    if (body.current != null) {
      const { data } = await supabase.auth.getUser()
      const { error: wrong } = await supabase.auth.signInWithPassword({ email: data.user?.email || '', password: body.current })
      if (wrong) throw fail('Your current password is not right.', 'current-wrong')
    }
    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) throw fail(error.message, 'password', error.status || 400)
    return { ok: true }
  }
  if (path === '/api/account/passkeys' && method === 'GET') return { passkeys: [], password: true }
  if (path === '/api/account/delete') {
    // The proof openGym asks for (ProveOwner): the current password, checked here, then the
    // Edge Function deletes the account.
    const { data } = await supabase.auth.getUser()
    const { error: wrong } = await supabase.auth.signInWithPassword({ email: data.user?.email || '', password: body.current || '' })
    if (wrong) throw fail('Your current password is not right.', 'current-wrong')
    return undefined
  }
  if (path === '/api/account/email' && method !== 'GET') {
    const { error } = await supabase.auth.updateUser({ email: body.email })
    if (error) throw fail(error.message, 'email-invalid', error.status || 400)
    return { ok: true, email: body.email }
  }
  return undefined
}
