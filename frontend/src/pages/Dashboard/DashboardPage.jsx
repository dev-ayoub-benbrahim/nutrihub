import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/axios';
import { getInitials, formatCount } from '../../utils/helpers';
import RecipeList from '../../components/recipes/RecipeList';
import Button from '../../components/ui/Button';

export default function DashboardPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const [recipes,   setRecipes]   = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [stats,     setStats]     = useState(null);
  const [nutrition,       setNutrition]       = useState(null);
  const [weeklyNutrition, setWeeklyNutrition] = useState([]);
  const [calorieTarget,   setCalorieTarget]   = useState(2000);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setTab]       = useState('recipes');

  useEffect(() => {
    if (!user) return;
    const loadNutrition = async () => {
      try {
        const { data } = await api.get('/social/nutrition/today');
        setNutrition(data);
      } catch { }
      try {
        const { data } = await api.get('/social/nutrition/week');
        setWeeklyNutrition(data.week || []);
        setCalorieTarget(data.target || 2000);
      } catch { }
    };
    loadNutrition();

    const load = async () => {
      setLoading(true);
      try {
        const [recRes, followerRes, followingRes] = await Promise.allSettled([
          api.get(`/recipes/user/${user.id}`),
          api.get(`/social/users/${user.id}/followers`),
          api.get(`/social/users/${user.id}/following`),
        ]);

        const recipeData   = recRes.status       === 'fulfilled' ? recRes.value.data       : {};
        const followerData = followerRes.status   === 'fulfilled' ? followerRes.value.data   : {};
        const followingData= followingRes.status  === 'fulfilled' ? followingRes.value.data  : {};

        setRecipes(recipeData.recipes || []);
        setFollowers(followerData.followers || []);
        setFollowing(followingData.following || []);
        setStats({
          recipeCount:   (recipeData.recipes || []).length,
          followerCount: followerData.followerCount  || 0,
          followingCount:followingData.followingCount|| 0,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (!user) return null;

  const GOAL_LABELS = {
    LOSE_WEIGHT:   'Lose weight',
    MAINTAIN:      'Maintain weight',
    BUILD_MUSCLE:  'Build muscle',
    EAT_HEALTHIER: 'Eat healthier',
  };

  const TABS = [
    { id: 'recipes',   label: `Recipes${stats ? ` (${stats.recipeCount})` : ''}` },
    { id: 'followers', label: `Followers${stats ? ` (${stats.followerCount})` : ''}` },
    { id: 'following', label: `Following${stats ? ` (${stats.followingCount})` : ''}` },
  ];

  return (
    <div className="max-w-3xl mx-auto anim-up">

      {/* Profile header */}
      <div className="flex items-end gap-5 mb-6">
        <div className="w-20 h-20 rounded-full flex-shrink-0
                        bg-gradient-to-br from-sage to-rust
                        flex items-center justify-center
                        border-2 border-[rgba(74,124,89,0.35)]
                        text-cream text-[28px] font-bold overflow-hidden">
          {user.avatarURL
            ? <img src={user.avatarURL} alt={user.name} className="w-full h-full object-cover"/>
            : getInitials(user.name)
          }
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-[30px] font-light text-cream leading-tight">
            {user.name}
          </h1>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {user.goal && (
              <span className="text-[12px] text-sage-l border border-[rgba(74,124,89,0.25)]
                               px-2 py-0.5 rounded-md">
                {GOAL_LABELS[user.goal] || user.goal}
              </span>
            )}
            {user.calorieTarget && (
              <span className="text-[12px] text-muted">{user.calorieTarget} kcal target</span>
            )}
            {user.role === 'ADMIN' && (
              <span className="text-[12px] text-rust-l border border-rust/30 px-2 py-0.5 rounded-md">
                🛡️ Admin
              </span>
            )}
          </div>
          {/* One expert indicator — inline, shows profession */}
          {user.role === 'EXPERT' && (
            <div className="mt-2 inline-flex items-center gap-2 bg-[rgba(212,168,67,0.08)]
                            border border-gold/25 rounded-xl px-3.5 py-2">
              <span className="text-gold text-[14px]">✓</span>
              <span className="text-[12px] font-semibold text-gold">Verified Expert</span>
              {user.specialisation && (
                <span className="text-[12px] text-cream/55">· {user.specialisation}</span>
              )}
            </div>
          )}
          {user.bio && (
            <p className="text-sm text-cream/70 mt-1.5 max-w-md">{user.bio}</p>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/profile/edit')}
                className="flex-shrink-0">
          Edit profile
        </Button>
      </div>

      {/* Stats row */}
      {/* Daily nutrition tracker */}
      {nutrition !== null && (
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-4 mb-5 anim-up">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {nutrition.dayNumber
                  ? `Meal Plan · Day ${nutrition.dayNumber}`
                  : "Meal Tracker"
                }
              </p>
              <p className="text-[12px] text-muted mt-0.5">
                {nutrition.mealCount > 0
                  ? `${nutrition.mealCount} meal${nutrition.mealCount !== 1 ? 's' : ''} logged`
                  : 'No meals logged yet'
                }
              </p>
            </div>
            <div className="text-right">
              <p className="text-[20px] font-semibold text-gold leading-tight">
                {Math.round(nutrition.calories)}
                <span className="text-[13px] font-normal text-muted ml-1">kcal</span>
              </p>
              {user?.calorieTarget && (
                <p className="text-[11px] text-muted">/ {user.calorieTarget} target</p>
              )}
            </div>
          </div>
          {/* Macro bar */}
          {nutrition.calories > 0 && (
            <>
              {user?.calorieTarget && (
                <div className="h-1.5 bg-forest3 rounded-full mb-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-sage to-gold rounded-full transition-all"
                       style={{ width: `${Math.min(100, Math.round(nutrition.calories / user.calorieTarget * 100))}%` }}/>
                </div>
              )}
              <div className="flex gap-4 text-[11px]">
                <span className="text-blue-400">P <strong>{Math.round(nutrition.proteinG)}g</strong></span>
                <span className="text-gold/80">C <strong>{Math.round(nutrition.carbsG)}g</strong></span>
                <span className="text-rust-l">F <strong>{Math.round(nutrition.fatG)}g</strong></span>
              </div>
            </>
          )}
          {nutrition.mealCount === 0 && (
            <div className="mt-3 flex items-center gap-3 bg-forest/50 rounded-xl px-3 py-2.5">
              <span className="text-xl">🍽️</span>
              <div>
                <p className="text-[12px] text-cream/80">No meals logged today</p>
                <p className="text-[11px] text-muted mt-0.5">
                  Open your{' '}
                  <span className="text-sage-l cursor-pointer hover:text-cream transition-colors"
                        onClick={() => navigate('/meal-planner')}>
                    Meal Planner
                  </span>{' '}
                  and tick meals as you eat them
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recharts weekly calorie chart */}
      {weeklyNutrition.length > 0 && (
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[13px] font-semibold text-cream">Meal Plan Progress</p>
              <p className="text-[11px] text-muted">Calories logged per plan day vs {calorieTarget} kcal target</p>
            </div>
            <span className="text-[11px] text-muted bg-forest px-2 py-1 rounded-lg border border-[rgba(74,124,89,0.2)]">kcal/day</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyNutrition} barSize={28} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fill: '#8aab94', fontSize: 11, fontFamily: 'inherit' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: '#8aab94', fontSize: 10, fontFamily: 'inherit' }} axisLine={false} tickLine={false}
                     domain={[0, Math.ceil(Math.max(calorieTarget * 1.2, ...weeklyNutrition.map(d => d.calories).filter(c => c > 0), calorieTarget) / 100) * 100]}/>
              <Tooltip
                contentStyle={{ backgroundColor: '#1a2e1e', border: '1px solid rgba(74,124,89,0.3)', borderRadius: '10px', fontSize: '12px', color: '#e8d5b0' }}
                formatter={(value) => [`${value} kcal`, 'Calories']}
                cursor={{ fill: 'rgba(74,124,89,0.08)' }}
              />
              <ReferenceLine y={calorieTarget} stroke="rgba(212,168,67,0.5)" strokeDasharray="4 3"
                             label={{ value: 'Target', position: 'right', fill: '#d4a843', fontSize: 10 }}/>
              <Bar dataKey="calories" radius={[5, 5, 0, 0]}>
                {weeklyNutrition.map((entry, i) => (
                  <Cell key={i} fill={entry.calories >= calorieTarget * 0.8 ? 'rgba(74,124,89,0.85)' : 'rgba(74,124,89,0.35)'}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted mt-2 text-center">
            Each bar shows calories logged for that plan day. Unlogged days show as empty.
          </p>
        </div>
      )}

      {stats && !loading && (
        <div className="grid grid-cols-3 gap-3 mb-6 anim-up-1">
          {[
            [stats.recipeCount,   'Recipes',   'recipes'],
            [stats.followerCount, 'Followers', 'followers'],
            [stats.followingCount,'Following', 'following'],
          ].map(([val, label, tab]) => (
            <button key={label} onClick={() => setTab(tab)}
                    className={`bg-forest2 border rounded-2xl p-4 text-center transition-all duration-200
                                ${activeTab === tab
                                  ? 'border-sage/50 bg-[rgba(74,124,89,0.12)]'
                                  : 'border-[rgba(74,124,89,0.18)] hover:border-sage/30'}`}>
              <p className="font-serif text-[28px] font-light text-gold leading-none">{formatCount(val)}</p>
              <p className="text-[12px] text-muted mt-1">{label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-forest2 p-1 rounded-xl w-fit
                      border border-[rgba(74,124,89,0.18)]">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setTab(tab.id)}
                  className={`px-4 py-1.5 rounded-[8px] text-sm transition-all duration-200
                              ${activeTab === tab.id
                                ? 'bg-forest3 text-cream font-medium'
                                : 'text-muted hover:text-cream'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="anim-up-2">
        {activeTab === 'recipes' && (
          recipes.length === 0 && !loading ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3 opacity-40">🍳</p>
              <p className="font-serif text-lg font-light text-cream mb-1">No recipes yet</p>
              <p className="text-sm text-muted mb-4">Share your first recipe with the community</p>
              <Button size="sm" onClick={() => navigate('/add-recipe')}>Add recipe</Button>
            </div>
          ) : (
            <RecipeList recipes={recipes} loading={loading}/>
          )
        )}

        {activeTab === 'followers' && (
          <UserList users={followers} loading={loading} emptyText="No followers yet" onNavigate={navigate}/>
        )}

        {activeTab === 'following' && (
          <UserList users={following} loading={loading} emptyText="Not following anyone yet" onNavigate={navigate}/>
        )}
      </div>
    </div>
  );
}

function UserList({ users, loading, emptyText, onNavigate }) {
  if (loading) return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 bg-forest2 rounded-2xl animate-pulse"/>
      ))}
    </div>
  );

  if (users.length === 0) return (
    <div className="text-center py-16">
      <p className="text-4xl mb-3 opacity-40">👤</p>
      <p className="font-serif text-lg font-light text-cream">{emptyText}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {users.map((u, i) => (
        <div key={u.id}
             onClick={() => onNavigate(`/users/${u.id}`)}
             className="flex items-center gap-3 p-4 bg-forest2
                        border border-[rgba(74,124,89,0.18)] rounded-2xl
                        cursor-pointer hover:border-[rgba(74,124,89,0.35)]
                        hover:bg-forest3/50 transition-all duration-200 anim-up"
             style={{ animationDelay: `${i * 0.04}s` }}>
          <div className="w-10 h-10 rounded-full flex-shrink-0
                          bg-gradient-to-br from-sage to-rust
                          flex items-center justify-center
                          text-cream text-[13px] font-bold overflow-hidden">
            {u.avatarURL
              ? <img src={u.avatarURL} alt={u.name} className="w-full h-full object-cover"/>
              : getInitials(u.name)
            }
          </div>
          <div>
            <p className="text-[14px] font-medium text-cream">{u.name}</p>
            {u.bio && <p className="text-[12px] text-muted truncate max-w-xs">{u.bio}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}