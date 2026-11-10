// CutGym → Eat: today's food against the targets, the weekly meal plan and the oven recipes,
// brought over from the Cut Plan app (lib/nutrition.js).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../store/useUI.js'
import { Segmented, Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { todayISO } from '../lib/format.js'
import {
  useNutrition, dayTotals, lastDays, todayKey, DAY_KEYS, DAY_NAMES, breakfastFor, dinnerFor, planTotal,
  RECIPES, PLAN_RULES, MEAL_TAGS,
} from '../lib/nutrition.js'

const toast = m => useUI.getState().toast(m)

/* ------------------------------------------------------------------ pieces -- */

export function Ring({ value, target, size = 132, stroke = 11, label, sub }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(value / target, 1) : 0
  const over = target > 0 && value > target
  return (
    <div className="cg-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="cg-ring-track" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} className={'cg-ring-fill' + (over ? ' over' : '')} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="cg-ring-in"><b>{label}</b><span>{sub}</span></div>
    </div>
  )
}

export function Bars({ days, target }) {
  const max = Math.max(target, ...days.map(d => d.kcal), 1)
  return (
    <div className="cg-bars" role="img" aria-label="Calories over the last 7 days">
      {days.map(d => {
        const h = d.kcal ? Math.max((d.kcal / max) * 100, 4) : 0
        const wd = new Date(d.d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })
        return <div key={d.d} className="cg-bar">
          <div className="cg-bar-track">
            <div className="cg-bar-goal" style={{ bottom: (target / max) * 100 + '%' }} />
            <div className={'cg-bar-fill' + (d.kcal > target ? ' over' : '')} style={{ height: h + '%' }} />
          </div>
          <span className={d.d === todayISO() ? 'today' : ''}>{wd}</span>
        </div>
      })}
    </div>
  )
}

/* ----------------------------------------------------------- log a meal -- */

export function openLogMeal(preset = {}) {
  useUI.getState().openSheet(close => <LogMealSheet close={close} preset={preset} />)
}

function LogMealSheet({ close, preset }) {
  const add = useNutrition(s => s.add)
  const hour = new Date().getHours()
  const [desc, setDesc] = useState(preset.description || '')
  const [kcal, setKcal] = useState(preset.kcal != null ? String(preset.kcal) : '')
  const [protein, setProtein] = useState(preset.protein != null ? String(preset.protein) : '')
  const [tag, setTag] = useState(preset.meal_tag || (hour < 11 ? 'Breakfast' : hour < 16 ? 'Lunch' : hour < 21 ? 'Dinner' : 'Snack'))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const save = async ev => {
    ev.preventDefault()
    if (busy) return
    setBusy(true); setErr(null)
    try { await add({ description: desc, kcal, protein_g: protein, meal_tag: tag }); close(); toast('Meal logged') }
    catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }
  return <form onSubmit={save} noValidate>
    <h3>Log a meal</h3>
    <Segmented options={MEAL_TAGS.map(v => ({ value: v, label: v }))} value={tag} onChange={setTag} />
    <div style={{ height: 12 }} />
    <input className="input" placeholder="What you ate" value={desc} onChange={e => setDesc(e.target.value)} autoFocus={!preset.description} />
    <div style={{ height: 10 }} />
    <div className="cg-two">
      <label className="cg-field"><span>Calories (kcal)</span><input className="input" inputMode="numeric" value={kcal} onChange={e => setKcal(e.target.value.replace(/[^\d]/g, ''))} placeholder="450" /></label>
      <label className="cg-field"><span>Protein (g), optional</span><input className="input" inputMode="decimal" value={protein} onChange={e => setProtein(e.target.value.replace(/[^\d.]/g, ''))} placeholder="30" /></label>
    </div>
    {err && <div className="cg-msg err">{err}</div>}
    <div style={{ height: 14 }} />
    <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Log meal'}</Button>
  </form>
}

