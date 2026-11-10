// CutGym nutrition: the meal plan and recipes from the Cut Plan app, the food log, and the
// daily targets. Signed in, the log and targets live in Supabase (nutrition_logs,
// nutrition_settings, row-level security per user); as a guest they stay in this browser.
import { create } from 'zustand'
import { supabase } from './supabase.js'
import { todayISO, isoOf } from './format.js'

/* ---------------------------------------------------------------- the plan -- */

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
export const todayKey = () => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]

export const BREAKFASTS = {
  muesli: { id: 'b-muesli', name: '4 eggs + muesli + yoghurt', detail: '4 eggs, boiled or poached, 30 g no-sugar muesli, 100 g plain yoghurt. Black tea or coffee, no sugar.', kcal: 450, protein: 34 },
  porridge: { id: 'b-porridge', name: '4 eggs + wimbi porridge', detail: '4 eggs, boiled or poached, 1 cup wimbi porridge made with water, 1 tsp sugar at most.', kcal: 430, protein: 30 },
}
export const BREAKFAST_BY_DAY = { mon: 'muesli', tue: 'porridge', wed: 'muesli', thu: 'porridge', fri: 'muesli', sat: 'porridge', sun: 'muesli' }

// Oven dinners: one per day, Sunday cooks a double batch for Monday.
export const RECIPES = [
  { id: 'r-lemon-chicken', day: ['mon', 'sun'], name: 'Lemon-garlic chicken tray + waru', kcal: 750, protein: 62, mins: 35, temp: 200,
    ingredients: ['250 g chicken breast', '250 g waru (potatoes), skin on', '1 hoho (bell pepper)', '1 onion', '1 lemon, juice', '3 garlic cloves', '1 tsp paprika', 'Salt', '1 tsp oil'],
    steps: ['Heat the oven to 200 °C.', 'Marinate the chicken in lemon, garlic, paprika and salt for 10 minutes or more.', 'Cut the waru into wedges, the hoho and onion into chunks. Toss everything with 1 tsp oil on one tray.', 'Roast 35 minutes, turning once, until the chicken is cooked through.'],
    note: 'On Sunday, cook a double batch for Monday.' },
  { id: 'r-beef-kebabs', day: ['tue'], name: 'Oven beef kebabs + rice', kcal: 750, protein: 55, mins: 18, temp: 220,
    ingredients: ['200 g lean beef cubes', '1 hoho', '1 onion', '2 carrots', '1 cup cooked rice', 'Salt, pepper, garlic', '1 tsp oil'],
    steps: ['Heat the oven to 220 °C.', 'Thread beef, hoho and onion onto skewers. Season.', 'Roast the skewers with sliced carrots 15–18 minutes, turning once.', 'Serve with the rice.'] },
  { id: 'r-paprika-thighs', day: ['wed'], name: 'Paprika chicken thighs + ugali', kcal: 750, protein: 58, mins: 40, temp: 200,
    ingredients: ['250 g skinless chicken thighs', '1 tsp paprika', '2 garlic cloves', 'Fist-size ugali', '1 bunch sukuma wiki', 'Salt'],
    steps: ['Heat the oven to 200 °C.', 'Rub the thighs with paprika, garlic and salt.', 'Roast 35–40 minutes.', 'Serve with ugali and sukuma wiki.'] },
  { id: 'r-oven-fish', day: ['thu'], name: 'Oven fish fillet + sukuma + ugali', kcal: 700, protein: 56, mins: 20, temp: 200,
    ingredients: ['250 g tilapia fillets', '1 lemon', '2 garlic cloves', 'Thumb of ginger', 'Dhania (coriander)', 'Fist-size ugali', '1 bunch sukuma wiki'],
    steps: ['Heat the oven to 200 °C.', 'Lay the fillets on a tray with lemon, garlic, ginger and dhania.', 'Bake 15–20 minutes until the fish flakes.', 'Serve with ugali and sukuma wiki.'] },
  { id: 'r-bbq-drumsticks', day: ['fri'], name: 'BBQ drumsticks + roast waru', kcal: 780, protein: 54, mins: 40, temp: 200,
    ingredients: ['4 chicken drumsticks, skin off', 'BBQ spice', '1 tbsp soy sauce', '250 g waru wedges', '2 carrots', '1 tsp oil'],
    steps: ['Heat the oven to 200 °C.', 'Rub the drumsticks with BBQ spice and a little soy.', 'Toss the waru and carrots with 1 tsp oil.', 'Roast everything 40 minutes, turning halfway.'] },
  { id: 'r-roast-thighs', day: ['sat'], name: 'Roast chicken thighs + potatoes', kcal: 750, protein: 58, mins: 40, temp: 200,
    ingredients: ['250 g skinless chicken thighs', '200 g potatoes', '2 carrots', '¼ cabbage', 'Salt, pepper, garlic', '1 tsp oil'],
    steps: ['Heat the oven to 200 °C.', 'Season the thighs. Cut the potatoes, carrots and cabbage.', 'Roast together 40 minutes.'] },
  { id: 'r-protein-cake', day: [], name: 'Oat protein mug cake', kcal: 280, protein: 30, mins: 25, temp: 180, snack: true,
    ingredients: ['40 g oats, blended', '1 scoop whey (30 g)', '1 egg', '100 g plain yoghurt', '½ tsp baking powder', 'Cinnamon'],
    steps: ['Heat the oven to 180 °C.', 'Mix everything into a thick batter.', 'Bake in a small dish 20–25 minutes.'] },
]

