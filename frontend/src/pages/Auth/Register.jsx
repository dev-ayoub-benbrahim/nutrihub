import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/helpers';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const schema = z.object({
  name:            z.string().min(2, 'Name must be at least 2 characters'),
  email:           z.string().email('Enter a valid email address'),
  password:        z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ name, email, password }) => {
    try {
      await registerUser(name, email, password);
      toast.success('Account created! Welcome to NutriHub 🎉');
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-forest flex">

      {/* Left — brand panel */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-10">
        <div className="max-w-[380px]">
          <div className="w-[72px] h-[72px] rounded-[18px]
                          bg-gradient-to-br from-sage to-gold
                          flex items-center justify-center
                          font-serif text-[36px] font-bold text-forest mb-5">
            N
          </div>
          <h1 className="font-serif text-[42px] font-light text-cream leading-none mb-3">
            Join the <span className="text-gold italic">community</span>
          </h1>
          <p className="text-[15px] text-muted leading-relaxed mb-8">
            Create your account and start discovering recipes, generating personalised meal plans,
            and connecting with food lovers.
          </p>
          <div className="bg-forest2 border border-[rgba(74,124,89,0.2)] rounded-2xl p-5">
            <p className="text-[12px] font-semibold text-gold uppercase tracking-wide mb-3">
              Free forever includes
            </p>
            {['Unlimited recipe browsing','AI meal plan generation','USDA nutritional validation','Community features'].map((f) => (
              <div key={f} className="flex items-center gap-2.5 py-1.5">
                <span className="text-sage text-sm">✓</span>
                <span className="text-[13px] text-cream">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="w-full lg:w-[480px] flex-shrink-0
                      bg-forest2 lg:border-l border-[rgba(74,124,89,0.18)]
                      flex items-center justify-center p-8">
        <div className="w-full max-w-[360px] anim-up">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-sage to-gold
                            flex items-center justify-center font-serif text-xl font-bold text-forest">
              N
            </div>
            <span className="font-serif text-xl text-cream">Nutri<span className="text-gold">Hub</span></span>
          </div>

          <h2 className="font-serif text-[28px] font-light text-cream mb-1.5">
            Create account
          </h2>
          <p className="text-[13px] text-muted mb-7">
            Join the NutriHub community it's free!
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label="Full name"
              placeholder="Ayoub Ben Brahim"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="At least 6 characters"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirm password"
              type="password"
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <Button
              type="submit"
              fullWidth
              loading={isSubmitting}
              size="lg"
              className="mt-1"
            >
              Create account
            </Button>
          </form>

          <p className="text-center text-[13px] text-muted mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-gold hover:text-gold-l transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}