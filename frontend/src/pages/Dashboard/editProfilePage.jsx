import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../utils/axios';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage, getInitials } from '../../utils/helpers';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import ExpertVerificationModal from '../../components/ExpertVerificationModal';

const schema = z.object({
  name:           z.string().min(2, 'Name must be at least 2 characters'),
  bio:            z.string().max(200).optional().or(z.literal('')),
  calorieTarget:  z.string().optional(),
  goal:           z.string().optional(),
  specialisation: z.string().max(100).optional().or(z.literal('')),
});

const GOALS = [
  { value: 'LOSE_WEIGHT',   label: 'Lose weight'     },
  { value: 'MAINTAIN',      label: 'Maintain weight' },
  { value: 'BUILD_MUSCLE',  label: 'Build muscle'    },
  { value: 'EAT_HEALTHIER', label: 'Eat healthier'   },
];

export default function EditProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate             = useNavigate();

  const [avatarFile,    setAvatarFile]    = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarURL || null);
  const [submitting,    setSubmitting]    = useState(false);
  const [showExpertModal, setShowExpertModal] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name:           user?.name           || '',
      bio:            user?.bio            || '',
      calorieTarget:  user?.calorieTarget  ? String(user.calorieTarget) : '',
      goal:           user?.goal           || '',
      specialisation: user?.specialisation || '',
    },
  });

  const handleAvatar = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error('Avatar must be under 3MB'); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (formData) => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', formData.name);
      if (formData.bio)            fd.append('bio',            formData.bio);
      if (formData.calorieTarget)  fd.append('calorieTarget',  formData.calorieTarget);
      if (formData.goal)           fd.append('goal',           formData.goal);
      if (formData.specialisation) fd.append('specialisation', formData.specialisation);
      if (avatarFile)              fd.append('avatar',         avatarFile);

      const { data } = await api.put('/auth/me', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      updateUser(data);
      toast.success('Profile updated!');
      navigate('/profile');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="max-w-xl mx-auto anim-up">
        <div className="mb-6">
          <button onClick={() => navigate('/profile')}
                  className="flex items-center gap-2 text-muted hover:text-cream text-sm mb-4 transition-colors">
            <BackIcon/> Back to profile
          </button>
          <h1 className="font-serif text-[32px] font-light text-cream">
            Edit <em className="text-gold not-italic italic">Profile</em>
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

          {/* Avatar */}
          <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted mb-4">Profile Photo</p>
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-sage to-rust
                                flex items-center justify-center text-cream text-2xl font-bold
                                border-2 border-[rgba(74,124,89,0.35)]">
                  {avatarPreview
                    ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover"/>
                    : getInitials(user?.name)
                  }
                </div>
                <button type="button" onClick={() => document.getElementById('avatar-input').click()}
                        className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-sage border-2
                                   border-forest2 flex items-center justify-center hover:bg-sage-l transition-colors">
                  <CameraIcon/>
                </button>
              </div>
              <div>
                <p className="text-sm text-cream mb-1">Upload a new photo</p>
                <p className="text-[12px] text-muted mb-2">JPG, PNG or WEBP · Max 3MB</p>
                <button type="button" onClick={() => document.getElementById('avatar-input').click()}
                        className="text-xs text-sage-l hover:text-cream transition-colors border
                                   border-[rgba(74,124,89,0.25)] px-3 py-1.5 rounded-lg">
                  Choose file
                </button>
              </div>
            </div>
            <input id="avatar-input" type="file" accept="image/*" onChange={handleAvatar} className="hidden"/>
          </div>

          {/* Basic info */}
          <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5 flex flex-col gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-gold">Basic Info</p>
            <Input label="Name" placeholder="Your name" error={errors.name?.message} {...register('name')}/>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Bio</label>
              <textarea rows={3} placeholder="Tell the community about yourself..."
                        className="w-full bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                   px-3.5 py-2.5 text-cream text-sm placeholder:text-muted
                                   outline-none focus:border-sage transition-colors resize-none"
                        {...register('bio')}/>
              {errors.bio && <p className="text-red-400 text-xs">{errors.bio.message}</p>}
            </div>
            {(user?.role === 'EXPERT' || user?.role === 'ADMIN') && (
              <Input label="Specialisation" placeholder="e.g. Sports Nutrition"
                     {...register('specialisation')}/>
            )}
          </div>

          {/* Goals */}
          <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5 flex flex-col gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-gold">Nutrition Goals</p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Goal</label>
              <select {...register('goal')}
                      className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                 px-3.5 py-2.5 text-cream text-sm outline-none focus:border-sage transition-colors">
                <option value="">Select a goal</option>
                {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <Input label="Daily Calorie Target" type="number" placeholder="e.g. 1800"
                   {...register('calorieTarget')}/>
          </div>

          {/* Expert verification — proper modal */}
          {user?.role === 'USER' && (
            <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-gold uppercase tracking-wide mb-1">
                    ✓ Expert Verification
                  </p>
                  <p className="text-[13px] text-muted leading-relaxed max-w-sm">
                    Are you a nutritionist, chef, or food professional? Apply for Expert status
                    to get a verified badge and increased credibility on your posts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExpertModal(true)}
                  className="text-xs text-gold border border-gold/30 hover:border-gold/60
                             px-3 py-2 rounded-lg transition-all flex-shrink-0 whitespace-nowrap"
                >
                  Apply Now
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pb-8">
            <Button type="submit" loading={submitting} size="lg" fullWidth>Save changes</Button>
            <Button type="button" variant="secondary" size="lg" onClick={() => navigate('/profile')}>Cancel</Button>
          </div>
        </form>
      </div>
      <ExpertVerificationModal
        isOpen={showExpertModal}
        onClose={() => setShowExpertModal(false)}
      />
    </>
  );
}

const BackIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>;
const CameraIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>;

