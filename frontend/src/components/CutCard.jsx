// CutGym's Home card for the cut (from the Cut Plan app's dashboard): today's calories against
// the target, protein, the last weigh-in against the weight goal, the weekly trend, and the
// three quick actions: log a meal, log a weigh-in, open today's menu.
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { lastBW } from '../lib/history.js'
import { weightRate } from '../lib/bodyweight.js'
import { bwSheet, goalSheet } from '../sheets.jsx'
import { useNutrition, dayTotals, lastDays, todayKey, dinnerFor } from '../lib/nutrition.js'
import { Ring, Bars, openLogMeal } from '../views/Eat.jsx'
import Icon from './Icon.jsx'

const one = v => (Math.round(v * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 })

export default function CutCard({ S }) {
  const nav = useNavigate()
  const { logs, settings, load, loaded } = useNutrition()
  useEffect(() => { if (!loaded) load() }, [loaded, load])
  const tot = dayTotals(logs)
  const days = useMemo(() => lastDays(logs, 7), [logs])
  const unit = S.unit === 'lb' ? 'lb' : 'kg'
  const last = lastBW(S)
  const goal = Number.isFinite(S.targetW) && S.targetW > 0 ? S.targetW : null
  const toGo = last && goal != null ? last.w - goal : null
  const rate = useMemo(() => weightRate(S.bodyweight), [S.bodyweight])
  const left = settings.target_kcal - tot.kcal
  const dinner = dinnerFor(todayKey())

  return <div className="card cg-cut">
    <div className="cg-cut-h">
      <span className="cg-eyebrow"><Icon name="flame" /> Your cut</span>
      <button className="cg-link" onClick={() => nav('/eat')}>Eat <Icon name="chevronRight" /></button>
    </div>
    <div className="cg-cut-row">
      <Ring value={tot.kcal} target={settings.target_kcal} size={104} stroke={9} label={tot.kcal.toLocaleString()} sub="kcal today" />
      <div className="cg-cut-stats">
        <div className="cg-stat"><b className={left < 0 ? 'neg' : ''}>{Math.abs(left).toLocaleString()}</b><span>{left < 0 ? 'kcal over' : 'kcal left'}</span></div>
        <div className="cg-stat"><b>{tot.protein}<small> g</small></b><span>protein / {settings.target_protein} g</span></div>
        <button className="cg-stat tap" onClick={() => (goal == null ? goalSheet() : bwSheet())}>
          <b>{last ? one(last.w) : '–'}<small> {unit}</small></b>
          <span>{toGo == null ? (last ? 'Set a weight goal' : 'Log your weight') : toGo <= 0.05 ? 'Goal reached 🎉' : `${one(toGo)} ${unit} to ${one(goal)}`}</span>
        </button>
      </div>
    </div>
    {rate.enough && <div className={'cg-trend' + (rate.perWeek < 0 ? ' down' : '')}>
      <Icon name={rate.perWeek < 0 ? 'arrowDown' : 'arrowUp'} />
      {one(Math.abs(rate.perWeek))} {unit} a week ({one(Math.abs(rate.pct))} %){goal != null && toGo > 0 && rate.perWeek < 0 ? ` · goal in ~${Math.ceil(toGo / -rate.perWeek)} weeks` : ''}
    </div>}
    <Bars days={days} target={settings.target_kcal} />
    <div className="cg-qa">
      <button onClick={() => openLogMeal()}><Icon name="fork" /><span>Log meal</span></button>
      <button onClick={() => bwSheet()}><Icon name="scale" /><span>Weigh in</span></button>
      <button onClick={() => nav('/eat')}><Icon name="bowl" /><span>{dinner ? 'Tonight: ' + dinner.name.split(' + ')[0] : 'Menu'}</span></button>
    </div>
  </div>
}