function TargetsSheet({ close }) {
  const settings = useNutrition(s => s.settings)
  const saveSettings = useNutrition(s => s.saveSettings)
  const [kcal, setKcal] = useState(String(settings.target_kcal))
  const [protein, setProtein] = useState(String(settings.target_protein))
  const save = async ev => {
    ev.preventDefault()
    const k = Number(kcal), p = Number(protein)
    if (!(k >= 800 && k <= 6000)) return toast('Set a calorie target between 800 and 6,000 kcal.')
    if (!(p >= 0 && p <= 400)) return toast('Set a protein target between 0 and 400 g.')
    try { await saveSettings({ target_kcal: Math.round(k), target_protein: Math.round(p) }); close(); toast('Targets saved') }
    catch (e) { toast(e.message) }
  }
  return <form onSubmit={save}>
    <h3>Daily targets</h3>
    <div className="cg-two">
      <label className="cg-field"><span>Calories (kcal)</span><input className="input" inputMode="numeric" value={kcal} onChange={e => setKcal(e.target.value)} /></label>
      <label className="cg-field"><span>Protein (g)</span><input className="input" inputMode="numeric" value={protein} onChange={e => setProtein(e.target.value)} /></label>
    </div>
    <p className="muted small" style={{ marginTop: 10 }}>Your weight goal is set under Stats → Body weight. A slow, steady cut keeps your strength.</p>
    <div style={{ height: 6 }} />
    <Button variant="primary" type="submit">Save</Button>
  </form>
}

/* -------------------------------------------------------------- the tabs -- */

function Today() {
  const { logs, settings, remove, loaded, error } = useNutrition()
  const tot = dayTotals(logs)
  const days = lastDays(logs, 7)
  const left = settings.target_kcal - tot.kcal
  const today = logs.filter(r => r.log_date === todayISO())
  const onTarget = days.filter(d => d.kcal > 0 && d.kcal <= settings.target_kcal).length
  const tk = todayKey()
  const suggestions = [
    { ...breakfastFor(tk), meal_tag: 'Breakfast' },
    { ...dinnerFor(tk), meal_tag: 'Dinner' },
  ].filter(x => x.name)
  return <>
    <div className="card cg-hero">
      <Ring value={tot.kcal} target={settings.target_kcal} label={tot.kcal.toLocaleString()} sub={`of ${settings.target_kcal.toLocaleString()} kcal`} />
      <div className="cg-hero-side">
        <div className="cg-stat"><b className={left < 0 ? 'neg' : ''}>{Math.abs(left).toLocaleString()}</b><span>{left < 0 ? 'kcal over' : 'kcal left'}</span></div>
        <div className="cg-stat"><b>{tot.protein}<small> g</small></b><span>protein of {settings.target_protein} g</span></div>
        <div className="cg-meter"><div style={{ width: Math.min(100, (tot.protein / Math.max(1, settings.target_protein)) * 100) + '%' }} /></div>
      </div>
    </div>
    <div className="cg-actions">
      <Button variant="primary" icon="plus" onClick={() => openLogMeal()}>Log a meal</Button>
      <Button variant="tinted" icon="target" onClick={() => useUI.getState().openSheet(close => <TargetsSheet close={close} />)}>Targets</Button>
    </div>

    {suggestions.length > 0 && <>
      <div className="cg-sect">From today’s plan</div>
      <div className="cg-chips">
        {suggestions.map(m => <button key={m.id} className="cg-chip" onClick={() => openLogMeal({ description: m.name, kcal: m.kcal, protein: m.protein, meal_tag: m.meal_tag })}>
          <Icon name="plusCircle" /><span><b>{m.meal_tag}</b> {m.name}</span><em>{m.kcal} kcal</em>
        </button>)}
      </div>
    </>}

    <div className="cg-sect">Eaten today</div>
    {error && <div className="cg-msg err">{error}</div>}
    {!loaded ? <div className="card muted small">Loading…</div>
      : !today.length ? <div className="card cg-empty"><Icon name="bowl" /><span>Nothing logged yet today.</span></div>
      : <div className="card cg-list">{today.map(r => <div key={r.id} className="cg-li">
          <div><span className="cg-tag">{r.meal_tag}</span><div className="cg-li-t">{r.description}</div></div>
          <div className="cg-li-r"><b>{r.kcal}</b><small>kcal{r.protein_g != null ? ` · ${Math.round(r.protein_g)} g P` : ''}</small></div>
          <button className="iconbtn cg-del" aria-label="Delete" onClick={() => remove(r.id).catch(e => toast(e.message))}><Icon name="trash" /></button>
        </div>)}</div>}

    <div className="card">
      <div className="cg-card-h"><span>Last 7 days</span><em>{onTarget} of 7 on target</em></div>
      <Bars days={days} target={settings.target_kcal} />
    </div>
  </>
}

