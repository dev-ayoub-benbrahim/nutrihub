import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../utils/axios';
import { getErrorMessage } from '../../utils/helpers';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const schema = z.object({
  title:       z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  cuisine:     z.string().optional(),
  cookTime:    z.string().optional(),
  prepTime:    z.string().optional(),
  difficulty:  z.enum(['EASY', 'MEDIUM', 'HARD']).default('EASY'),
  tags:        z.string().optional(),
});

const CUISINES   = ['Italian','Japanese','Mediterranean','Mexican','Indian','Caribbean','Moroccan','American','French','Chinese','Thai','Middle Eastern'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

// Ingredients recognised by the built-in nutrition table
// If an ingredient isn't in this list, the author can optionally add macros manually
const KNOWN_INGREDIENTS = [
  "egg","eggs","chicken breast","chicken","beef","ground beef","salmon","tuna","shrimp",
  "white rice","brown rice","rice","pasta","oats","bread","potato","sweet potato","quinoa",
  "lentils","chickpeas","spinach","broccoli","carrot","tomato","onion","garlic","mushroom",
  "avocado","banana","apple","milk","cheese","yogurt","butter","olive oil","almonds",
  "peanut butter","honey","flour","sugar","cucumber","lettuce","pepper","corn","peas",
  "tofu","hummus","couscous","turkey","lamb","cauliflower","kale","pork","cod","cream",
  "berries","blueberry","strawberry","mango","grapes","lemon","walnuts","chia seeds",
  "soy sauce","coconut oil","asparagus","celery","eggplant","zucchini","mozzarella",
  "feta","cheddar","greek yogurt","cottage cheese","orange","cherry tomato","tuna",
];

function isKnownIngredient(name) {
  const lower = (name || "").toLowerCase().trim();
  return KNOWN_INGREDIENTS.some(k => lower.includes(k));
}

export default function AddRecipePage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const prefill   = location.state?.prefill || null;
  const [ingredients, setIngredients] = useState(
    prefill?.ingredients?.length > 0
      ? prefill.ingredients.map(i => ({ name: i.name || '', quantity: String(i.quantity || ''), unit: i.unit || '', showManual: false, manualCalories: '', manualProtein: '', manualCarbs: '', manualFat: '' }))
      : [{ name: '', quantity: '', unit: '' }]
  );
  const [steps,       setSteps]       = useState([{ instruction: '' }]);
  const [imageFile,   setImageFile]   = useState(null);
  const [imagePreview,setImagePreview]= useState(null);
  const [submitting,  setSubmitting]  = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      difficulty:  'EASY',
      title:       prefill?.title       || '',
      description: prefill?.description || '',
    },
  });

  // ── Ingredient helpers ───────────────────────────────────────
  const addIngredient = () =>
    setIngredients(prev => [...prev, { name: '', quantity: '', unit: '' }]);

  const removeIngredient = (i) =>
    setIngredients(prev => prev.filter((_, idx) => idx !== i));

  const updateIngredient = (i, field, value) =>
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing));

  // ── Step helpers ─────────────────────────────────────────────
  const addStep = () =>
    setSteps(prev => [...prev, { instruction: '' }]);

  const removeStep = (i) =>
    setSteps(prev => prev.filter((_, idx) => idx !== i));

  const updateStep = (i, value) =>
    setSteps(prev => prev.map((s, idx) => idx === i ? { instruction: value } : s));

  // ── Image handler ────────────────────────────────────────────
  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // ── Submit ───────────────────────────────────────────────────
  const onSubmit = async (formData) => {
    // Validate ingredients
    const validIngredients = ingredients.filter(i => i.name.trim());
    if (validIngredients.length === 0) {
      toast.error('Add at least one ingredient');
      return;
    }

    // Validate steps
    const validSteps = steps.filter(s => s.instruction.trim());
    if (validSteps.length === 0) {
      toast.error('Add at least one step');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title',       formData.title);
      fd.append('description', formData.description);
      if (formData.cuisine)    fd.append('cuisine',    formData.cuisine);
      if (formData.cookTime)   fd.append('cookTime',   formData.cookTime);
      if (formData.prepTime)   fd.append('prepTime',   formData.prepTime);
      fd.append('difficulty',  formData.difficulty);

      // Tags — split comma-separated string into array
      const tagsArray = formData.tags
        ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];
      fd.append('tags', JSON.stringify(tagsArray));

      fd.append('ingredients', JSON.stringify(
        validIngredients.map(i => ({
          name:     i.name.trim(),
          quantity: parseFloat(i.quantity) || 1,
          unit:     i.unit.trim() || 'piece',
        }))
      ));

      fd.append('steps', JSON.stringify(
        validSteps.map((s, idx) => ({
          stepNumber:  idx + 1,
          instruction: s.instruction.trim(),
        }))
      ));

      if (imageFile) fd.append('image', imageFile);

      const { data } = await api.post('/recipes', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Recipe created!');
      navigate(`/recipes/${data.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto anim-up">
      <div className="mb-6">
        {prefill && (
          <div className="flex items-center gap-2 text-sm text-gold mb-3 bg-[rgba(212,168,67,0.08)]
                          border border-gold/20 rounded-xl px-4 py-2.5">
            <span>🧪</span>
            <span>Converting your community recipe draft — we've pre-filled what we could</span>
          </div>
        )}
        <h1 className="font-serif text-[32px] font-light text-cream">
          Share a <em className="text-gold not-italic italic">Recipe</em>
        </h1>
        <p className="text-sm text-muted mt-1">Share your recipe with the NutriHub community</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">

        {/* Image upload */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.5px]
                            text-muted mb-2">
            Recipe Photo
          </label>
          <div
            onClick={() => document.getElementById('img-input').click()}
            className="w-full h-44 rounded-2xl border-2 border-dashed
                       border-[rgba(74,124,89,0.3)] bg-forest2
                       flex items-center justify-center cursor-pointer
                       hover:border-sage transition-colors duration-200 overflow-hidden relative"
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Preview"
                   className="w-full h-full object-cover"/>
            ) : (
              <div className="text-center">
                <p className="text-3xl mb-2 opacity-30">📷</p>
                <p className="text-sm text-muted">Click to upload a photo</p>
                <p className="text-[11px] text-muted mt-1">Max 5MB · JPG, PNG, WEBP</p>
              </div>
            )}
          </div>
          <input id="img-input" type="file" accept="image/*"
                 onChange={handleImage} className="hidden"/>
        </div>

        {/* Basic info */}
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5
                        flex flex-col gap-4">
          <h2 className="text-[13px] font-semibold text-gold uppercase tracking-wide">
            Basic Info
          </h2>
          <Input label="Title" placeholder="e.g. Harissa Roasted Chickpea Bowl"
                 error={errors.title?.message} {...register('title')}/>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
              Description
            </label>
            <textarea
              placeholder="Describe your recipe — what makes it special?"
              rows={3}
              className="w-full bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                         px-3.5 py-2.5 text-cream text-sm placeholder:text-muted
                         outline-none focus:border-sage transition-colors duration-200 resize-y"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-red-400 text-xs">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
                Cuisine
              </label>
              <select
                {...register('cuisine')}
                className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                           px-3.5 py-2.5 text-cream text-sm outline-none
                           focus:border-sage transition-colors duration-200"
              >
                <option value="">Select cuisine</option>
                {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
                Difficulty
              </label>
              <select
                {...register('difficulty')}
                className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                           px-3.5 py-2.5 text-cream text-sm outline-none
                           focus:border-sage transition-colors duration-200"
              >
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Prep Time (min)" type="number" placeholder="15"
                   {...register('prepTime')}/>
            <Input label="Cook Time (min)" type="number" placeholder="30"
                   {...register('cookTime')}/>
          </div>

          <Input label="Tags (comma separated)"
                 placeholder="e.g. vegan, high-protein, quick"
                 {...register('tags')}/>
        </div>

        {/* Ingredients */}
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-gold uppercase tracking-wide">
              Ingredients
            </h2>
            <button type="button" onClick={addIngredient}
                    className="text-xs text-sage-l hover:text-cream flex items-center gap-1
                               transition-colors duration-200">
              <PlusIcon /> Add
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {ingredients.map((ing, i) => {
              const known    = isKnownIngredient(ing.name);
              const showHint = ing.name.trim().length > 2 && !known;
              return (
                <div key={i} className="flex flex-col gap-1.5">
                  {/* Main ingredient row */}
                  <div className="flex gap-2 items-start">
                    <input
                      value={ing.name}
                      onChange={e => updateIngredient(i, 'name', e.target.value)}
                      placeholder="Ingredient name"
                      className="flex-1 bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                 px-3 py-2 text-cream text-sm placeholder:text-muted outline-none
                                 focus:border-sage transition-colors duration-200"
                    />
                    <input
                      value={ing.quantity}
                      onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                      placeholder="Qty"
                      type="number"
                      className="w-16 bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                 px-3 py-2 text-cream text-sm placeholder:text-muted outline-none
                                 focus:border-sage transition-colors duration-200"
                    />
                    <input
                      value={ing.unit}
                      onChange={e => updateIngredient(i, 'unit', e.target.value)}
                      placeholder="Unit"
                      className="w-20 bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                 px-3 py-2 text-cream text-sm placeholder:text-muted outline-none
                                 focus:border-sage transition-colors duration-200"
                    />
                    {ingredients.length > 1 && (
                      <button type="button" onClick={() => removeIngredient(i)}
                              className="text-muted hover:text-red-400 transition-colors pt-2">
                        <RemoveIcon />
                      </button>
                    )}
                  </div>

                  {/* Manual nutrition prompt — only for unrecognised ingredients */}
                  {showHint && (
                    <div className="ml-1">
                      {!ing.showManual ? (
                        <button
                          type="button"
                          onClick={() => updateIngredient(i, 'showManual', true)}
                          className="text-[11px] text-gold/70 hover:text-gold transition-colors
                                     flex items-center gap-1.5"
                        >
                          <span className="text-[10px]">⚠</span>
                          "{ing.name}" not in our database — add nutrition manually (optional)
                        </button>
                      ) : (
                        <div className="bg-[rgba(212,168,67,0.06)] border border-gold/20
                                        rounded-xl p-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-gold uppercase tracking-wide">
                              Manual nutrition per 100g — author estimate
                            </p>
                            <button type="button"
                                    onClick={() => updateIngredient(i, 'showManual', false)}
                                    className="text-muted hover:text-cream text-sm">×</button>
                          </div>
                          <p className="text-[10px] text-muted leading-relaxed">
                            These values will only apply to this recipe and are labelled as author
                            estimates. They are never shared with other recipes.
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              ['manualCalories', 'Calories', 'kcal'],
                              ['manualProtein',  'Protein',  'g'],
                              ['manualCarbs',    'Carbs',    'g'],
                              ['manualFat',      'Fat',      'g'],
                            ].map(([field, label, unit]) => (
                              <div key={field} className="flex flex-col gap-1">
                                <label className="text-[10px] text-muted">{label} ({unit})</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={ing[field]}
                                  onChange={e => updateIngredient(i, field, e.target.value)}
                                  placeholder="0"
                                  className="w-full bg-forest border border-gold/20 rounded-lg
                                             px-2 py-1.5 text-cream text-sm placeholder:text-muted
                                             outline-none focus:border-gold/50 transition-colors"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Steps */}
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-gold uppercase tracking-wide">
              Method
            </h2>
            <button type="button" onClick={addStep}
                    className="text-xs text-sage-l hover:text-cream flex items-center gap-1
                               transition-colors duration-200">
              <PlusIcon /> Add step
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="w-7 h-7 rounded-full bg-[rgba(74,124,89,0.18)]
                                 border border-[rgba(74,124,89,0.25)]
                                 flex items-center justify-center flex-shrink-0
                                 text-[12px] font-semibold text-gold mt-2">
                  {i + 1}
                </span>
                <textarea
                  value={step.instruction}
                  onChange={e => updateStep(i, e.target.value)}
                  placeholder={`Step ${i + 1}...`}
                  rows={2}
                  className="flex-1 bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                             px-3 py-2 text-cream text-sm placeholder:text-muted outline-none
                             focus:border-sage transition-colors duration-200 resize-none"
                />
                {steps.length > 1 && (
                  <button type="button" onClick={() => removeStep(i)}
                          className="text-muted hover:text-red-400 transition-colors pt-2">
                    <RemoveIcon />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pb-8">
          <Button type="submit" loading={submitting} size="lg">
            Publish Recipe
          </Button>
          <Button type="button" variant="secondary" size="lg"
                  onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

const PlusIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const RemoveIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;