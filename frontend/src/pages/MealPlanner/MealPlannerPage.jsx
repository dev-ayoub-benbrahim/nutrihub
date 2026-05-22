import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/axios';
import toast from 'react-hot-toast';

const MEAL_ICONS = { BREAKFAST: '🌅', LUNCH: '☀️', DINNER: '🌙' };
const MEAL_ORDER = ['BREAKFAST', 'LUNCH', 'DINNER'];

const GOALS = [
  { value: 'lose_weight',   label: 'Lose Weight',    desc: '−500 kcal deficit' },
  { value: 'maintain',      label: 'Maintain Weight', desc: 'Maintenance calories' },
  { value: 'build_muscle',  label: 'Build Muscle',    desc: '+300 kcal surplus' },
  { value: 'eat_healthier', label: 'Eat Healthier',   desc: 'Balanced nutrition' },
  { value: 'high_energy',   label: 'High Energy',     desc: 'High carb fuel' },
];

const ALLERGIES = [
  'Gluten','Dairy','Eggs','Fish','Shellfish','Tree Nuts',
  'Peanuts','Sesame','Soy','Mustard','Celery','Lupin','Molluscs','Sulphites',
];

const PREFERENCES = [
  'Vegetarian','Vegan','Keto','Paleo','Mediterranean',
  'High-Protein','Low-Carb','Halal','Kosher',
];

function calcTDEE({ weight, height, age, sex, activity, goal }) {
  if (!weight || !height || !age) return null;
  const w = parseFloat(weight), h = parseFloat(height), a = parseFloat(age);
  if (w < 30 || w > 300 || h < 100 || h > 250 || a < 15 || a > 100) return null;
  const bmr = sex === 'female'
    ? 10 * w + 6.25 * h - 5 * a - 161
    : 10 * w + 6.25 * h - 5 * a + 5;
  const mult = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, veryActive:1.9 };
  let tdee = bmr * (mult[activity] || 1.55);
  if (goal === 'lose_weight')  tdee -= 500;
  if (goal === 'build_muscle') tdee += 300;
  return Math.round(tdee);
}

