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

const CUISINES    = ['Italian','Japanese','Mediterranean','Mexican','Indian','Caribbean','Moroccan','American','French','Chinese','Thai','Middle Eastern'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

export default function EditRecipePage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuth();

  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [imageFile,    setImageFile]    = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  // Load existing recipe data into the form
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/recipes/${id}`);

        // Redirect if not the owner
        if (data.userId !== user?.id) {
          toast.error('You can only edit your own recipes');
          navigate(`/recipes/${id}`);
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
      } catch (err) {
        toast.error(getErrorMessage(err));
        navigate('/');
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

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title',       formData.title);
      fd.append('description', formData.description);
      if (formData.cuisine)  fd.append('cuisine',   formData.cuisine);
      if (formData.cookTime) fd.append('cookTime',  formData.cookTime);
      if (formData.prepTime) fd.append('prepTime',  formData.prepTime);
      fd.append('difficulty', formData.difficulty);
      if (imageFile) fd.append('image', imageFile);

      await api.put(`/recipes/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Recipe updated!');
      navigate(`/recipes/${id}`);
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
    <div className="max-w-2xl mx-auto anim-up">
      <div className="mb-6">
        <button onClick={() => navigate(`/recipes/${id}`)}
                className="flex items-center gap-2 text-muted hover:text-cream text-sm mb-4 transition-colors">
          <BackIcon /> Back to recipe
        </button>
        <h1 className="font-serif text-[32px] font-light text-cream">
          Edit <em className="text-gold not-italic italic">Recipe</em>
        </h1>
        <p className="text-sm text-muted mt-1">
          Note: ingredients and steps editing coming soon — update the rest for now
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

        {/* Image */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.5px] text-muted mb-2">
            Recipe Photo
          </label>
          <div onClick={() => document.getElementById('edit-img').click()}
               className="w-full h-44 rounded-2xl border-2 border-dashed
                          border-[rgba(74,124,89,0.3)] bg-forest2
                          flex items-center justify-center cursor-pointer
                          hover:border-sage transition-colors duration-200 overflow-hidden">
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover"/>
            ) : (
              <div className="text-center">
                <p className="text-3xl mb-2 opacity-30">📷</p>
                <p className="text-sm text-muted">Click to upload a new photo</p>
              </div>
            )}
          </div>
          <input id="edit-img" type="file" accept="image/*" onChange={handleImage} className="hidden"/>
        </div>

        {/* Fields */}
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5 flex flex-col gap-4">
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

        <div className="flex gap-3 pb-8">
          <Button type="submit" loading={submitting} size="lg">Save changes</Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => navigate(`/recipes/${id}`)}>
            Cancel
          </Button>
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