export const dinnerFor = day => RECIPES.find(r => r.day.includes(day))
export const breakfastFor = day => BREAKFASTS[BREAKFAST_BY_DAY[day]]
export const planTotal = day => {
  const b = breakfastFor(day), d = dinnerFor(day)
  return { kcal: (b?.kcal || 0) + (d?.kcal || 0), protein: (b?.protein || 0) + (d?.protein || 0) }
}

export const PLAN_RULES = [
  'Drink 2–3 L of water every day.',
  'Oven at 200 °C unless the recipe says otherwise.',
  'At most 1 tsp oil per tray: toss, don’t pour.',
  'Weigh meat and starch raw.',
  'Calories are estimates.',
]

export const MEAL_TAGS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

/* ----------------------------------------------------------------- storage -- */

export const DEFAULT_SETTINGS = { target_kcal: 1200, target_protein: 120 }
const LOCAL_LOG = 'cutgym_food_log'
const LOCAL_SET = 'cutgym_food_settings'
const readLocal = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const writeLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* full or blocked */ } }
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export const daysAgoISO = n => { const d = new Date(); d.setDate(d.getDate() - n); return isoOf(d) }

async function signedIn() {
  try { const { data } = await supabase.auth.getSession(); return !!data.session } catch { return false }
}

export const useNutrition = create((set, get) => ({
  logs: [],            // the last 30 days, newest first
  settings: DEFAULT_SETTINGS,
  loaded: false,
  error: null,
  remote: false,

  async load() {
    const remote = await signedIn()
    set({ remote })
    if (!remote) {
      const since = daysAgoISO(30)
      set({ logs: readLocal(LOCAL_LOG, []).filter(r => r.log_date >= since), settings: { ...DEFAULT_SETTINGS, ...readLocal(LOCAL_SET, {}) }, loaded: true, error: null })
      return
    }
    const [logs, st] = await Promise.all([
      supabase.from('nutrition_logs').select('*').gte('log_date', daysAgoISO(30)).order('log_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('nutrition_settings').select('*').maybeSingle(),
    ])
    if (logs.error) { set({ error: logs.error.message, loaded: true }); return }
    set({ logs: logs.data || [], settings: { ...DEFAULT_SETTINGS, ...(st.data || {}) }, loaded: true, error: null })
  },

  async add({ description, kcal, protein_g = null, meal_tag = 'Snack', log_date = todayISO() }) {
    const row = { description: String(description).trim(), kcal: Math.round(Number(kcal) || 0), protein_g: protein_g == null || protein_g === '' ? null : Number(protein_g), meal_tag, log_date }
    if (!row.description || !(row.kcal >= 0)) throw new Error('Enter what you ate and its calories.')
    if (!get().remote) {
      const r = { ...row, id: uid(), created_at: new Date().toISOString() }
      const all = [r, ...readLocal(LOCAL_LOG, [])]
      writeLocal(LOCAL_LOG, all)
      set({ logs: [r, ...get().logs] })
      return r
    }
    const { data, error } = await supabase.from('nutrition_logs').insert(row).select().single()
    if (error) throw new Error(error.message)
    set({ logs: [data, ...get().logs] })
    return data
  },

  async remove(id) {
    const before = get().logs
    set({ logs: before.filter(r => r.id !== id) })
    if (!get().remote) { writeLocal(LOCAL_LOG, readLocal(LOCAL_LOG, []).filter(r => r.id !== id)); return }
    const { error } = await supabase.from('nutrition_logs').delete().eq('id', id)
    if (error) { set({ logs: before }); throw new Error(error.message) }
  },

  async saveSettings(patch) {
    const next = { ...get().settings, ...patch }
    set({ settings: next })
    if (!get().remote) { writeLocal(LOCAL_SET, next); return }
    const { error } = await supabase.from('nutrition_settings').upsert({
      target_kcal: next.target_kcal, target_protein: next.target_protein, updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)
  },
}))

// Re-read on sign-in and sign-out, so the log always belongs to whoever is signed in.
supabase.auth.onAuthStateChange(ev => {
  if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') setTimeout(() => useNutrition.getState().load(), 0)
})

/* ------------------------------------------------------------------ totals -- */

export function dayTotals(logs, day = todayISO()) {
  let kcal = 0, protein = 0
  for (const r of logs) if (r.log_date === day) { kcal += r.kcal || 0; protein += Number(r.protein_g) || 0 }
  return { kcal, protein: Math.round(protein) }
}

export function lastDays(logs, n = 7) {
  const by = {}
  for (const r of logs) by[r.log_date] = (by[r.log_date] || 0) + (r.kcal || 0)
  const out = []
  for (let i = n - 1; i >= 0; i--) { const d = daysAgoISO(i); out.push({ d, kcal: by[d] || 0 }) }
  return out
}