function Menu() {
  const [day, setDay] = useState(todayKey())
  const b = breakfastFor(day), d = dinnerFor(day), tot = planTotal(day)
  return <>
    <div className="cg-days">
      {DAY_KEYS.map(k => <button key={k} className={'cg-day' + (k === day ? ' on' : '') + (k === todayKey() ? ' now' : '')} onClick={() => setDay(k)}>{DAY_NAMES[k].slice(0, 3)}</button>)}
    </div>
    <div className="cg-plan-h"><h2>{DAY_NAMES[day]}</h2><span>~{tot.kcal.toLocaleString()} kcal · ~{tot.protein} g protein</span></div>
    {[{ tag: 'Breakfast', m: b }, { tag: 'Oven dinner', m: d }].map(({ tag, m }) => m && <div key={tag} className="card cg-meal">
      <div className="cg-meal-top"><span className="cg-tag">{tag}</span><em>{m.kcal} kcal</em></div>
      <div className="cg-meal-name">{m.name}</div>
      <div className="muted small">{m.detail || m.note || `${m.temp} °C · ${m.mins} min`}</div>
      <div className="cg-meal-act">
        <Button size="sm" variant="tinted" icon="plus" onClick={() => openLogMeal({ description: m.name, kcal: m.kcal, protein: m.protein, meal_tag: tag === 'Breakfast' ? 'Breakfast' : 'Dinner' })}>Log it</Button>
      </div>
    </div>)}
    <div className="card cg-rules">{PLAN_RULES.map(r => <div key={r}><Icon name="check" /><span>{r}</span></div>)}</div>
  </>
}

function Recipes() {
  const [open, setOpen] = useState(null)
  return <>
    {RECIPES.map(r => {
      const on = open === r.id
      return <div key={r.id} className={'card cg-recipe' + (on ? ' open' : '')}>
        <button className="cg-recipe-h" onClick={() => setOpen(on ? null : r.id)} aria-expanded={on}>
          <div>
            <div className="cg-meal-name">{r.name}</div>
            <div className="cg-pills"><span>{r.kcal} kcal</span><span>{r.protein} g protein</span><span>{r.temp} °C · {r.mins} min</span>
              {r.day.length > 0 && <span>{r.day.map(k => DAY_NAMES[k].slice(0, 3)).join(', ')}</span>}{r.snack && <span>Snack</span>}</div>
          </div>
          <Icon name={on ? 'chevronUp' : 'chevronDown'} className="chev" />
        </button>
        {on && <div className="cg-recipe-b">
          <div className="cg-sub">Ingredients</div>
          <ul>{r.ingredients.map(i => <li key={i}>{i}</li>)}</ul>
          <div className="cg-sub">Method</div>
          <ol>{r.steps.map(s => <li key={s}>{s}</li>)}</ol>
          {r.note && <p className="muted small">{r.note}</p>}
          <Button size="sm" variant="tinted" icon="plus" onClick={() => openLogMeal({ description: r.name, kcal: r.kcal, protein: r.protein, meal_tag: r.snack ? 'Snack' : 'Dinner' })}>Log it</Button>
        </div>}
      </div>
    })}
  </>
}

export default function Eat() {
  const nav = useNavigate()
  const load = useNutrition(s => s.load)
  const [tab, setTab] = useState('today')
  useEffect(() => { load() }, [load])
  const date = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), [])
  return <div className="narrow cg-eat">
    <div className="hdr">
      <div><h1>Eat</h1><div className="sub">{date}</div></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label="Settings"><Icon name="gear" /></button>
    </div>
    <Segmented options={[{ value: 'today', label: 'Today' }, { value: 'menu', label: 'Menu' }, { value: 'recipes', label: 'Recipes' }]} value={tab} onChange={setTab} />
    <div style={{ height: 16 }} />
    {tab === 'today' ? <Today /> : tab === 'menu' ? <Menu /> : <Recipes />}
  </div>
}
