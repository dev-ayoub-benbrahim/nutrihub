import { useState } from 'react';
import api from '../utils/axios';
import { getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

const GOALS = [
  { value: 'LOSE_WEIGHT',   label: 'Lose Weight',     emoji: '🔥', desc: 'Calorie deficit, high protein' },
  { value: 'BUILD_MUSCLE',  label: 'Build Muscle',    emoji: '💪', desc: 'High protein, calorie surplus' },
  { value: 'MAINTAIN',      label: 'Maintain Weight', emoji: '⚖️', desc: 'Balanced, steady energy'       },
  { value: 'EAT_HEALTHIER', label: 'Eat Healthier',   emoji: '🥗', desc: 'Whole foods, clean eating'     },
];

const CUISINES = [
  'Italian', 'Mediterranean', 'Asian', 'Japanese', 'Chinese',
  'Indian', 'Middle Eastern', 'Mexican', 'American', 'British',
  'French', 'Moroccan', 'Caribbean', 'Greek', 'Thai',
];

const RESTRICTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free',
  'Halal', 'Kosher', 'Keto', 'Paleo', 'Nut-Free',
];

export default function OnboardingWizard({ onComplete }) {
  const { updateUser } = useAuth(); 
  const [step,         setStep]         = useState(1); // 1 | 2 | 3
  const [goal,         setGoal]         = useState('');
  const [cuisines,     setCuisines]     = useState([]);
  const [restrictions, setRestrictions] = useState([]);
  const [saving,       setSaving]       = useState(false);

  const toggleCuisine     = (c) => setCuisines(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const toggleRestriction = (r) => setRestrictions(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r]);

  const handleFinish = async () => {
  setSaving(true);
  try {
    const { data } = await api.put('/auth/me', {
      ...(goal              && { goal }),
      ...(cuisines.length   && { cuisinePrefs: cuisines }),
      ...(restrictions.length && { restrictions }),
    });
    updateUser(data);   // update React context so UI reflects changes immediately
    onComplete();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    setSaving(false);
  }
};

  const STEPS = [
    { number: 1, label: 'Your goal'   },
    { number: 2, label: 'Cuisines'    },
    { number: 3, label: 'Dietary'     },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/95 backdrop-blur-md">
      <div className="w-full max-w-lg">

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.number} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 transition-all duration-300
                               ${step >= s.number ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold
                                  border-2 transition-all duration-300
                                  ${step > s.number
                                    ? 'bg-sage border-sage text-cream'
                                    : step === s.number
                                      ? 'bg-transparent border-sage text-sage-l'
                                      : 'bg-transparent border-muted text-muted'}`}>
                  {step > s.number ? '✓' : s.number}
                </div>
                <span className={`text-[12px] font-medium hidden sm:block
                                   ${step === s.number ? 'text-cream' : 'text-muted'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px transition-colors duration-300
                                  ${step > s.number ? 'bg-sage' : 'bg-forest3'}`}/>
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-forest2 border border-[rgba(74,124,89,0.22)] rounded-2xl overflow-hidden">

          {/* ── Step 1: Goal ─────────────────────────────── */}
          {step === 1 && (
            <div className="p-6 anim-up">
              <div className="text-center mb-6">
                <h2 className="font-serif text-[28px] font-light text-cream mb-1">
                  Welcome to <em className="text-gold not-italic italic">NutriHub</em>
                </h2>
                <p className="text-sm text-muted">
                  Let's personalise your experience — takes less than a minute
                </p>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted mb-3">
                What is your main health goal?
              </p>
              <div className="flex flex-col gap-2">
                {GOALS.map(g => (
                  <button key={g.value} onClick={() => setGoal(g.value)}
                          className={`flex items-center gap-4 p-3.5 rounded-2xl border text-left
                                      transition-all duration-200
                                      ${goal === g.value
                                        ? 'border-sage bg-[rgba(74,124,89,0.18)] text-cream'
                                        : 'border-[rgba(74,124,89,0.18)] text-muted hover:border-sage/40 hover:text-cream'}`}>
                    <span className="text-2xl flex-shrink-0">{g.emoji}</span>
                    <div>
                      <p className="text-[14px] font-medium text-cream">{g.label}</p>
                      <p className="text-[12px] text-muted">{g.desc}</p>
                    </div>
                    {goal === g.value && (
                      <span className="ml-auto text-sage text-lg flex-shrink-0">✓</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-6">
                <button onClick={onComplete}
                        className="text-sm text-muted hover:text-cream transition-colors">
                  Skip for now
                </button>
                <button onClick={() => setStep(2)} disabled={!goal}
                        className="flex items-center gap-2 text-sm font-medium text-cream
                                   bg-sage hover:bg-sage-l px-5 py-2.5 rounded-xl
                                   transition-all disabled:opacity-40">
                  Next <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Cuisines ─────────────────────────── */}
          {step === 2 && (
            <div className="p-6 anim-up">
              <div className="mb-5">
                <h2 className="font-serif text-[24px] font-light text-cream mb-1">
                  What cuisines do you love?
                </h2>
                <p className="text-sm text-muted">
                  Select any that interest you — we'll use these to personalise your feed
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {CUISINES.map(c => (
                  <button key={c} onClick={() => toggleCuisine(c)}
                          className={`text-[13px] px-3.5 py-2 rounded-xl border transition-all duration-200
                                      ${cuisines.includes(c)
                                        ? 'border-gold/50 bg-[rgba(212,168,67,0.15)] text-gold'
                                        : 'border-[rgba(74,124,89,0.18)] text-muted hover:border-sage/40 hover:text-cream'}`}>
                    {cuisines.includes(c) ? '✓ ' : ''}{c}
                  </button>
                ))}
              </div>
              {cuisines.length > 0 && (
                <p className="text-[12px] text-sage-l mb-4">
                  {cuisines.length} cuisine{cuisines.length > 1 ? 's' : ''} selected
                </p>
              )}
              <div className="flex justify-between">
                <button onClick={() => setStep(1)}
                        className="text-sm text-muted hover:text-cream transition-colors">
                  ← Back
                </button>
                <button onClick={() => setStep(3)}
                        className="flex items-center gap-2 text-sm font-medium text-cream
                                   bg-sage hover:bg-sage-l px-5 py-2.5 rounded-xl transition-all">
                  Next <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Dietary ──────────────────────────── */}
          {step === 3 && (
            <div className="p-6 anim-up">
              <div className="mb-5">
                <h2 className="font-serif text-[24px] font-light text-cream mb-1">
                  Any dietary preferences?
                </h2>
                <p className="text-sm text-muted">
                  We'll filter recipes and meal plans to match your needs
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {RESTRICTIONS.map(r => (
                  <button key={r} onClick={() => toggleRestriction(r)}
                          className={`text-[13px] px-3.5 py-2 rounded-xl border transition-all duration-200
                                      ${restrictions.includes(r)
                                        ? 'border-sage/50 bg-[rgba(74,124,89,0.18)] text-cream'
                                        : 'border-[rgba(74,124,89,0.18)] text-muted hover:border-sage/40 hover:text-cream'}`}>
                    {restrictions.includes(r) ? '✓ ' : ''}{r}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-muted mb-5">
                You can always update these later in your profile settings
              </p>
              <div className="flex justify-between">
                <button onClick={() => setStep(2)}
                        className="text-sm text-muted hover:text-cream transition-colors">
                  ← Back
                </button>
                <button onClick={handleFinish} disabled={saving}
                        className="flex items-center gap-2 text-sm font-medium text-cream
                                   bg-gradient-to-r from-sage to-[rgba(74,124,89,0.7)]
                                   border border-sage/50 px-6 py-2.5 rounded-xl
                                   transition-all disabled:opacity-50">
                  {saving ? 'Saving…' : 'Finish setup ✓'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mt-4">
          {STEPS.map(s => (
            <div key={s.number}
                 className={`h-1 flex-1 rounded-full transition-all duration-500
                               ${step >= s.number ? 'bg-sage' : 'bg-forest3'}`}/>
          ))}
        </div>
      </div>
    </div>
  );
}