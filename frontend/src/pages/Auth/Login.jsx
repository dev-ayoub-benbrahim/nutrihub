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
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function Login() {
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email, password }) => {
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-forest flex">

      {/* Left — brand panel */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-10 bg-forest">
        <BrandPanel />
      </div>

      {/* Right — form panel */}
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
            Welcome back
          </h2>
          <p className="text-[13px] text-muted mb-7">
            Sign in to your NutriHub account
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            <Button
              type="submit"
              fullWidth
              loading={isSubmitting}
              size="lg"
              className="mt-1"
            >
              Sign in
            </Button>
          </form>

          <p className="text-center text-[13px] text-muted mt-5">
            Don't have an account?{' '}
            <Link to="/register" className="text-gold hover:text-gold-l transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="max-w-[380px]">
      {/* Logo */}
      <div className="w-[72px] h-[72px] rounded-[18px]
                      bg-gradient-to-br from-sage to-gold
                      flex items-center justify-center
                      font-serif text-[36px] font-bold text-forest mb-5">
        N
      </div>
      <h1 className="font-serif text-[42px] font-light text-cream leading-none mb-2">
        Nutri<span className="text-gold italic">Hub</span>
      </h1>
      <p className="text-[15px] text-muted leading-relaxed mb-10">
        Social recipes. AI meal plans.{' '}
        <span className="text-sage-l">USDA-validated</span> nutrition.
      </p>

      {/* Feature list */}
      <div className="flex flex-col gap-4">
        {[
          ['🥗', 'Discover Recipes',    'Browse community recipes filtered by your goals'],
          ['🤖', 'AI Meal Planner',     'Generate a 7-day plan from your ingredients in seconds'],
          ['✅', 'Validated Nutrition', 'Every figure verified against the USDA FoodData Central database'],
        ].map(([icon, title, desc]) => (
          <div key={title} className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-[10px] flex-shrink-0
                            bg-[rgba(74,124,89,0.18)]
                            border border-[rgba(74,124,89,0.25)]
                            flex items-center justify-center text-[18px]">
              {icon}
            </div>
            <div>
              <p className="text-[14px] font-medium text-cream mb-0.5">{title}</p>
              <p className="text-[13px] text-muted leading-snug">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}