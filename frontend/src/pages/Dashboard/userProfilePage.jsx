import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { useAuth } from '../../hooks/useAuth';
import { getInitials, getErrorMessage, formatCount } from '../../utils/helpers';
import RecipeList from '../../components/recipes/RecipeList';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

const GOAL_LABELS = {
  LOSE_WEIGHT:   'Lose weight',
  MAINTAIN:      'Maintain weight',
  BUILD_MUSCLE:  'Build muscle',
  EAT_HEALTHIER: 'Eat healthier',
};

export default function UserProfilePage() {
  const { id }       = useParams();
  const { user: me } = useAuth();
  const navigate     = useNavigate();

  const [profile,     setProfile]     = useState(null);
  const [recipes,     setRecipes]     = useState([]);
  const [stats,       setStats]       = useState({ recipeCount: 0, followerCount: 0, followingCount: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [notFound,    setNotFound]    = useState(false);
  const [toggling,    setToggling]    = useState(false);

  const isOwnProfile = me?.id === parseInt(id);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        // GET /api/users/:id is the source of truth for profile info
        const { data: profileData } = await api.get(`/users/${id}`);
        setProfile(profileData);

        // Fetch recipes and social counts in parallel
        const [recipeRes, followerRes, followingRes] = await Promise.allSettled([
          api.get(`/recipes/user/${id}`),
          api.get(`/social/users/${id}/followers`),
          api.get(`/social/users/${id}/following`),
        ]);

        const recipeList   = recipeRes.status   === 'fulfilled' ? recipeRes.value.data.recipes   || [] : [];
        const followerData = followerRes.status === 'fulfilled' ? followerRes.value.data          : {};
        const followingData= followingRes.status=== 'fulfilled' ? followingRes.value.data         : {};

        setRecipes(recipeList);
        setStats({
          recipeCount:    recipeList.length,
          followerCount:  followerData.followerCount   || 0,
          followingCount: followingData.followingCount || 0,
        });

        // Check if current user follows this profile
        if (me && followerData.followers) {
          setIsFollowing(followerData.followers.some(f => f.id === me.id));
        }
      } catch (err) {
        if (err?.response?.status === 404) {
          setNotFound(true);
        } else {
          toast.error(getErrorMessage(err));
        }
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id, me]);

  const handleFollowToggle = async () => {
    if (!me) return navigate('/login');
    setToggling(true);
    try {
      if (isFollowing) {
        await api.delete(`/social/users/${id}/follow`);
        setIsFollowing(false);
        setStats(prev => ({ ...prev, followerCount: Math.max(prev.followerCount - 1, 0) }));
      } else {
        await api.post(`/social/users/${id}/follow`);
        setIsFollowing(true);
        setStats(prev => ({ ...prev, followerCount: prev.followerCount + 1 }));
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setToggling(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────
  if (loading) return (
    <div className="max-w-3xl mx-auto animate-pulse space-y-5">
      <div className="flex items-end gap-5">
        <div className="w-20 h-20 rounded-full bg-forest2 flex-shrink-0"/>
        <div className="flex-1 space-y-2">
          <div className="h-7 bg-forest2 rounded w-48"/>
          <div className="h-4 bg-forest2 rounded w-32"/>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({length:3}).map((_,i)=><div key={i} className="h-20 bg-forest2 rounded-2xl"/>)}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
        {Array.from({length:3}).map((_,i)=><div key={i} className="h-52 bg-forest2 rounded-2xl"/>)}
      </div>
    </div>
  );

  // ── Not found state ────────────────────────────────────────
  if (notFound) return (
    <div className="max-w-3xl mx-auto text-center py-20">
      <p className="text-5xl mb-4 opacity-40">👤</p>
      <p className="font-serif text-2xl font-light text-cream mb-2">User not found</p>
      <p className="text-sm text-muted mb-5">This profile doesn't exist or has been removed</p>
      <button onClick={() => navigate(-1)} className="text-gold hover:text-gold-l text-sm transition-colors">
        ← Go back
      </button>
    </div>
  );

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto anim-up">

      {/* Back */}
      <button onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-muted hover:text-cream text-sm mb-5 transition-colors">
        <BackIcon/> Back
      </button>

      {/* Profile header */}
      <div className="flex items-end gap-5 mb-6">
        <div className="w-20 h-20 rounded-full flex-shrink-0
                        bg-gradient-to-br from-sage to-rust
                        flex items-center justify-center
                        border-2 border-[rgba(74,124,89,0.35)]
                        text-cream text-[28px] font-bold overflow-hidden">
          {profile.avatarURL
            ? <img src={profile.avatarURL} alt={profile.name} className="w-full h-full object-cover"/>
            : getInitials(profile.name)
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h1 className="font-serif text-[28px] font-light text-cream leading-tight">
              {profile.name}
            </h1>
            {profile.role === 'ADMIN' && (
              <span className="text-xs text-rust-l border border-rust/30 px-2 py-1 rounded-lg flex-shrink-0">
                🛡️ Admin
              </span>
            )}
          </div>
          {profile.specialisation && (
            <p className="text-[13px] text-sage-l mb-1">{profile.specialisation}</p>
          )}
          {profile.goal && (
            <p className="text-[13px] text-muted">{GOAL_LABELS[profile.goal] || profile.goal}</p>
          )}
          {profile.bio && (
            <p className="text-sm text-cream/70 mt-2 max-w-md leading-relaxed">{profile.bio}</p>
          )}

          {/* Single expert indicator — role badge removed above, only this banner */}
          {profile.role === 'EXPERT' && (
            <div className="mt-3 inline-flex items-center gap-2.5 bg-[rgba(212,168,67,0.08)]
                            border border-gold/25 rounded-xl px-4 py-2.5">
              <span className="text-gold text-[15px] leading-none">✓</span>
              <div>
                <span className="text-[13px] font-semibold text-gold">Verified Expert</span>
                {profile.specialisation && (
                  <span className="text-[12px] text-cream/60 ml-2">· {profile.specialisation}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action button */}
        {isOwnProfile ? (
          <Button variant="secondary" size="sm" onClick={() => navigate('/profile/edit')}
                  className="flex-shrink-0">
            Edit profile
          </Button>
        ) : me ? (
          <Button
            variant={isFollowing ? 'secondary' : 'primary'}
            size="sm"
            loading={toggling}
            onClick={handleFollowToggle}
            className="flex-shrink-0"
          >
            {isFollowing ? '✓ Following' : 'Follow'}
          </Button>
        ) : (
          <Button size="sm" onClick={() => navigate('/login')} className="flex-shrink-0">
            Follow
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6 anim-up-1">
        {[
          [stats.recipeCount,    'Recipes'],
          [stats.followerCount,  'Followers'],
          [stats.followingCount, 'Following'],
        ].map(([val, label]) => (
          <div key={label}
               className="bg-forest2 border border-[rgba(74,124,89,0.18)]
                          rounded-2xl p-4 text-center">
            <p className="font-serif text-[28px] font-light text-gold leading-none">{formatCount(val)}</p>
            <p className="text-[12px] text-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Recipes */}
      <div className="anim-up-2">
        <h2 className="font-serif text-[20px] font-light text-cream mb-4">
          {isOwnProfile ? 'Your ' : ''}<em className="text-gold not-italic italic">Recipes</em>
        </h2>
        <RecipeList recipes={recipes} loading={false}/>
      </div>
    </div>
  );
}

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);