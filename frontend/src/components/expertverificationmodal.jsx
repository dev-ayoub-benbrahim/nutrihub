import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../utils/axios';
import Button from './ui/Button';
import Input from './ui/Input';
import { getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';

const schema = z.object({
  profession:     z.string().min(3,  'Profession is required'),
  experience:     z.string().min(5,  'Please describe your experience'),
  qualifications: z.string().min(10, 'Please describe your qualifications'),
  linkedin:       z.string().url('Enter a valid URL').optional().or(z.literal('')),
});

const PROFESSIONS = [
  'Registered Dietitian / Nutritionist',
  'Chef / Culinary Professional',
  'Personal Trainer / Fitness Coach',
  'Food Scientist',
  'Sports Nutritionist',
  'Health Coach',
  'Medical Professional',
  'Food Blogger / Influencer',
  'Other Food Professional',
];

export default function ExpertVerificationModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1);

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm({
    resolver: zodResolver(schema),
  });

  if (!isOpen) return null;

  const onSubmit = async (data) => {
    try {
      await api.post('/reports/expert-requests', {
        profession:     data.profession,
        experience:     data.experience,
        qualifications: data.qualifications,
        linkedin:       data.linkedin || undefined,
      });
      toast.success('Application submitted! We\'ll review it within 48 hours.');
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
      <div className="relative bg-forest2 border border-[rgba(74,124,89,0.25)]
                      rounded-2xl w-full max-w-lg z-10 overflow-hidden max-h-[90vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[rgba(74,124,89,0.18)]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gold text-lg">✓</span>
              <h2 className="font-serif text-xl font-light text-cream">Apply for Expert Status</h2>
            </div>
            <p className="text-[12px] text-muted">
              Verified experts receive a gold badge and increased credibility across the platform
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-cream transition-colors text-2xl leading-none ml-4">×</button>
        </div>

        {/* Benefits banner */}
        <div className="px-6 py-3 bg-[rgba(212,168,67,0.07)] border-b border-[rgba(212,168,67,0.15)]">
          <div className="flex items-center gap-6">
            {[
              ['✓ Gold badge',         'on all your posts'],
              ['✓ Expert label',       'in discussions'],
              ['✓ Increased trust',    'from community'],
            ].map(([title, sub]) => (
              <div key={title} className="text-center">
                <p className="text-[12px] font-semibold text-gold">{title}</p>
                <p className="text-[10px] text-muted">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 flex flex-col gap-4 overflow-y-auto">

          {/* Profession dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
              Your Profession *
            </label>
            <select {...register('profession')}
                    className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                               px-3.5 py-2.5 text-cream text-sm outline-none
                               focus:border-sage transition-colors">
              <option value="">Select your profession</option>
              {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {errors.profession && <p className="text-red-400 text-xs">{errors.profession.message}</p>}
          </div>

          {/* Experience */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
              Years of Experience & Background *
            </label>
            <textarea
              placeholder="e.g. 5 years as a Registered Dietitian working with athletes, specialising in sports performance nutrition..."
              rows={2}
              className="w-full bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                         px-3.5 py-2.5 text-cream text-sm placeholder:text-muted
                         outline-none focus:border-sage transition-colors resize-none"
              {...register('experience')}
            />
            {errors.experience && <p className="text-red-400 text-xs">{errors.experience.message}</p>}
          </div>

          {/* Qualifications */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
              Qualifications & Certifications *
            </label>
            <textarea
              placeholder="e.g. BSc Nutrition (University of Nottingham), Registered with the Association for Nutrition, CSSD certified..."
              rows={2}
              className="w-full bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                         px-3.5 py-2.5 text-cream text-sm placeholder:text-muted
                         outline-none focus:border-sage transition-colors resize-none"
              {...register('qualifications')}
            />
            {errors.qualifications && <p className="text-red-400 text-xs">{errors.qualifications.message}</p>}
          </div>

          {/* LinkedIn */}
          <Input
            label="LinkedIn Profile or Website (optional)"
            placeholder="https://linkedin.com/in/your-profile"
            error={errors.linkedin?.message}
            {...register('linkedin')}
          />

          {/* Disclaimer */}
          <p className="text-[11px] text-muted leading-relaxed bg-forest/50 rounded-xl px-3 py-2.5">
            By submitting, you confirm that the information provided is accurate.
            False applications will result in account restrictions.
            Applications are typically reviewed within 48 hours.
          </p>

          <div className="flex gap-2">
            <Button type="submit" loading={isSubmitting} fullWidth>Submit Application</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}