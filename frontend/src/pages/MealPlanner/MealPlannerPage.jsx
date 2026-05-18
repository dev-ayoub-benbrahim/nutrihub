import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

const DAYS        = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const GOALS = [
  { value: 'lose_weight',   label: 'Lose Weight',        desc: 'Calorie deficit, high protein, low fat'   },
  { value: 'build_muscle',  label: 'Build Muscle',        desc: 'High protein, calorie surplus'            },
  { value: 'maintain',      label: 'Maintain Weight',     desc: 'Balanced macros, steady energy'          },
  { value: 'eat_healthier', label: 'Eat Healthier',       desc: 'Whole foods, balanced nutrients'         },
  { value: 'high_energy',   label: 'High Energy',         desc: 'Complex carbs, sustained fuel'           },
];

const DIET_PREFS = ['Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Mediterranean', 'High-Protein', 'Low-Carb', 'Halal', 'Kosher'];
const MEAL_ORDER  = { BREAKFAST: 0, LUNCH: 1, DINNER: 2, SNACK: 3 };
const MEAL_EMOJI  = { BREAKFAST: '🌅', LUNCH: '☀️', DINNER: '🌙', SNACK: '🍎' };
const ALLERGY_OPTIONS = ['Peanuts','Tree Nuts','Milk','Eggs','Fish','Shellfish','Wheat','Gluten','Soya','Sesame','Mustard','Celery','Lupin','Sulphites'];

