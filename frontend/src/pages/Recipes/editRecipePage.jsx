import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../utils/axios';
import { getErrorMessage } from '../../utils/helpers';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';

const schema = z.object({
  title:       z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  cuisine:     z.string().optional(),
  cookTime:    z.string().optional(),
  prepTime:    z.string().optional(),
  difficulty:  z.enum(['EASY', 'MEDIUM', 'HARD']),
});

const CUISINES     = ['Italian','Japanese','Mediterranean','Mexican','Indian','Caribbean','Moroccan','American','French','Chinese','Thai','Middle Eastern'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const UNITS = ['g','kg','ml','l','tsp','tbsp','cup','oz','lb','piece','slice','clove','pinch'];

const emptyIng = () => ({ name: '', quantity: '', unit: 'g', showManual: false, manualCalories: '', manualProtein: '', manualCarbs: '', manualFat: '' });

export default function EditRecipePage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [imageFile,    setImageFile]    = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [ingredients,  setIngredients]  = useState([emptyIng()]);
  const [steps,        setSteps]        = useState([{ instruction: '' }]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/recipes/${id}`);
        if (data.userId !== user?.id) {
          toast.error('You can only edit your own recipes');
          navigate('/explore');
          return;
        }
        reset({
          title:       data.title       || '',
          description: data.description || '',
          cuisine:     data.cuisine     || '',
          cookTime:    data.cookTime    ? String(data.cookTime) : '',
          prepTime:    data.prepTime    ? String(data.prepTime) : '',
          difficulty:  data.difficulty  || 'EASY',
        });
        if (data.imageURL) setImagePreview(data.imageURL);
        if (data.ingredients?.length > 0) {
          setIngredients(data.ingredients.map(ri => ({
            name:           ri.ingredient?.name || '',
            quantity:       String(ri.quantity || ''),
            unit:           ri.unit || 'g',
            showManual:     ri.manualCalories != null,
            manualCalories: ri.manualCalories != null ? String(ri.manualCalories) : '',
            manualProtein:  ri.manualProtein  != null ? String(ri.manualProtein)  : '',
            manualCarbs:    ri.manualCarbs    != null ? String(ri.manualCarbs)    : '',
            manualFat:      ri.manualFat      != null ? String(ri.manualFat)      : '',
          })));
        }
        if (data.steps?.length > 0) {
          setSteps(data.steps.map(s => ({ instruction: s.instruction || '' })));
        }
      } catch (err) {
        toast.error(getErrorMessage(err));
        navigate('/explore');
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [id, user, reset, navigate]);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const updateIng   = (i, field, val) => setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing));
  const addIng      = () => setIngredients(prev => [...prev, emptyIng()]);
  const removeIng   = (i) => setIngredients(prev => prev.filter((_, idx) => idx !== i));
  const updateStep  = (i, val) => setSteps(prev => prev.map((s, idx) => idx === i ? { instruction: val } : s));
  const addStep     = () => setSteps(prev => [...prev, { instruction: '' }]);
  const removeStep  = (i) => setSteps(prev => prev.filter((_, idx) => idx !== i));

  const onSubmit = async (formData) => {
    const validIngredients = ingredients.filter(i => i.name.trim());
    if (validIngredients.length === 0) { toast.error('Add at least one ingredient'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title',       formData.title);
      fd.append('description', formData.description);
      if (formData.cuisine)  fd.append('cuisine',  formData.cuisine);
      if (formData.cookTime) fd.append('cookTime', formData.cookTime);
      if (formData.prepTime) fd.append('prepTime', formData.prepTime);
      fd.append('difficulty', formData.difficulty);
      if (imageFile) fd.append('image', imageFile);

      fd.append('ingredients', JSON.stringify(
        validIngredients.map(i => ({
          name:     i.name.trim(),
          quantity: parseFloat(i.quantity) || 1,
          unit:     i.unit || 'g',
          ...(i.manualCalories !== '' && i.manualCalories != null && { manualCalories: parseFloat(i.manualCalories) }),
          ...(i.manualProtein  !== '' && i.manualProtein  != null && { manualProtein:  parseFloat(i.manualProtein)  }),
          ...(i.manualCarbs    !== '' && i.manualCarbs    != null && { manualCarbs:    parseFloat(i.manualCarbs)    }),
          ...(i.manualFat      !== '' && i.manualFat      != null && { manualFat:      parseFloat(i.manualFat)      }),
        }))
      ));

      const validSteps = steps.filter(s => s.instruction.trim());
      if (validSteps.length > 0) {
        fd.append('steps', JSON.stringify(validSteps.map((s, idx) => ({ stepNumber: idx + 1, instruction: s.instruction.trim() }))));
      }

      await api.put(`/recipes/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Recipe updated!');
      navigate('/explore');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-forest2 rounded w-1/3"/>
      <div className="h-44 bg-forest2 rounded-2xl"/>
      <div className="h-64 bg-forest2 rounded-2xl"/>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto anim-up pb-12">
      <div className="mb-6">
        <button onClick={() => navigate('/explore')}
                className="flex items-center gap-2 text-muted hover:text-cream text-sm mb-4 transition-colors">
          <BackIcon /> Explore
        </button>
        <h1 className="font-serif text-[32px] font-light text-cream">
          Edit <em className="text-gold not-italic italic">Recipe</em>
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

        {/* Image */}
        <div onClick={() => document.getElementById('edit-img').click()}
             className="w-full h-44 rounded-2xl border-2 border-dashed border-[rgba(74,124,89,0.3)]
                        bg-forest2 flex items-center justify-center cursor-pointer
                        hover:border-sage transition-colors overflow-hidden">
          {imagePreview
            ? <img src={imagePreview} alt="Preview" className="w-full h-full object-cover"/>
            : <div className="text-center"><p className="text-3xl mb-2 opacity-30">📷</p><p className="text-sm text-muted">Click to change photo</p></div>
          }
        </div>
        <input id="edit-img" type="file" accept="image/*" onChange={handleImage} className="hidden"/>

        {/* Basic info */}
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5 flex flex-col gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Recipe Info</p>
          <Input label="Title" placeholder="Recipe title" error={errors.title?.message} {...register('title')}/>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Description</label>
            <textarea rows={3} placeholder="Describe your recipe..."
                      className="w-full bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                 px-3.5 py-2.5 text-cream text-sm placeholder:text-muted
                                 outline-none focus:border-sage transition-colors resize-y"
                      {...register('description')}/>
            {errors.description && <p className="text-red-400 text-xs">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Cuisine</label>
              <select {...register('cuisine')}
                      className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                 px-3.5 py-2.5 text-cream text-sm outline-none focus:border-sage transition-colors">
                <option value="">Select cuisine</option>
                {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Difficulty</label>
              <select {...register('difficulty')}
                      className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                 px-3.5 py-2.5 text-cream text-sm outline-none focus:border-sage transition-colors">
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prep Time (min)" type="number" placeholder="15" {...register('prepTime')}/>
            <Input label="Cook Time (min)" type="number" placeholder="30" {...register('cookTime')}/>
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ingredients</p>
            <button type="button" onClick={addIng}
                    className="text-[11px] text-sage-l hover:text-cream border border-[rgba(74,124,89,0.25)]
                               hover:border-sage px-3 py-1 rounded-lg transition-all flex items-center gap-1">
              + Add ingredient
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {ingredients.map((ing, i) => (
              <div key={i} className="bg-forest rounded-xl p-3">
                <div className="flex gap-2 mb-2">
                  <input value={ing.name} onChange={e => updateIng(i, 'name', e.target.value)}
                         placeholder="Ingredient name"
                         className="flex-1 bg-forest2 border border-[rgba(74,124,89,0.2)] rounded-[10px]
                                    px-3 py-2 text-cream text-sm placeholder:text-muted outline-none focus:border-sage transition-colors"/>
                  <input type="number" value={ing.quantity} onChange={e => updateIng(i, 'quantity', e.target.value)}
                         placeholder="Qty"
                         className="w-20 bg-forest2 border border-[rgba(74,124,89,0.2)] rounded-[10px]
                                    px-3 py-2 text-cream text-sm placeholder:text-muted outline-none focus:border-sage transition-colors"/>
                  <select value={ing.unit} onChange={e => updateIng(i, 'unit', e.target.value)}
                          className="w-24 bg-forest2 border border-[rgba(74,124,89,0.2)] rounded-[10px]
                                     px-2 py-2 text-cream text-sm outline-none focus:border-sage transition-colors cursor-pointer">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {ingredients.length > 1 && (
                    <button type="button" onClick={() => removeIng(i)}
                            className="text-muted hover:text-red-400 transition-colors px-1 text-lg">×</button>
                  )}
                </div>
                <button type="button" onClick={() => updateIng(i, 'showManual', !ing.showManual)}
                        className="text-[10px] text-muted hover:text-gold transition-colors">
                  {ing.showManual ? '▾ Hide nutrition' : '▸ Add nutrition manually (if not in USDA database)'}
                </button>
                {ing.showManual && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {[['manualCalories','kcal/100g'],['manualProtein','protein g'],['manualCarbs','carbs g'],['manualFat','fat g']].map(([field, ph]) => (
                      <div key={field}>
                        <input type="number" value={ing[field]} onChange={e => updateIng(i, field, e.target.value)}
                               placeholder={ph}
                               className="w-full bg-forest2 border border-[rgba(212,168,67,0.2)] rounded-[8px]
                                          px-2 py-1.5 text-cream text-[12px] placeholder:text-muted/60
                                          outline-none focus:border-gold/50 transition-colors"/>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Steps</p>
            <button type="button" onClick={addStep}
                    className="text-[11px] text-sage-l hover:text-cream border border-[rgba(74,124,89,0.25)]
                               hover:border-sage px-3 py-1 rounded-lg transition-all">
              + Add step
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-forest3 border border-[rgba(74,124,89,0.3)]
                                 flex items-center justify-center text-[11px] text-muted flex-shrink-0 mt-2">
                  {i + 1}
                </span>
                <textarea value={step.instruction} onChange={e => updateStep(i, e.target.value)}
                          placeholder={`Step ${i + 1}...`} rows={2}
                          className="flex-1 bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                     px-3.5 py-2.5 text-cream text-sm placeholder:text-muted
                                     outline-none focus:border-sage transition-colors resize-y"/>
                {steps.length > 1 && (
                  <button type="button" onClick={() => removeStep(i)}
                          className="text-muted hover:text-red-400 transition-colors px-1 text-lg mt-2">×</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" loading={submitting} size="lg">Save changes</Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => navigate('/explore')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);