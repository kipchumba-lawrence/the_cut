// CutGym sign-in: e-mail and password through Supabase Auth (lib/supabase.js), in place of
// openGym's passkey screen. A signed-in user goes through the same steps as openGym's own
// sign-in (setUser + adoptProfile), so data made on this device before signing in is offered to
// the account exactly as before.
import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { askAddDeviceData } from '../sheets.jsx'
import { signIn, signUp, sendReset } from '../lib/supabase.js'
import { guestAllowed } from '../lib/guest.js'

const MIN_PW = 8

export default function Login() {
  const { setUser, adoptProfile, setGuest } = useStore()
  const config = useStore(s => s.config)
  const canGuest = guestAllowed(config)
  const [mode, setMode] = useState('signin')   // 'signin' | 'signup' | 'reset'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)        // { kind: 'err' | 'ok', text }

  const submit = async ev => {
    ev.preventDefault()
    if (busy) return
    const e = email.trim()
    if (!e || !e.includes('@')) return setMsg({ kind: 'err', text: 'Enter your e-mail address.' })
    if (mode === 'reset') {
      setBusy(true); setMsg(null)
      try { await sendReset(e); setMsg({ kind: 'ok', text: 'If that e-mail has an account, a reset link is on its way.' }) }
      catch (err) { setMsg({ kind: 'err', text: err.message }) }
      finally { setBusy(false) }
      return
    }
    if (mode === 'signup' && !name.trim()) return setMsg({ kind: 'err', text: 'Tell us your name.' })
    if (pw.length < (mode === 'signup' ? MIN_PW : 1)) return setMsg({ kind: 'err', text: mode === 'signup' ? `Use at least ${MIN_PW} characters.` : 'Enter your password.' })
    setBusy(true); setMsg(null)
    try {
      const u = mode === 'signup' ? await signUp(name, e, pw) : await signIn(e, pw)
      setUser(u, { adopt: true })
      await adoptProfile(askAddDeviceData)
      useUI.getState().toast((mode === 'signup' ? 'Welcome, ' : 'Welcome back, ') + u.name)
    } catch (err) {
      setMsg({ kind: err?.data?.code === 'confirm-email' ? 'ok' : 'err', text: err.message || 'Something went wrong.' })
    } finally { setBusy(false) }
  }

  const tab = (k, label) => (
    <button type="button" className={'cg-seg-btn' + (mode === k ? ' on' : '')} onClick={() => { setMode(k); setMsg(null) }}>{label}</button>
  )

  return (
    <div className="cg-login">
      <div className="cg-login-hero">
        <div className="cg-logo" aria-hidden="true">
          <svg viewBox="0 0 48 48"><path d="M8 18v12M4 21v6M40 18v12M44 21v6M8 24h32" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" /></svg>
        </div>
        <h1 className="cg-brand">CutGym</h1>
        <p className="cg-tag">Train, eat and track your cut, all in one place.</p>
      </div>

      <form className="cg-login-card" onSubmit={submit} noValidate>
        {mode !== 'reset' && <div className="cg-seg">{tab('signin', 'Sign in')}{tab('signup', 'Create account')}</div>}
        {mode === 'reset' && <h2 className="cg-login-h">Reset your password</h2>}

        {mode === 'signup' && <label className="cg-field">
          <span>Name</span>
          <input className="input" autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="Lawrence" />
        </label>}
        <label className="cg-field">
          <span>E-mail</span>
          <input className="input" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        {mode !== 'reset' && <label className="cg-field">
          <span>Password</span>
          <input className="input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={pw} onChange={e => setPw(e.target.value)} placeholder={mode === 'signup' ? `At least ${MIN_PW} characters` : '••••••••'} />
        </label>}

        {msg && <div className={'cg-msg ' + msg.kind} role={msg.kind === 'err' ? 'alert' : 'status'}>{msg.text}</div>}

        <button className="cg-primary" type="submit" disabled={busy}>
          {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
        </button>

        <div className="cg-login-links">
          {mode === 'reset'
            ? <button type="button" className="cg-link" onClick={() => { setMode('signin'); setMsg(null) }}>Back to sign in</button>
            : <button type="button" className="cg-link" onClick={() => { setMode('reset'); setMsg(null) }}>Forgot password?</button>}
        </div>
      </form>

      {canGuest && <button type="button" className="cg-link cg-guest" onClick={() => setGuest(true)}>Try it without an account →</button>}
      <p className="cg-foot">Your plan, workouts, meals and weight sync across your devices.<br />Built on openGym, free and open source (AGPL-3.0).</p>
    </div>
  )
}