export default function MealPlannerPage() {
  const [step,      setStep]     = useState('form');
  const [showShoppingList, setShowShoppingList] = useState(false); // form|loading|result|history
  // Structured form state — no free text required from the user
  // TDEE inputs
  const [weight,    setWeight]   = useState('');
  const [height,    setHeight]   = useState('');
  const [age,       setAge]      = useState('');
  const [sex,       setSex]      = useState('male');
  const [activity,  setActivity] = useState('moderate');
  // Plan inputs
  const [goal,      setGoal]     = useState('');
  const [calories,  setCalories] = useState('');
  const [prefs,     setPrefs]    = useState([]);
  const [meals,     setMeals]    = useState('3');
  const [allergies, setAllergies]= useState([]);
  const [custom,    setCustom]   = useState('');
  const [plan,      setPlan]     = useState(null);
  const [warnings,  setWarnings] = useState([]);
  const [unmatched, setUnmatched]= useState([]);
  const [history,   setHistory]  = useState([]);
  const [activeDay,     setActiveDay]     = useState(1);
  const [swapping,      setSwapping]      = useState(null); // meal.id being swapped
  const [loggedMealIds, setLoggedMealIds] = useState(new Set()); // IDs logged today

  useEffect(() => {
    const loadLatest = async () => {
      try {
        const { data } = await api.get('/meal-plans');
        const plans = data.plans || [];
        setHistory(plans);

        // Auto-load most recent plan if one exists — skip the blank form
        if (plans.length > 0) {
          const latest = plans[0];
          const { data: planData } = await api.get(`/meal-plans/${latest.id}`);
          setPlan(planData.plan);
          setWarnings([]);
          setUnmatched([]);
          setActiveDay(1);
          // Restore logged meals for this plan
          const { data: logData } = await api.get(`/social/nutrition/logged-meals?planId=${latest.id}`).catch(() => ({ data: { loggedMealIds: [] } }));
          setLoggedMealIds(new Set(logData.loggedMealIds || []));
          setStep('result');
        }
      } catch { /* stay on form if anything fails */ }
    };
    loadLatest();
  }, []);

  const toggleAllergy = (a) =>
    setAllergies(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a]);

  const addCustom = () => {
    const v = custom.trim();
    if (v && !allergies.includes(v)) { setAllergies(p => [...p, v]); setCustom(''); }
  };

  // Mifflin-St Jeor TDEE calculator with input validation
  const VALID_RANGES = {
    weight: { min: 30,  max: 300, unit: 'kg',  hint: '30–300 kg' },
    height: { min: 100, max: 250, unit: 'cm',  hint: '100–250 cm' },
    age:    { min: 15,  max: 100, unit: 'yrs', hint: '15–100 years' },
  };

  const inputErrors = {
    weight: weight && (parseFloat(weight) < 30  || parseFloat(weight) > 300),
    height: height && (parseFloat(height) < 100 || parseFloat(height) > 250),
    age:    age    && (parseInt(age)       < 15  || parseInt(age)      > 100),
  };

  const calcTDEE = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age);
    if (!w || !h || !a) return null;
    // Reject physiologically impossible inputs
    if (w < 30 || w > 300 || h < 100 || h > 250 || a < 15 || a > 100) return null;
    const bmr = sex === 'male'
      ? 10 * w + 6.25 * h - 5 * a + 5
      : 10 * w + 6.25 * h - 5 * a - 161;
    const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
    const tdee = Math.round(bmr * (multipliers[activity] || 1.55));
    const adjustments = { lose_weight: -500, build_muscle: +300, maintain: 0, eat_healthier: 0, high_energy: +200 };
    return tdee + (adjustments[goal] || 0);
  };

  const tdeeCalories = calcTDEE();
  const effectiveCalories = calories ? parseInt(calories) : tdeeCalories;

  const buildPrompt = () => {
    const goalText    = GOALS.find(g => g.value === goal)?.label || goal;
    const prefText    = prefs.length    ? `Dietary preferences: ${prefs.join(', ')}.`   : '';

    // Determine calorie target — either user-specified or sensible goal-based default
    const calTarget = effectiveCalories || {
      lose_weight:   1700,
      build_muscle:  2800,
      maintain:      2200,
      eat_healthier: 2000,
      high_energy:   2500,
    }[goal] || 2000;

    const mealCount = parseInt(meals);
    // Distribute calories across meals
    const mealDist = mealCount === 4
      ? { BREAKFAST: Math.round(calTarget * 0.25), LUNCH: Math.round(calTarget * 0.30), DINNER: Math.round(calTarget * 0.35), SNACK: Math.round(calTarget * 0.10) }
      : { BREAKFAST: Math.round(calTarget * 0.28), LUNCH: Math.round(calTarget * 0.35), DINNER: Math.round(calTarget * 0.37) };

    const distText = Object.entries(mealDist)
      .map(([type, cal]) => `${type.charAt(0) + type.slice(1).toLowerCase()}: ~${cal} kcal`)
      .join(', ');

    return [
      `Goal: ${goalText}.`,
      `REQUIRED daily calorie target: ${calTarget} kcal. This is a hard requirement — each day MUST total approximately ${calTarget} kcal.`,
      `${mealCount} meals per day. Target per meal: ${distText}.`,
      `Use realistic portion sizes to hit these calorie targets — for a ${calTarget} kcal day with ${mealCount} meals, portions must be substantial.`,
      prefText,
      'Generate a varied 7-day plan using common, widely available ingredients. Vary meals across the week.',
    ].filter(Boolean).join(' ');
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!goal) return;
    setStep('loading');
    try {
      const { data } = await api.post('/meal-plans/generate', {
        text: buildPrompt(),
        allergies: allergies.map(a => a.toLowerCase()),
      }, { timeout: 150000 }); // 2.5 min
      setPlan(data.mealPlan);
      setWarnings(data.warnings || []);
      setUnmatched(data.unmatched || []);
      setHistory(p => [data.mealPlan, ...p.slice(0, 9)]);
      setActiveDay(1);
      // Restore today's logged meals so checkboxes show correct state
      api.get(`/social/nutrition/logged-meals?planId=${data.mealPlan?.id || data.plan?.id}`)
        .then(({ data: d }) => setLoggedMealIds(new Set(d.loggedMealIds || [])))
        .catch(() => {});
      setStep('result');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setStep('form');
    }
  };

  const handleSwapMeal = async (meal) => {
    if (swapping === meal.id) return;
    setSwapping(meal.id);
    try {
      // Calculate the per-meal calorie target based on the plan's daily target
      // Never use meal.totalCalories — it may be wrong (that's why we're swapping)
      const mealsPerDay   = plan.meals.filter(m => m.dayNumber === meal.dayNumber).length || 3;
      const dailyTarget   = plan.calorieTarget || 2000;
      const mealTargetKcal = Math.round(dailyTarget / mealsPerDay);

      // Give breakfast slightly less, lunch and dinner slightly more
      const mealBias = meal.mealType === 'BREAKFAST' ? 0.25
                     : meal.mealType === 'LUNCH'     ? 0.35
                     : 0.40;
      const adjustedTarget = Math.round(dailyTarget * mealBias);

      const prompt = [
        `Generate ONE ${meal.mealType} meal to replace "${meal.name}" (Day ${meal.dayNumber}).`,
        `REQUIRED calorie target: ~${adjustedTarget} kcal. This is a hard requirement — portions must be substantial enough to reach this target.`,
        `For context: daily target is ${dailyTarget} kcal split across ${mealsPerDay} meals.`,
        `Use common ingredients with realistic portion sizes. Include a brief cooking description.`,
        `Respond with a single JSON object only:`,
        `{"name":"string","description":"string","ingredients":[{"name":"string","quantity":number,"unit":"string","llm_calories":number,"llm_protein_g":number,"llm_carbs_g":number,"llm_fat_g":number}],"llm_total_calories":number,"llm_total_protein_g":number,"llm_total_carbs_g":number,"llm_total_fat_g":number}`,
      ].join(' ');

      const { data } = await api.post('/meal-plans/swap', {
        mealId:     meal.id,
        mealPlanId: plan.id,
        prompt,
      });

      // Update the plan in state with the new meal
      setPlan(prev => ({
        ...prev,
        meals: prev.meals.map(m => m.id === meal.id ? { ...m, ...data.meal } : m),
      }));
      toast.success('Meal swapped!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSwapping(null);
    }
  };

  const loadPlan = async (id) => {
    try {
      const { data } = await api.get(`/meal-plans/${id}`);
      setPlan(data.plan); setWarnings([]); setUnmatched([]);
      setActiveDay(1);
      api.get(`/social/nutrition/logged-meals?planId=${data.plan?.id}`)
        .then(({ data: d }) => setLoggedMealIds(new Set(d.loggedMealIds || [])))
        .catch(() => {});
      setStep('result');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const deletePlan = async (id) => {
    try {
      await api.delete(`/meal-plans/${id}`);
      setHistory(p => p.filter(h => h.id !== id));
      if (plan?.id === id) { setPlan(null); setStep('form'); }
      toast.success('Plan deleted');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const mealsByDay = plan ? plan.meals.reduce((acc, m) => {
    if (!acc[m.dayNumber]) acc[m.dayNumber] = [];
    acc[m.dayNumber].push(m);
    return acc;
  }, {}) : {};

  const dayMeals   = (mealsByDay[activeDay] || []).sort((a,b) => (MEAL_ORDER[a.mealType]||0) - (MEAL_ORDER[b.mealType]||0));
  const dayCalories = dayMeals.reduce((s, m) => s + (m.totalCalories || 0), 0);
  const dayWarning  = warnings.find(w => w.day_number === activeDay);

  return (
    <div className="max-w-4xl mx-auto anim-up">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-[32px] font-light text-cream">
            AI <em className="text-gold not-italic italic">Meal Planner</em>
          </h1>
          <p className="text-sm text-muted mt-1">
            {step === 'result' && plan
              ? `${plan.goal} · ${plan.calorieTarget} kcal/day — tap a meal to see details`
              : 'Fill in your details and generate a personalised 7-day plan validated by USDA'
            }
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {step === 'result' && (
            <button onClick={() => setStep('form')}
                    className="flex items-center gap-2 text-sm font-medium text-cream
                               bg-sage hover:bg-sage-l px-4 py-2 rounded-xl transition-all">
              <span>✨</span> Generate new plan
            </button>
          )}
          {step === 'form' && plan && (
            <button onClick={() => setStep('result')}
                    className="text-sm text-muted hover:text-cream border border-[rgba(74,124,89,0.25)]
                               hover:border-sage px-3 py-2 rounded-xl transition-all">
              ← Back to plan
            </button>
          )}
          {history.length > 1 && (
            <button onClick={() => setStep(s => s === 'history' ? (plan ? 'result' : 'form') : 'history')}
                    className="text-sm text-muted hover:text-cream border border-[rgba(74,124,89,0.25)]
                               hover:border-sage px-3 py-2 rounded-xl transition-all">
              {step === 'history' ? '← Back' : `History (${history.length})`}
            </button>
          )}
        </div>
      </div>

      {/* ── HISTORY ────────────────────────────────────────── */}
      {step === 'history' && (
        <div className="flex flex-col gap-3 anim-up">
          {history.map((h, i) => (
            <div key={h.id}
                 className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-4
                            flex items-center gap-4 anim-up"
                 style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-cream capitalize">{h.goal} · {h.calorieTarget} kcal/day</p>
                <p className="text-[11px] text-muted mt-0.5">
                  {new Date(h.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                </p>
                <p className="text-[11px] text-muted italic truncate max-w-sm">"{h.rawInput}"</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => loadPlan(h.id)}
                        className="text-[12px] text-sage-l hover:text-cream border border-[rgba(74,124,89,0.25)]
                                   hover:border-sage px-3 py-1.5 rounded-lg transition-all">View</button>
                <button onClick={() => deletePlan(h.id)}
                        className="text-[12px] text-muted hover:text-red-400 border border-transparent
                                   hover:border-red-500/20 px-3 py-1.5 rounded-lg transition-all">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── FORM ───────────────────────────────────────────── */}
      {step === 'form' && (
        <form onSubmit={handleGenerate} className="flex flex-col gap-5 anim-up">

          {/* Step 1 — Goal */}
          <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted mb-3">
              1 · What is your goal?
            </p>
            <div className="grid grid-cols-1 gap-2">
              {GOALS.map(g => (
                <label key={g.value}
                       className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer
                                   transition-all duration-200
                                   ${goal === g.value
                                     ? 'border-sage bg-[rgba(74,124,89,0.14)] text-cream'
                                     : 'border-[rgba(74,124,89,0.18)] text-muted hover:border-sage/40'}`}>
                  <input type="radio" name="goal" value={g.value}
                         checked={goal === g.value}
                         onChange={() => {
                           setGoal(g.value);
                           // Auto-set meals count based on goal
                           setMeals(['build_muscle','high_energy'].includes(g.value) ? '4' : '3');
                         }}
                         className="accent-sage flex-shrink-0"/>
                  <div>
                    <p className="text-[13px] font-medium text-cream">{g.label}</p>
                    <p className="text-[11px] text-muted">{g.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Step 2 — TDEE Calculator */}
          <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
                  2 · Your stats — calorie calculator
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  We calculate your exact maintenance calories using the Mifflin-St Jeor equation
                </p>
              </div>
              {tdeeCalories && (
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-[10px] text-muted uppercase tracking-wide">Recommended target</p>
                  <p className="text-[20px] font-semibold text-gold leading-tight">{tdeeCalories.toLocaleString()}</p>
                  <p className="text-[10px] text-muted">kcal / day</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Weight */}
              <div>
                <label className="text-[11px] text-muted block mb-1.5">Weight (kg)</label>
                <input type="number" value={weight} onChange={e => setWeight(e.target.value)}
                       placeholder="e.g. 75" min={30} max={300}
                       className={`w-full bg-forest border rounded-xl px-3 py-2.5 text-cream text-sm
                                   placeholder:text-muted outline-none transition-colors
                                   ${inputErrors.weight ? 'border-red-500/60 focus:border-red-400' : 'border-[rgba(74,124,89,0.25)] focus:border-sage'}`}/>
                {inputErrors.weight && <p className="text-[10px] text-red-400 mt-1">Must be {VALID_RANGES.weight.hint}</p>}
              </div>
              {/* Height */}
              <div>
                <label className="text-[11px] text-muted block mb-1.5">Height (cm)</label>
                <input type="number" value={height} onChange={e => setHeight(e.target.value)}
                       placeholder="e.g. 175" min={100} max={250}
                       className={`w-full bg-forest border rounded-xl px-3 py-2.5 text-cream text-sm
                                   placeholder:text-muted outline-none transition-colors
                                   ${inputErrors.height ? 'border-red-500/60 focus:border-red-400' : 'border-[rgba(74,124,89,0.25)] focus:border-sage'}`}/>
                {inputErrors.height && <p className="text-[10px] text-red-400 mt-1">Must be {VALID_RANGES.height.hint}</p>}
              </div>
              {/* Age */}
              <div>
                <label className="text-[11px] text-muted block mb-1.5">Age</label>
                <input type="number" value={age} onChange={e => setAge(e.target.value)}
                       placeholder="e.g. 22" min={15} max={100}
                       className={`w-full bg-forest border rounded-xl px-3 py-2.5 text-cream text-sm
                                   placeholder:text-muted outline-none transition-colors
                                   ${inputErrors.age ? 'border-red-500/60 focus:border-red-400' : 'border-[rgba(74,124,89,0.25)] focus:border-sage'}`}/>
                {inputErrors.age && <p className="text-[10px] text-red-400 mt-1">Must be {VALID_RANGES.age.hint}</p>}
              </div>
              {/* Sex */}
              <div>
                <label className="text-[11px] text-muted block mb-1.5">Biological sex</label>
                <div className="flex gap-2">
                  {[['male','Male'],['female','Female']].map(([v,l]) => (
                    <button key={v} type="button" onClick={() => setSex(v)}
                            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all
                                        ${sex === v
                                          ? 'border-sage bg-[rgba(74,124,89,0.18)] text-cream'
                                          : 'border-[rgba(74,124,89,0.2)] text-muted hover:text-cream'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Activity level */}
            <div className="mb-3">
              <label className="text-[11px] text-muted block mb-1.5">Activity level</label>
              <div className="flex flex-col gap-1.5">
                {[
                  ['sedentary',   'Sedentary',    'Desk job, little or no exercise'],
                  ['light',       'Lightly active','Exercise 1–3 days/week'],
                  ['moderate',    'Moderately active','Exercise 3–5 days/week'],
                  ['active',      'Very active',  'Hard exercise 6–7 days/week'],
                  ['very_active', 'Athlete',      'Physical job + daily training'],
                ].map(([v, l, d]) => (
                  <label key={v}
                         className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer
                                     transition-all duration-150
                                     ${activity === v
                                       ? 'border-sage bg-[rgba(74,124,89,0.12)] text-cream'
                                       : 'border-[rgba(74,124,89,0.15)] text-muted hover:border-sage/30'}`}>
                    <input type="radio" name="activity" value={v} checked={activity === v}
                           onChange={() => setActivity(v)} className="accent-sage flex-shrink-0"/>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium">{l}</span>
                      <span className="text-[11px] text-muted">{d}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Manual override */}
            <div className="pt-3 border-t border-[rgba(74,124,89,0.12)]">
              <label className="text-[11px] text-muted block mb-1.5">
                Override calorie target <span className="text-muted/60">(optional — leave blank to use calculated value)</span>
              </label>
              <div className="flex gap-3 items-center">
                <input type="number" value={calories} onChange={e => setCalories(e.target.value)}
                       placeholder={tdeeCalories ? `Calculated: ${tdeeCalories}` : "e.g. 2200"}
                       min={800} max={6000}
                       className="w-full bg-forest border border-[rgba(74,124,89,0.25)] rounded-xl
                                  px-3 py-2.5 text-cream text-sm placeholder:text-muted
                                  outline-none focus:border-sage transition-colors"/>
                {effectiveCalories && (
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[12px] text-gold font-semibold whitespace-nowrap">{effectiveCalories.toLocaleString()} kcal</p>
                    <p className="text-[10px] text-muted">will be used</p>
                  </div>
                )}
              </div>
            </div>

            {/* Meals per day */}
            <div className="pt-3 mt-3 border-t border-[rgba(74,124,89,0.12)] flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted font-semibold uppercase tracking-wide">Meals per day</p>
              </div>
              <div className="flex gap-2">
                {['3','4'].map(n => (
                  <button key={n} type="button" onClick={() => setMeals(n)}
                          className={`px-5 py-2 rounded-xl border text-sm font-medium transition-all
                                      ${meals === n
                                        ? 'border-sage bg-[rgba(74,124,89,0.18)] text-cream'
                                        : 'border-[rgba(74,124,89,0.2)] text-muted hover:text-cream'}`}>
                    {n} {meals === n ? (n === '4' ? '(+snack)' : 'meals') : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3 — Diet preferences */}
          <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted mb-3">
              3 · Dietary preferences <span className="text-muted normal-case font-normal">(optional)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {DIET_PREFS.map(p => (
                <button key={p} type="button"
                        onClick={() => setPrefs(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                        className={`text-[12px] px-3 py-1.5 rounded-xl border transition-all
                                    ${prefs.includes(p)
                                      ? 'border-sage/50 bg-[rgba(74,124,89,0.18)] text-cream'
                                      : 'border-[rgba(74,124,89,0.18)] text-muted hover:text-cream hover:border-sage/30'}`}>
                  {prefs.includes(p) ? '✓ ' : ''}{p}
                </button>
              ))}
            </div>
          </div>

          {/* Step 4 — Allergies */}
          <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
                  4 · Allergies & hard avoidances
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  Enforced as hard constraints — the AI will never include these
                </p>
              </div>
              {allergies.length > 0 && (
                <span className="text-[11px] text-rust-l border border-rust/30 px-2 py-0.5 rounded-lg ml-3 flex-shrink-0">
                  {allergies.length} selected
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {ALLERGY_OPTIONS.map(a => (
                <button key={a} type="button" onClick={() => toggleAllergy(a)}
                        className={`text-[12px] px-3 py-1.5 rounded-xl border transition-all
                                    ${allergies.includes(a)
                                      ? 'border-rust/50 bg-[rgba(196,98,45,0.15)] text-rust-l'
                                      : 'border-[rgba(74,124,89,0.18)] text-muted hover:border-rust/30 hover:text-cream'}`}>
                  {allergies.includes(a) ? '✕ ' : ''}{a}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={custom} onChange={e => setCustom(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
                     placeholder="Add another (e.g. sesame, mustard)..."
                     className="flex-1 bg-forest border border-[rgba(74,124,89,0.2)] rounded-xl
                                px-3 py-2 text-sm text-cream placeholder:text-muted
                                outline-none focus:border-sage transition-colors"/>
              <button type="button" onClick={addCustom}
                      className="text-sm text-muted hover:text-cream border border-[rgba(74,124,89,0.2)]
                                 hover:border-sage px-4 py-2 rounded-xl transition-all">Add</button>
            </div>
            {allergies.filter(a => !ALLERGY_OPTIONS.includes(a)).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {allergies.filter(a => !ALLERGY_OPTIONS.includes(a)).map(a => (
                  <span key={a} className="text-[12px] px-2.5 py-1 rounded-lg border border-rust/40
                                           bg-[rgba(196,98,45,0.12)] text-rust-l flex items-center gap-1.5">
                    {a}
                    <button type="button" onClick={() => toggleAllergy(a)} className="hover:text-white">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* AI banner */}
          <div className="flex items-start gap-3 bg-[rgba(212,168,67,0.06)] border border-gold/20 rounded-2xl px-5 py-4">
            <span className="text-xl flex-shrink-0">✨</span>
            <p className="text-[12px] text-muted leading-relaxed">
              <span className="text-gold font-semibold">4-stage AI pipeline: </span>
              GPT-4o generates 21 varied meals → USDA FoodData Central validates every
              ingredient's nutrition with real database values → output validator checks
              your calorie target is met each day. Takes 15–30 seconds.
            </p>
          </div>

          <button type="submit" disabled={!goal || Object.values(inputErrors).some(Boolean)}
                  className="w-full py-3.5 bg-gradient-to-r from-sage to-[rgba(74,124,89,0.6)]
                             border border-sage/50 rounded-2xl text-cream font-medium text-[15px]
                             hover:opacity-90 transition-opacity disabled:opacity-40
                             disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <SparkleIcon/> Generate My 7-Day Plan
          </button>
        </form>
      )}

      {/* ── LOADING ─────────────────────────────────────────── */}
      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center py-24 text-center anim-in">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full border-2 border-sage border-t-transparent animate-spin"/>
            <span className="absolute inset-0 flex items-center justify-center text-2xl">✨</span>
          </div>
          <h2 className="font-serif text-2xl font-light text-cream mb-2">Building your plan</h2>
          <p className="text-sm text-muted max-w-xs">
            GPT-4o is generating 21 meals, then USDA is validating every ingredient.
            This takes 15–30 seconds.
          </p>
          <LoadingSteps/>
        </div>
      )}

      {/* ── RESULT ──────────────────────────────────────────── */}
      {step === 'result' && plan && (
        <div className="anim-up">

          {/* Summary card */}
          <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5 mb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gold mb-1">Your Plan</p>
                <h2 className="font-serif text-xl font-light text-cream capitalize">
                  {plan.goal} · {plan.calorieTarget} kcal/day
                </h2>
                {plan.restrictions?.length > 0 && (
                  <p className="text-[12px] text-muted mt-1">Preferences: {plan.restrictions.join(', ')}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[11px] text-muted">
                  {new Date(plan.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                </p>
                <p className="text-[11px] text-sage-l mt-1">✓ USDA validated</p>
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[rgba(74,124,89,0.18)]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gold mb-1.5">⚠ Calorie Warnings</p>
                {warnings.map(w => (
                  <p key={w.day_number} className="text-[12px] text-cream/70">
                    {DAYS[w.day_number - 1]}: {Math.round(w.actual_calories)} kcal
                    ({w.deviation_pct > 0 ? '+' : ''}{w.deviation_pct.toFixed(0)}% from target)
                  </p>
                ))}
              </div>
            )}
            {unmatched.length > 0 && (
              <p className="text-[11px] text-muted mt-3 pt-3 border-t border-[rgba(74,124,89,0.18)]">
                ℹ {unmatched.length} ingredient{unmatched.length > 1 ? 's' : ''} used LLM estimate
                (no USDA match): {unmatched.slice(0,5).join(', ')}{unmatched.length > 5 ? '…' : ''}
              </p>
            )}
          </div>

          {/* Day selector */}
          <div className="grid grid-cols-7 gap-1.5 mb-5">
            {DAYS.map((day, i) => {
              const n    = i + 1;
              const cals = (mealsByDay[n] || []).reduce((s, m) => s + (m.totalCalories || 0), 0);
              const warn = warnings.some(w => w.day_number === n);
              return (
                <button key={day} onClick={() => setActiveDay(n)}
                        className={`flex flex-col items-center p-2 rounded-xl border transition-all
                                    ${activeDay === n
                                      ? 'border-sage bg-[rgba(74,124,89,0.18)] text-cream'
                                      : 'border-[rgba(74,124,89,0.18)] text-muted hover:border-sage/40'}`}>
                  <span className="text-[10px] font-semibold uppercase tracking-wide">{day.slice(0,3)}</span>
                  <span className="text-[11px] text-gold mt-0.5">{Math.round(cals)}</span>
                  {warn && <span className="text-[9px] text-yellow-400">⚠</span>}
                </button>
              );
            })}
          </div>

          {/* Day header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-[22px] font-light text-cream">{DAYS[activeDay - 1]}</h3>
            <div className="flex items-center gap-2 text-sm">
              <span className={`font-semibold ${dayWarning ? 'text-yellow-400' : 'text-gold'}`}>
                {Math.round(dayCalories)} kcal
              </span>
              {plan.calorieTarget && (
                <span className="text-muted">/ {plan.calorieTarget} target</span>
              )}
            </div>
          </div>

          {/* Shopping list toggle */}
          {!showShoppingList && (
            <button onClick={() => setShowShoppingList(true)}
                    className="w-full mb-3 py-2 text-[12px] text-muted hover:text-cream
                               border border-[rgba(74,124,89,0.18)] hover:border-sage
                               rounded-xl transition-all flex items-center justify-center gap-2">
              🛒 Generate weekly shopping list
            </button>
          )}
          {showShoppingList && (
            <ShoppingList
              meals={plan.meals}
              onClose={() => setShowShoppingList(false)}
            />
          )}

          {/* Daily progress bar */}
          <DailyProgress
            meals={dayMeals}
            loggedIds={loggedMealIds}
            calorieTarget={plan.calorieTarget}
          />

          {/* Meal checklist */}
          <div className="flex flex-col gap-4 pb-8">
            {dayMeals.map(meal => (
              <MealCard
                key={meal.id}
                meal={meal}
                isLogged={loggedMealIds.has(meal.id)}
                isSwapping={swapping === meal.id}
                onSwap={() => handleSwapMeal(meal)}
                onToggleLog={async () => {
                  if (loggedMealIds.has(meal.id)) return;
                  try {
                    await api.post(`/social/meals/${meal.id}/log`);
                    setLoggedMealIds(prev => new Set([...prev, meal.id]));
                    toast.success('Meal logged!');
                  } catch (err) {
                    const msg = err?.response?.data?.message || err?.message || 'Could not log meal';
                    toast.error(msg);
                    console.error('Log meal error:', err?.response?.data || err);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ── DailyProgress ─────────────────────────────────────────────
function DailyProgress({ meals, loggedIds, calorieTarget }) {
  const loggedCals  = meals.filter(m => loggedIds.has(m.id)).reduce((s, m) => s + (m.totalCalories || 0), 0);
  const loggedCount = meals.filter(m => loggedIds.has(m.id)).length;
  const pct = calorieTarget ? Math.min(100, Math.round(loggedCals / calorieTarget * 100)) : 0;
  if (loggedCount === 0) return null;
  return (
    <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Today's progress</p>
          <p className="text-[12px] text-muted mt-0.5">{loggedCount} of {meals.length} meals logged</p>
        </div>
        <div className="text-right">
          <p className="text-[20px] font-semibold text-gold leading-tight">
            {Math.round(loggedCals)}<span className="text-[12px] font-normal text-muted ml-1">kcal</span>
          </p>
          {calorieTarget && <p className="text-[11px] text-muted">/ {calorieTarget} target</p>}
        </div>
      </div>
      <div className="h-2 bg-forest3 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-sage to-gold rounded-full transition-all duration-700"
             style={{ width: `${pct}%` }}/>
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-muted">
        <span>{pct}% of daily target</span>
        {calorieTarget && loggedCals < calorieTarget && <span>{Math.round(calorieTarget - loggedCals)} kcal remaining</span>}
        {calorieTarget && loggedCals >= calorieTarget && <span className="text-sage-l">✓ Target reached!</span>}
      </div>
    </div>
  );
}

// ── MealCard — checklist with expandable detail ────────────────
function MealCard({ meal, isLogged, onToggleLog, onSwap, isSwapping }) {
  const [open, setOpen] = useState(true); // open by default
  const p = meal.totalProteinG || 0;
  const c = meal.totalCarbsG   || 0;
  const f = meal.totalFatG     || 0;
  const t = p*4 + c*4 + f*9;

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all duration-200
                     ${isLogged ? 'border-sage/40 bg-[rgba(74,124,89,0.06)]' : 'border-[rgba(74,124,89,0.22)] bg-forest2'}`}>

      {/* Header — always visible */}
      <div className="flex items-center gap-3 px-4 py-3.5">

        {/* Checkbox */}
        <button onClick={(e) => { e.stopPropagation(); onToggleLog(); }}
                title={isLogged ? 'Logged' : 'Mark as eaten'}
                className={`w-6 h-6 rounded-full flex-shrink-0 border-2 flex items-center justify-center
                            transition-all duration-200
                            ${isLogged ? 'border-sage bg-sage text-cream' : 'border-[rgba(74,124,89,0.35)] hover:border-sage'}`}>
          {isLogged && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </button>

        {/* Meal info */}
        <button onClick={() => setOpen(s => !s)} className="flex-1 flex items-center gap-3 text-left min-w-0">
          <span className="text-xl flex-shrink-0">{MEAL_EMOJI[meal.mealType] || '🍽️'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-0.5">{meal.mealType}</p>
            <p className={`text-[15px] font-medium truncate transition-colors
                           ${isLogged ? 'text-muted line-through decoration-sage/50' : 'text-cream'}`}>
              {meal.name}
            </p>
          </div>
        </button>

        {/* Calories + swap + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setOpen(s => !s)} className="text-right">
            <p className="text-[15px] font-semibold text-gold">{Math.round(meal.totalCalories)} kcal</p>
            <p className="text-[11px] text-muted">P{p.toFixed(0)}g C{c.toFixed(0)}g F{f.toFixed(0)}g</p>
          </button>
          {/* Swap button */}
          <button onClick={onSwap} disabled={isSwapping || isLogged}
                  title={isLogged ? "Can't swap a logged meal" : "Swap for a different meal"}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                              border transition-all duration-200
                              ${isLogged
                                ? 'border-transparent opacity-30 cursor-not-allowed'
                                : 'border-[rgba(74,124,89,0.25)] hover:border-sage text-muted hover:text-cream'}`}>
            {isSwapping
              ? <span className="text-[10px] animate-spin">↻</span>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="17 1 21 5 17 9"/>
                  <path d="M3 11V9a4 4 0 014-4h14"/>
                  <polyline points="7 23 3 19 7 15"/>
                  <path d="M21 13v2a4 4 0 01-4 4H3"/>
                </svg>
            }
          </button>
          <button onClick={() => setOpen(s => !s)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round"
                 className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Expandable detail */}
      {open && (
        <div className="px-5 pb-4 pt-1 border-t border-[rgba(74,124,89,0.12)]">
          {/* Cooking description */}
          {meal.description && (
            <div className="mb-3 pb-3 border-b border-[rgba(74,124,89,0.1)]">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted mb-1.5">
                How to make it
              </p>
              <p className="text-[13px] text-cream/80 leading-relaxed">{meal.description}</p>
            </div>
          )}
          <div className="divide-y divide-[rgba(74,124,89,0.08)]">
            {meal.ingredients?.map((ing, i) => {
              const iP   = ing.usdaProteinG ?? 0;
              const iC   = ing.usdaCarbsG   ?? 0;
              const iF   = ing.usdaFatG     ?? 0;
              const iCal = ing.usdaCalories;
              const matched = iCal != null && iCal > 0;
              return (
                <div key={i} className="py-2.5 flex items-start gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${matched ? 'bg-sage' : 'bg-muted/40'}`}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[14px] text-cream/90 capitalize font-medium">
                        {ing.ingredient?.name || ing.name}
                      </span>
                      <span className="text-[12px] text-muted">{ing.quantity} {ing.unit}</span>
                    </div>
                    {matched
                      ? <div className="flex gap-3 mt-0.5 text-[11px]">
                          <span className="text-blue-400/80">P {iP.toFixed(1)}g</span>
                          <span className="text-gold/70">C {iC.toFixed(1)}g</span>
                          <span className="text-rust-l/80">F {iF.toFixed(1)}g</span>
                        </div>
                      : <span className="text-[11px] text-muted/60 italic">estimated</span>
                    }
                  </div>
                  <div className="flex-shrink-0">
                    {iCal != null && iCal > 0
                      ? <span className="text-[14px] font-semibold text-gold/90">{Math.round(iCal)} kcal</span>
                      : <span className="text-[12px] text-muted">—</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Macro bar */}
          {t > 0 && (
            <div className="mt-3 pt-3 border-t border-[rgba(74,124,89,0.1)]">
              <div className="flex h-2 rounded-full overflow-hidden gap-px mb-2">
                <div className="bg-blue-400/60 rounded-l-full" style={{ width: `${Math.round(p*4/t*100)}%` }}/>
                <div className="bg-gold/50"                    style={{ width: `${Math.round(c*4/t*100)}%` }}/>
                <div className="bg-rust/50 rounded-r-full"    style={{ width: `${Math.round(f*9/t*100)}%` }}/>
              </div>
              <div className="flex gap-4 text-[11px] text-muted">
                <span><span className="text-blue-400">●</span> P {Math.round(p*4/t*100)}%</span>
                <span><span className="text-gold/80">●</span> C {Math.round(c*4/t*100)}%</span>
                <span><span className="text-rust-l">●</span> F {Math.round(f*9/t*100)}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Loading steps ──────────────────────────────────────────────
function LoadingSteps() {
  const [s, setS] = useState(0);
  const steps = ['GPT-4o generating your 7-day plan…','Validating nutrition with USDA…','Checking calorie targets…'];
  useEffect(() => {
    const ts = steps.map((_, i) => setTimeout(() => setS(i), i * 9000));
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <div className="mt-6 flex flex-col gap-2 text-left max-w-xs">
      {steps.map((step, i) => (
        <div key={i} className={`flex items-center gap-2 text-[12px] transition-all duration-500
                                  ${i < s ? 'text-sage-l' : i === s ? 'text-cream' : 'text-muted'}`}>
          <span>{i < s ? '✓' : i === s ? '→' : '○'}</span>{step}
        </div>
      ))}
    </div>
  );
}

// ── ShoppingList ───────────────────────────────────────────────
function ShoppingList({ meals, onClose }) {
  const ingMap = {};
  (meals || []).forEach(meal => {
    (meal.ingredients || []).forEach(ing => {
      const name = ing.ingredient?.name || ing.name || '';
      const key  = name.toLowerCase().trim();
      if (!key) return;
      if (!ingMap[key]) ingMap[key] = { name, quantity: 0, unit: ing.unit };
      ingMap[key].quantity += ing.quantity;
    });
  });
  const items = Object.values(ingMap).sort((a, b) => a.name.localeCompare(b.name));

  const handleCopy = () => {
    const lines = ['NutriHub Weekly Shopping List', ''];
    items.forEach(i => {
      const qty = i.quantity % 1 === 0 ? i.quantity : i.quantity.toFixed(1);
      lines.push('• ' + i.name + ': ' + qty + ' ' + i.unit);
    });
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="mb-4 bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-gold">
          🛒 Weekly Shopping List ({items.length} items)
        </p>
        <div className="flex gap-3">
          <button onClick={handleCopy}
                  className="text-[11px] text-sage-l hover:text-cream transition-colors">
            Copy ↗
          </button>
          <button onClick={onClose}
                  className="text-[11px] text-muted hover:text-cream transition-colors">
            ×
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-64 overflow-y-auto">
        {items.map((ing, i) => (
          <div key={i} className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="text-cream/85 capitalize truncate">{ing.name}</span>
            <span className="text-gold flex-shrink-0 font-medium">
              {ing.quantity % 1 === 0 ? ing.quantity : ing.quantity.toFixed(1)} {ing.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);