// ── Meal Card ─────────────────────────────────────────────────
function MealCard({ meal, onSwap, onLog, swapping, loggedIds, mealTarget }) {
  const [expanded, setExpanded] = useState(true);
  const isLogged = loggedIds.has(meal.id);
  const kcal     = Math.round(meal.totalCalories || 0);
  const icon     = MEAL_ICONS[meal.mealType] || '🍽️';

  const pctOff      = mealTarget > 0 ? Math.abs(kcal - mealTarget) / mealTarget : 0;
  const showWarning = kcal > 0 && mealTarget > 0 && pctOff > 0.25;
  const warningText = kcal < mealTarget ? 'Under target' : 'Over target';

  const pCal = (meal.totalProteinG || 0) * 4;
  const cCal = (meal.totalCarbsG   || 0) * 4;
  const fCal = (meal.totalFatG     || 0) * 9;
  const mTotal = pCal + cCal + fCal || 1;
  const pPct = Math.round((pCal / mTotal) * 100);
  const cPct = Math.round((cCal / mTotal) * 100);
  const fPct = 100 - pPct - cPct;

  const GRADIENT = {
    BREAKFAST: 'from-[rgba(212,168,67,0.10)] to-transparent',
    LUNCH:     'from-[rgba(74,124,89,0.14)] to-transparent',
    DINNER:    'from-[rgba(30,58,38,0.30)] to-transparent',
  };

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-200
                     ${isLogged ? 'border-sage/40 opacity-75' : 'border-[rgba(74,124,89,0.22)] hover:border-sage/40'}`}>
      <div className={`h-1 w-full ${
        meal.mealType === 'BREAKFAST' ? 'bg-gradient-to-r from-yellow-400/70 to-transparent' :
        meal.mealType === 'LUNCH'     ? 'bg-gradient-to-r from-sage/70 to-transparent' :
                                         'bg-gradient-to-r from-blue-400/50 to-transparent'
      }`}/>
      <div className={`bg-gradient-to-b ${GRADIENT[meal.mealType] || GRADIENT.LUNCH} p-5`}>
        <div className="flex items-start gap-4 mb-4">
          <button onClick={() => onLog(meal)}
                  className={`mt-1 w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center
                              border-2 transition-all text-[12px] font-bold
                              ${isLogged ? 'bg-sage border-sage text-forest' : 'border-[rgba(74,124,89,0.5)] hover:border-sage'}`}>
            {isLogged ? '✓' : ''}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-base">{icon}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{meal.mealType}</span>
              {isLogged && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-sage/20 text-sage-l border border-sage/30">Logged</span>}
              {showWarning && !isLogged && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gold/10 text-gold border border-gold/30">⚠ {warningText}</span>}
            </div>
            <h3 className={`font-serif text-[22px] font-light leading-tight ${isLogged ? 'text-muted line-through' : 'text-cream'}`}>
              {meal.name}
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-center bg-forest/50 border border-[rgba(74,124,89,0.2)] rounded-xl px-3 py-2 min-w-[60px]">
              <p className="text-[24px] font-semibold text-gold leading-tight">{kcal}</p>
              <p className="text-[10px] text-muted">kcal</p>
            </div>
            <button onClick={() => onSwap(meal)} disabled={swapping === meal.id}
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-[rgba(74,124,89,0.2)] text-muted hover:text-sage hover:border-sage/40 transition-all text-lg">
              <span className={swapping === meal.id ? 'animate-spin inline-block' : ''}>↻</span>
            </button>
          </div>
        </div>

        {kcal > 0 && (
          <div className="mb-4">
            <div className="flex h-2.5 rounded-full overflow-hidden mb-2 gap-0.5">
              <div style={{ width: `${pPct}%` }} className="bg-blue-400 rounded-l-full"/>
              <div style={{ width: `${cPct}%` }} className="bg-yellow-400/80"/>
              <div style={{ width: `${fPct}%` }} className="bg-orange-400/80 rounded-r-full"/>
            </div>
            <div className="flex gap-4 text-[11px] flex-wrap">
              {[['blue-400','Protein',meal.totalProteinG,pPct],
                ['yellow-400/80','Carbs',meal.totalCarbsG,cPct],
                ['orange-400/80','Fat',meal.totalFatG,fPct]].map(([col,label,val,pct]) => (
                <div key={label} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full bg-${col} flex-shrink-0`}/>
                  <span className="text-muted">{label}</span>
                  <span className="text-cream font-semibold">{Math.round(val||0)}g</span>
                  <span className="text-muted">({pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {meal.description && (
          <div className="bg-forest/40 rounded-xl px-4 py-3 mb-4 border border-[rgba(74,124,89,0.12)]">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">How to make it</p>
            <p className="text-[13px] text-cream/85 leading-relaxed">{meal.description}</p>
          </div>
        )}

        {meal.ingredients?.length > 0 && (
          <div>
            <button onClick={() => setExpanded(e => !e)}
                    className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted hover:text-cream transition-colors mb-2">
              <span>{expanded ? '▾' : '▸'}</span>
              Ingredients ({meal.ingredients.length})
            </button>
            {expanded && (
              <div className="flex flex-col gap-1.5">
                {meal.ingredients.map((ing, i) => {
                  const name = ing.ingredient?.name || ing.name || 'ingredient';
                  const ingKcal = Math.round(ing.usdaCalories || 0);
                  return (
                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-forest/30 rounded-xl border border-[rgba(74,124,89,0.1)]">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-sage flex-shrink-0"/>
                        <span className="text-[13px] text-cream capitalize">{name}</span>
                        <span className="text-[11px] text-muted bg-forest/60 px-2 py-0.5 rounded-lg">{ing.quantity} {ing.unit}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {ingKcal > 0 && <span className="text-[12px] text-gold font-medium">{ingKcal} kcal</span>}
                        {ing.usdaCalories != null && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(74,124,89,0.15)] text-sage border border-sage/20">USDA</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function MealPlannerPage() {
  const { user } = useAuth();

  const [goal,        setGoal]        = useState(user?.goal?.toLowerCase().replace(' ','_') || 'eat_healthier');
  const [calories,    setCalories]    = useState(user?.calorieTarget || 2000);
  const [allergies,   setAllergies]   = useState([]);
  const [prefs,       setPrefs]       = useState([]);
  const [weight,      setWeight]      = useState('');
  const [height,      setHeight]      = useState('');
  const [age,         setAge]         = useState('');
  const [sex,         setSex]         = useState('male');
  const [activity,    setActivity]    = useState('moderate');
  const [tdee,        setTdee]        = useState(null);

  const [plan,        setPlan]        = useState(null);
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [swapping,    setSwapping]    = useState(null);
  const [loggedIds,   setLoggedIds]   = useState(new Set());
  const [tab,         setTab]         = useState('today');
  const [showForm,    setShowForm]    = useState(true);
  const [showShopping,setShowShopping]= useState(false);

  // Load most recent plan on mount
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/meal-plans');
        if (data.plans?.length > 0) {
          const latest = data.plans[0];
          setPlan(latest);
          setHistory(data.plans.slice(1, 8));
          setShowForm(false);
        }
      } catch { }
    };
    load();
  }, []);

  // Re-fetch logged meal IDs whenever plan.id changes 
  useEffect(() => {
    if (!plan?.id) return;
    const fetchLogs = async () => {
      try {
        const { data } = await api.get(`/social/nutrition/logged-meals?planId=${plan.id}`);
        setLoggedIds(new Set(data.loggedMealIds || []));
      } catch { }
    };
    fetchLogs();
  }, [plan]);

  // Auto-calculate TDEE
  useEffect(() => {
    const result = calcTDEE({ weight, height, age, sex, activity, goal });
    if (result) { setTdee(result); setCalories(result); }
  }, [weight, height, age, sex, activity, goal]);

  const toggleAllergy = a => setAllergies(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);
  const togglePref    = p => setPrefs(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  // ── Generate ──────────────────────────────────────────────
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const parts = [`Goal: ${goal.replace('_',' ')}. Calorie target: ${calories} kcal.`];
      if (prefs.length)     parts.push(`Dietary preferences: ${prefs.join(', ')}.`);
      if (allergies.length) parts.push(`Allergies: ${allergies.join(', ')}.`);

      let planData = null;
      try {
        const { data } = await api.post('/meal-plans/generate', {
          text: parts.join(' '), allergies,
        }, { timeout: 120000 });
        planData = data?.plan || null;
      } catch (err) {
        // Plan may have saved despite response error — try fetching
        try {
          const { data: fresh } = await api.get('/meal-plans');
          if (fresh.plans?.length > 0) planData = fresh.plans[0];
        } catch { }
        if (!planData) {
          toast.error(err?.response?.data?.message || 'Generation failed — please try again');
          return;
        }
      }

      try {
        const { data: allPlans } = await api.get('/meal-plans');
        setHistory(allPlans.plans?.slice(1, 8) || []);
      } catch { }

      setPlan(planData);
      setLoggedIds(new Set());
      setTab('today');
      setShowForm(false);
      toast.success("Today's meal plan is ready");
    } finally {
      setLoading(false);
    }
  };

  // ── Swap ──────────────────────────────────────────────────
  const handleSwap = async (meal) => {
    if (swapping === meal.id) return;
    setSwapping(meal.id);
    try {
      const bias = meal.mealType === 'BREAKFAST' ? 0.28 : meal.mealType === 'LUNCH' ? 0.35 : 0.37;
      const target = Math.round((plan?.calorieTarget || calories) * bias);
      const prompt = [
        `Generate ONE ${meal.mealType} meal to replace "${meal.name}".`,
        `Calorie target: ~${target} kcal. Daily total: ${plan?.calorieTarget || calories} kcal.`,
        `Portions must be substantial enough to reach the target.`,
        ...(allergies.length ? [`Allergies (NEVER include): ${allergies.join(', ')}.`] : []),
        ...(prefs.length     ? [`Dietary preference: ${prefs.join(', ')}.`] : []),
        `Return JSON only: {"name":"string","description":"string","ingredients":[{"name":"string","quantity":number,"unit":"string","llm_calories":number,"llm_protein_g":number,"llm_carbs_g":number,"llm_fat_g":number}],"llm_total_calories":number,"llm_total_protein_g":number,"llm_total_carbs_g":number,"llm_total_fat_g":number}`,
      ].join(' ');
      const { data } = await api.post('/meal-plans/swap', { mealId: meal.id, mealPlanId: plan.id, prompt });
      setPlan(prev => ({ ...prev, meals: prev.meals.map(m => m.id === meal.id ? data.meal : m) }));
      toast.success('Meal swapped');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Swap failed');
    } finally {
      setSwapping(null);
    }
  };

  // ── Log ───────────────────────────────────────────────────
  const handleLog = async (meal) => {
    const logged = loggedIds.has(meal.id);
    try {
      if (logged) {
        await api.delete(`/social/meals/${meal.id}/log`);
        setLoggedIds(prev => { const n = new Set(prev); n.delete(meal.id); return n; });
        toast.success('Meal unlogged');
      } else {
        await api.post(`/social/meals/${meal.id}/log`, { mealPlanId: plan.id, dayNumber: 1 });
        setLoggedIds(prev => new Set([...prev, meal.id]));
        toast.success('Meal logged');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update log');
    }
  };

  const sortedMeals = (meals = []) =>
    [...meals].sort((a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType));

  const totalKcal  = plan?.meals?.reduce((s, m) => s + (m.totalCalories || 0), 0) || 0;
  const loggedKcal = plan?.meals?.filter(m => loggedIds.has(m.id)).reduce((s, m) => s + (m.totalCalories || 0), 0) || 0;

  // ── Shopping list data ────────────────────────────────────
  const getShoppingItems = () => {
    const agg = {};
    (plan?.meals || []).forEach(meal =>
      (meal.ingredients || []).forEach(ing => {
        const name = (ing.ingredient?.name || ing.name || '').toLowerCase();
        if (!name) return;
        if (!agg[name]) agg[name] = { name, quantity: 0, unit: ing.unit || 'g' };
        agg[name].quantity += ing.quantity || 0;
      })
    );
    return Object.values(agg).sort((a, b) => a.name.localeCompare(b.name));
  };

  return (
    <div className="max-w-2xl mx-auto anim-up pb-16">

      {/* ── Compact header when viewing plan ── */}
      {!showForm && plan && (
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-serif text-[26px] font-light text-cream">
              Meal <em className="text-gold not-italic italic">Planner</em>
            </h1>
            <p className="text-[12px] text-muted">
              {new Date(plan.createdAt).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTab(t => t === 'history' ? 'today' : 'history')}
                    className="px-3 py-2 rounded-xl text-[12px] border border-[rgba(74,124,89,0.25)] text-muted hover:text-cream hover:border-sage/40 transition-all">
              {tab === 'history' ? '← Today' : '📋 History'}
            </button>
            <button onClick={() => setShowShopping(s => !s)}
                    className="px-3 py-2 rounded-xl text-[12px] border border-[rgba(74,124,89,0.25)] text-muted hover:text-cream hover:border-sage/40 transition-all">
              🛒 Shopping
            </button>
            <button onClick={() => { setShowForm(true); setTab('today'); setShowShopping(false); }}
                    className="px-3 py-2 rounded-xl text-[12px] font-semibold bg-sage/20 border border-sage/40 text-sage-l hover:bg-sage/30 transition-all">
              ↻ New Plan
            </button>
          </div>
        </div>
      )}

      {/* ── Page title when form showing ── */}
      {showForm && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-[30px] font-light text-cream">
              Meal <em className="text-gold not-italic italic">Planner</em>
            </h1>
            <p className="text-[13px] text-muted mt-1">Fill in your details to generate today's personalised meals</p>
          </div>
          {plan && (
            <button onClick={() => setShowForm(false)}
                    className="px-3 py-2 rounded-xl text-[12px] border border-[rgba(74,124,89,0.25)] text-muted hover:text-cream transition-all">
              ← Back to plan
            </button>
          )}
        </div>
      )}

      {/* ── Shopping list panel ── */}
      {!showForm && showShopping && plan && (() => {
        const items = getShoppingItems();
        const listText = items.map(i => `${i.name} — ${Math.round(i.quantity)} ${i.unit}`).join('\n');
        return (
          <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold text-cream">🛒 Today's Shopping List</p>
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard.writeText(listText); toast.success('Copied!'); }}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-[rgba(74,124,89,0.25)] text-sage hover:border-sage transition-all">
                  Copy
                </button>
                <button onClick={() => setShowShopping(false)}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-[rgba(74,124,89,0.25)] text-muted hover:text-cream transition-all">
                  ✕
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-forest/30 rounded-lg">
                  <span className="text-[12px] text-cream capitalize">{item.name}</span>
                  <span className="text-[11px] text-muted">{Math.round(item.quantity)}{item.unit}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Form ── */}
      {showForm && (
        <div className="flex flex-col gap-4">

          {/* Goal */}
          <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">Your Goal</p>
            <div className="grid grid-cols-1 gap-2">
              {GOALS.map(g => (
                <button key={g.value} onClick={() => setGoal(g.value)} type="button"
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left
                                    ${goal === g.value
                                      ? 'border-sage/50 bg-[rgba(74,124,89,0.12)]'
                                      : 'border-[rgba(74,124,89,0.15)] hover:border-sage/30'}`}>
                  <span className={`text-[14px] font-medium ${goal === g.value ? 'text-cream' : 'text-cream/80'}`}>{g.label}</span>
                  <span className="text-[11px] text-muted">{g.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Calories + TDEE */}
          <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Daily Calorie Target</p>
              {tdee && <span className="text-[11px] text-sage">Auto-set from TDEE</span>}
            </div>
            <input type="number" value={calories}
                   onChange={e => setCalories(parseInt(e.target.value) || 2000)}
                   min={1000} max={5000}
                   className="w-full bg-forest border border-[rgba(74,124,89,0.25)] rounded-xl
                              px-4 py-3 text-cream text-[20px] font-semibold text-center outline-none mb-4"/>
            <div className="flex gap-3 mb-5">
              {[['🌅','Breakfast',Math.round(calories*0.28)],
                ['☀️','Lunch',    Math.round(calories*0.35)],
                ['🌙','Dinner',   Math.round(calories*0.37)]].map(([ic,lb,kc]) => (
                <div key={lb} className="flex-1 text-center bg-forest/40 rounded-xl py-3 border border-[rgba(74,124,89,0.12)]">
                  <p className="text-xl mb-1">{ic}</p>
                  <p className="text-[10px] text-muted">{lb}</p>
                  <p className="text-[16px] font-semibold text-gold">{kc}</p>
                  <p className="text-[9px] text-muted">kcal</p>
                </div>
              ))}
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">
              TDEE Calculator <span className="normal-case font-normal">(optional)</span>
            </p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[['Weight (kg)',weight,setWeight,'70',30,300],
                ['Height (cm)',height,setHeight,'170',100,250],
                ['Age',age,setAge,'25',15,100]].map(([label,val,setter,ph,min,max]) => (
                <div key={label}>
                  <label className="text-[10px] text-muted block mb-1">{label}</label>
                  <input type="number" value={val} placeholder={ph} min={min} max={max}
                         onChange={e => setter(e.target.value)}
                         className="w-full bg-forest border border-[rgba(74,124,89,0.2)] rounded-xl px-3 py-2 text-cream text-[13px] outline-none"/>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted block mb-1">Biological sex</label>
                <select value={sex} onChange={e => setSex(e.target.value)}
                        className="w-full bg-forest border border-[rgba(74,124,89,0.2)] rounded-xl px-3 py-2 text-cream text-[13px] outline-none">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted block mb-1">Activity level</label>
                <select value={activity} onChange={e => setActivity(e.target.value)}
                        className="w-full bg-forest border border-[rgba(74,124,89,0.2)] rounded-xl px-3 py-2 text-cream text-[13px] outline-none">
                  <option value="sedentary">Sedentary</option>
                  <option value="light">Light — 1-3 days/week</option>
                  <option value="moderate">Moderate — 3-5 days/week</option>
                  <option value="active">Active — 6-7 days/week</option>
                  <option value="veryActive">Very active</option>
                </select>
              </div>
            </div>
            {tdee && (
              <div className="mt-3 flex items-center gap-3 bg-sage/10 border border-sage/20 rounded-xl px-4 py-2.5">
                <span className="text-sage text-lg">✦</span>
                <div>
                  <p className="text-[12px] text-cream font-semibold">Estimated TDEE: {tdee} kcal/day</p>
                  <p className="text-[11px] text-muted">
                    {goal === 'lose_weight' ? '−500 kcal deficit applied' :
                     goal === 'build_muscle' ? '+300 kcal surplus applied' : 'Maintenance calories'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Preferences */}
          <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">Dietary Preferences</p>
            <div className="flex flex-wrap gap-2">
              {PREFERENCES.map(p => (
                <button key={p} onClick={() => togglePref(p)} type="button"
                        className={`text-[12px] px-3 py-1.5 rounded-xl border transition-all
                                    ${prefs.includes(p) ? 'border-sage/50 bg-[rgba(74,124,89,0.15)] text-sage-l' : 'border-[rgba(74,124,89,0.2)] text-muted hover:text-cream'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Allergies */}
          <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">
              Allergies <span className="font-normal normal-case text-muted">(UK FSA 14 major allergens)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {ALLERGIES.map(a => (
                <button key={a} onClick={() => toggleAllergy(a)} type="button"
                        className={`text-[12px] px-3 py-1.5 rounded-xl border transition-all
                                    ${allergies.includes(a) ? 'border-rust/50 bg-[rgba(196,98,45,0.1)] text-rust-l' : 'border-[rgba(74,124,89,0.2)] text-muted hover:text-cream'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button onClick={handleGenerate} disabled={loading}
                  className="w-full py-4 rounded-2xl text-[15px] font-semibold
                             bg-sage hover:bg-sage-l text-forest transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
            {loading
              ? <span className="flex items-center justify-center gap-3">
                  <span className="w-5 h-5 border-2 border-forest/40 border-t-forest rounded-full animate-spin"/>
                  Generating your plan… (~15 seconds)
                </span>
              : '✦ Generate Today\'s Plan'}
          </button>
        </div>
      )}

      {/* ── Today's plan ── */}
      {!showForm && tab === 'today' && plan && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[13px] text-cream font-medium capitalize">{plan.goal?.replace('_',' ')}</p>
              <p className="text-[11px] text-muted">{plan.calorieTarget} kcal target</p>
            </div>
            <div className="text-right">
              <p className="text-[22px] font-semibold text-gold leading-tight">
                {Math.round(totalKcal)} <span className="text-[12px] text-muted font-normal">kcal</span>
              </p>
              {loggedKcal > 0 && (
                <p className="text-[11px] text-muted">{Math.round(loggedKcal)} logged</p>
              )}
            </div>
          </div>

          {loggedKcal > 0 && (
            <div className="mb-4">
              <div className="h-1.5 bg-forest3 rounded-full overflow-hidden mb-1">
                <div className="h-full bg-gradient-to-r from-sage to-gold rounded-full transition-all"
                     style={{ width: `${Math.min(100, (loggedKcal / totalKcal) * 100)}%` }}/>
              </div>
              <p className="text-[11px] text-muted">
                {Math.round(loggedKcal)} of {Math.round(totalKcal)} kcal logged today
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {sortedMeals(plan.meals).map(meal => (
              <MealCard
                key={meal.id}
                meal={meal}
                onSwap={handleSwap}
                onLog={handleLog}
                swapping={swapping}
                loggedIds={loggedIds}
                mealTarget={
                  meal.mealType === 'BREAKFAST' ? Math.round((plan.calorieTarget || calories) * 0.28) :
                  meal.mealType === 'LUNCH'     ? Math.round((plan.calorieTarget || calories) * 0.35) :
                                                   Math.round((plan.calorieTarget || calories) * 0.37)
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* ── History ── */}
      {!showForm && tab === 'history' && (
        <div className="flex flex-col gap-3">
          {history.length === 0
            ? <p className="text-center text-muted py-8">No previous plans yet.</p>
            : history.map(p => (
              <div key={p.id}
                   className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-4 hover:border-sage/30 transition-all">
                <div className="flex items-center justify-between cursor-pointer"
                     onClick={async () => {
                       setPlan(p);
                       setTab('today');
                       setShowForm(false);
                       try {
                         const { data: ld } = await api.get(`/social/nutrition/logged-meals?planId=${p.id}`);
                         setLoggedIds(new Set(ld.loggedMealIds || []));
                       } catch { setLoggedIds(new Set()); }
                     }}>
                  <div>
                    <p className="text-[12px] text-muted">
                      {new Date(p.createdAt).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-[13px] text-cream capitalize">{p.goal?.replace('_',' ')}</p>
                    <p className="text-[11px] text-muted mt-0.5">{p.meals?.map(m => m.name).join(' · ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-semibold text-gold">
                      {Math.round(p.meals?.reduce((s,m) => s + (m.totalCalories||0), 0) || 0)}
                    </p>
                    <p className="text-[10px] text-muted">kcal</p>
                  </div>
                </div>
                <div className="flex justify-end mt-2 pt-2 border-t border-[rgba(74,124,89,0.1)]">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await api.delete(`/meal-plans/${p.id}`);
                        setHistory(prev => prev.filter(h => h.id !== p.id));
                        toast.success('Plan deleted');
                      } catch {
                        toast.error('Failed to delete plan');
                      }
                    }}
                    className="text-[11px] text-muted hover:text-rust-l transition-colors px-2 py-1
                               rounded-lg hover:bg-[rgba(196,98,45,0.08)] border border-transparent
                               hover:border-rust/20">
                    Delete plan
                  </button>
                </div>
              </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {showForm && !loading && !plan && (
        <div className="text-center py-8 text-muted text-[13px]">
          Fill in your details above and generate your first plan.
        </div>
      )}
    </div>
  );
}