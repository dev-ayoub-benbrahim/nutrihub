import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/axios';
import { getInitials, formatCount } from '../../utils/helpers';
import RecipeList from '../../components/recipes/RecipeList';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [recipes,  setRecipes]  = useState([]);
  const [saves,    setSaves]    = useState([]);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [activeTab, setTab]     = useState('recipes');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [recRes, savRes, followRes] = await Promise.allSettled([
          api.get(`/recipes/user/${user.id}`),
          api.get(`/social/users/${user.id}/saves`),
          api.get(`/social/users/${user.id}/followers`),
        ]);

        if (recRes.status === 'fulfilled') setRecipes(recRes.value.data.recipes || []);
        if (savRes.status === 'fulfilled') setSaves(savRes.value.data.saves || []);

        const followerCount  = followRes.status === 'fulfilled' ? followRes.value.data.followerCount : 0;

        setStats({
          recipeCount:  recRes.status === 'fulfilled'  ? (recRes.value.data.recipes || []).length : 0,
          saveCount:    savRes.status === 'fulfilled'   ? (savRes.value.data.saves   || []).length : 0,
          followerCount,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (!user) return null;

  return (
    <div className="max-w-3xl anim-up">

      {/* Profile header */}
      <div className="flex items-end gap-5 mb-6">
        <div className="w-20 h-20 rounded-full flex-shrink-0
                        bg-gradient-to-br from-sage to-rust
                        flex items-center justify-center
                        text-cream text-[28px] font-bold border-2 border-[rgba(74,124,89,0.35)]">
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover"/>
            : getInitials(user.name)
          }
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-[30px] font-light text-cream leading-tight">
            {user.name}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {user.goal || 'No goal set'} ·{' '}
            {user.calorieTarget ? `${user.calorieTarget} kcal target` : 'No calorie target'} ·{' '}
            <span className="text-sage-l">{user.role}</span>
          </p>
          {user.bio && <p className="text-sm text-cream/70 mt-1.5 max-w-md">{user.bio}</p>}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/profile/edit')}
          className="flex-shrink-0"
        >
          Edit profile
        </Button>
      </div>

      {/* Stats row */}
      {!loading && stats && (
        <div className="grid grid-cols-3 gap-3 mb-6 anim-up-1">
          {[
            [stats.recipeCount,  'Recipes'],
            [stats.saveCount,    'Saved'],
            [stats.followerCount,'Followers'],
          ].map(([val, label]) => (
            <div
              key={label}
              className="bg-forest2 border border-[rgba(74,124,89,0.18)]
                         rounded-2xl p-4 text-center"
            >
              <p className="font-serif text-[28px] font-light text-gold">{formatCount(val)}</p>
              <p className="text-[12px] text-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-forest2 p-1 rounded-xl w-fit
                      border border-[rgba(74,124,89,0.18)]">
        {['recipes', 'saved'].map((tab) => (
          <button
            key={tab}
            onClick={() => setTab(tab)}
            className={[
              'px-4 py-1.5 rounded-[8px] text-sm transition-all duration-200',
              activeTab === tab
                ? 'bg-forest3 text-cream font-medium'
                : 'text-muted hover:text-cream',
            ].join(' ')}
          >
            {tab === 'recipes' ? 'My Recipes' : 'Saved'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="anim-up-2">
        {activeTab === 'recipes' && (
          <RecipeList recipes={recipes} loading={loading} />
        )}
        {activeTab === 'saved' && (
          saves.length === 0 && !loading
            ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3 opacity-40">🔖</p>
                <p className="font-serif text-lg font-light text-cream mb-1">No saved recipes yet</p>
                <p className="text-sm text-muted">Save recipes from the explore feed</p>
              </div>
            )
            : <RecipeList recipes={saves} loading={loading} />
        )}
      </div>
    </div>
  );
}