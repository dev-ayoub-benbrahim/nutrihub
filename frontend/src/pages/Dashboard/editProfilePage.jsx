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
import ConfirmModal from '../../components/ConfirmModal';

const schema = z.object({
  name:           z.string().min(2, 'Name must be at least 2 characters'),
  bio:            z.string().max(200).optional().or(z.literal('')),
  calorieTarget:  z.string().optional(),
  goal:           z.string().optional(),
  specialisation: z.string().max(100).optional().or(z.literal('')),
});

const GOALS = [
  { value: 'LOSE_WEIGHT',   label: 'Lose Weight',    emoji: '🔥', desc: 'Calorie deficit' },
  { value: 'MAINTAIN',      label: 'Maintain Weight',emoji: '⚖️', desc: 'Steady balance' },
  { value: 'BUILD_MUSCLE',  label: 'Build Muscle',   emoji: '💪', desc: 'Calorie surplus' },
  { value: 'EAT_HEALTHIER', label: 'Eat Healthier',  emoji: '🥗', desc: 'Clean eating'   },
  { value: 'HIGH_ENERGY',   label: 'High Energy',    emoji: '⚡', desc: 'High carb fuel'  },
];

export default function EditProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [avatarFile,      setAvatarFile]      = useState(null);
  const [avatarPreview,   setAvatarPreview]   = useState(user?.avatarURL || null);
  const [submitting,      setSubmitting]      = useState(false);
  const [showExpertModal, setShowExpertModal] = useState(false);
  const [deletingAccount,  setDeletingAccount]  = useState(false);
  const [showDeleteModal,  setShowDeleteModal]  = useState(false);
  const [showPassForm,     setShowPassForm]     = useState(false);
  const [showEmailForm,    setShowEmailForm]    = useState(false);
  const [passData,         setPassData]         = useState({ current: '', newPass: '', confirm: '' });
  const [emailData,        setEmailData]        = useState({ newEmail: '', password: '' });
  const [savingPass,       setSavingPass]       = useState(false);
  const [savingEmail,      setSavingEmail]      = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passData.newPass !== passData.confirm) { toast.error('Passwords do not match'); return; }
    if (passData.newPass.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSavingPass(true);
    try {
      await api.put('/auth/password', {
        currentPassword: passData.current,
        newPassword:     passData.newPass,
      });
      toast.success('Password updated');
      setPassData({ current: '', newPass: '', confirm: '' });
      setShowPassForm(false);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSavingPass(false); }
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      await api.put('/auth/email', {
        newEmail: emailData.newEmail,
        password: emailData.password,
      });
      updateUser({ email: emailData.newEmail });
      toast.success('Email updated');
      setEmailData({ newEmail: '', password: '' });
      setShowEmailForm(false);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSavingEmail(false); }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api.delete('/auth/me');
      logout();
      navigate('/login');
      toast.success('Account deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeletingAccount(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto anim-up">

      {/* Header */}
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted mb-4">
            Profile Photo
          </p>
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
              <button type="button"
                      onClick={() => document.getElementById('avatar-input').click()}
                      className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-sage border-2
                                 border-forest2 flex items-center justify-center hover:bg-sage-l transition-colors">
                <CameraIcon/>
              </button>
            </div>
            <div>
              <p className="text-sm text-cream mb-1">Upload a new photo</p>
              <p className="text-[12px] text-muted mb-2">JPG, PNG or WEBP · Max 3MB</p>
              <button type="button"
                      onClick={() => document.getElementById('avatar-input').click()}
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
          <Input label="Name" placeholder="Your name"
                 error={errors.name?.message} {...register('name')}/>
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

        {/* Nutrition goal */}
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-gold mb-3">Health Goal</p>
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map(g => {
              const current = watch('goal');
              return (
                <button key={g.value} type="button"
                        onClick={() => setValue('goal', g.value)}
                        className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left transition-all
                                    ${current === g.value
                                      ? 'border-sage/50 bg-[rgba(74,124,89,0.14)] text-cream'
                                      : 'border-[rgba(74,124,89,0.15)] text-muted hover:border-sage/30 hover:text-cream'}`}>
                  <span className="text-xl flex-shrink-0">{g.emoji}</span>
                  <div>
                    <p className="text-[13px] font-medium leading-tight">{g.label}</p>
                    <p className="text-[10px] text-muted leading-tight">{g.desc}</p>
                  </div>
                  {current === g.value && <span className="ml-auto text-sage text-sm">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Expert verification */}
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
              <button type="button" onClick={() => setShowExpertModal(true)}
                      className="text-xs text-gold border border-gold/30 hover:border-gold/60
                                 px-3 py-2 rounded-lg transition-all flex-shrink-0 whitespace-nowrap">
                Apply Now
              </button>
            </div>
          </div>
        )}

        {/* Save / Cancel */}
        <div className="flex gap-3">
          <Button type="submit" loading={submitting} size="lg" fullWidth>Save changes</Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => navigate('/profile')}>
            Cancel
          </Button>
        </div>

      </form>

      {/* Account Settings — outside main form */}
      <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl overflow-hidden mt-5">
          <div className="px-5 py-3 border-b border-[rgba(74,124,89,0.12)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-gold">Account Settings</p>
          </div>

          {/* Change Password */}
          <div className="px-5 py-4 border-b border-[rgba(74,124,89,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-cream">Password</p>
                <p className="text-[11px] text-muted mt-0.5">Change your login password</p>
              </div>
              <button type="button" onClick={() => { setShowPassForm(s => !s); setShowEmailForm(false); }}
                      className="text-[12px] text-sage-l hover:text-cream border border-[rgba(74,124,89,0.25)]
                                 hover:border-sage px-3 py-1.5 rounded-lg transition-all">
                {showPassForm ? 'Cancel' : 'Change'}
              </button>
            </div>
            {showPassForm && (
              <form onSubmit={handleChangePassword} className="mt-4 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-muted uppercase tracking-wide font-semibold">Current Password</label>
                  <input type="password" value={passData.current}
                         onChange={e => setPassData(p => ({ ...p, current: e.target.value }))}
                         placeholder="Enter current password"
                         className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                    px-3.5 py-2.5 text-cream text-sm placeholder:text-muted
                                    outline-none focus:border-sage transition-colors"/>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-muted uppercase tracking-wide font-semibold">New Password</label>
                  <input type="password" value={passData.newPass}
                         onChange={e => setPassData(p => ({ ...p, newPass: e.target.value }))}
                         placeholder="At least 6 characters"
                         className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                    px-3.5 py-2.5 text-cream text-sm placeholder:text-muted
                                    outline-none focus:border-sage transition-colors"/>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-muted uppercase tracking-wide font-semibold">Confirm New Password</label>
                  <input type="password" value={passData.confirm}
                         onChange={e => setPassData(p => ({ ...p, confirm: e.target.value }))}
                         placeholder="Repeat new password"
                         className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                    px-3.5 py-2.5 text-cream text-sm placeholder:text-muted
                                    outline-none focus:border-sage transition-colors"/>
                </div>
                <button type="submit" disabled={savingPass || !passData.current || !passData.newPass || !passData.confirm}
                        className="text-sm font-medium text-cream bg-sage hover:bg-sage-l px-4 py-2.5
                                   rounded-xl transition-all disabled:opacity-40 w-fit">
                  {savingPass ? 'Saving…' : 'Update Password'}
                </button>
              </form>
            )}
          </div>

          {/* Change Email */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-cream">Email</p>
                <p className="text-[11px] text-muted mt-0.5">{user?.email}</p>
              </div>
              <button type="button" onClick={() => { setShowEmailForm(s => !s); setShowPassForm(false); }}
                      className="text-[12px] text-sage-l hover:text-cream border border-[rgba(74,124,89,0.25)]
                                 hover:border-sage px-3 py-1.5 rounded-lg transition-all">
                {showEmailForm ? 'Cancel' : 'Change'}
              </button>
            </div>
            {showEmailForm && (
              <form onSubmit={handleChangeEmail} className="mt-4 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-muted uppercase tracking-wide font-semibold">New Email Address</label>
                  <input type="email" value={emailData.newEmail}
                         onChange={e => setEmailData(p => ({ ...p, newEmail: e.target.value }))}
                         placeholder="new@email.com"
                         className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                    px-3.5 py-2.5 text-cream text-sm placeholder:text-muted
                                    outline-none focus:border-sage transition-colors"/>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-muted uppercase tracking-wide font-semibold">Confirm with Password</label>
                  <input type="password" value={emailData.password}
                         onChange={e => setEmailData(p => ({ ...p, password: e.target.value }))}
                         placeholder="Enter your current password"
                         className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                    px-3.5 py-2.5 text-cream text-sm placeholder:text-muted
                                    outline-none focus:border-sage transition-colors"/>
                </div>
                <button type="submit" disabled={savingEmail || !emailData.newEmail || !emailData.password}
                        className="text-sm font-medium text-cream bg-sage hover:bg-sage-l px-4 py-2.5
                                   rounded-xl transition-all disabled:opacity-40 w-fit">
                  {savingEmail ? 'Saving…' : 'Update Email'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Danger zone */}
        <div className="border border-red-500/20 rounded-2xl p-5 mb-8 mt-6">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-red-400 mb-1">
            Danger Zone
          </p>
          <p className="text-[13px] text-muted mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button type="button" onClick={() => setShowDeleteModal(true)}
                  className="text-[13px] text-red-400 hover:text-red-300 border border-red-500/30
                             hover:border-red-400/50 px-4 py-2 rounded-xl transition-all disabled:opacity-50">
            Delete my account permanently
          </button>
        </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="Delete your account"
        message="This will permanently delete all your recipes, meal plans, followers, and activity. This action cannot be undone."
        confirmLabel="Delete account"
        danger
        requireType="DELETE"
      />

      {/* ExpertVerificationModal — outside form, inside root div */}
      <ExpertVerificationModal
        isOpen={showExpertModal}
        onClose={() => setShowExpertModal(false)}
      />

    </div>
  );
}

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const CameraIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
       stroke="white" strokeWidth="2" strokeLinecap="round">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);