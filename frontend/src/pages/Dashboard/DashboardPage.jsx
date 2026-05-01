import { useState, useEffect } from 'react';
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
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setTab]       = useState('recipes');

  useEffect(() => {
    if (!user) return;
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