import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { useAuth } from '../../hooks/useAuth';
import { getInitials, getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

const GOAL_LABELS = {
  LOSE_WEIGHT:   'Lose weight',
  MAINTAIN:      'Maintain weight',
  BUILD_MUSCLE:  'Build muscle',
  EAT_HEALTHIER: 'Eat healthier',
};

export default function PeoplePage() {
  const { user: me } = useAuth();
  const navigate     = useNavigate();
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [following,  setFollowing]  = useState({}); // { userId: bool }
  const [suggested,  setSuggested]  = useState([]);
  const debounceRef  = useRef(null);

  // Load suggested users on mount (experts + recently active)
  useEffect(() => {
    const loadSuggested = async () => {
      try {
        const { data } = await api.get('/users/search?q=a&limit=8');
        setSuggested(data.users.filter(u => u.id !== me?.id) || []);
      } catch { }
    };
    loadSuggested();
  }, [me]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data.users.filter(u => u.id !== me?.id) || []);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [query, me]);

  const handleFollow = async (e, userId) => {
    e.stopPropagation();
    if (!me) return navigate('/login');
    const wasFollowing = following[userId];
    // Optimistic update
    setFollowing(prev => ({ ...prev, [userId]: !wasFollowing }));
    try {
      if (wasFollowing) {
        await api.delete(`/social/users/${userId}/follow`);
      } else {
        await api.post(`/social/users/${userId}/follow`);
      }
    } catch (err) {
      // Revert on error
      setFollowing(prev => ({ ...prev, [userId]: wasFollowing }));
      toast.error(getErrorMessage(err));
    }
  };

  const displayList = query.trim().length >= 2 ? results : suggested;
  const title       = query.trim().length >= 2
    ? `Results for "${query}"`
    : 'Suggested People';

  return (
    <div className="max-w-2xl mx-auto anim-up">

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-[32px] font-light text-cream leading-tight">
          Find <em className="text-gold not-italic italic">People</em>
        </h1>
        <p className="text-sm text-muted mt-1">
          Discover food lovers, experts, and chefs to follow
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <div className="flex items-center gap-3 bg-forest2
                        border border-[rgba(74,124,89,0.18)] rounded-2xl
                        px-4 py-3 focus-within:border-sage transition-colors duration-200">
          <SearchIcon />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name..."
            autoFocus
            className="flex-1 bg-transparent outline-none text-cream text-sm
                       font-sans placeholder:text-muted"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-sage border-t-transparent
                            rounded-full animate-spin flex-shrink-0"/>
          )}
          {query && !loading && (
            <button onClick={() => setQuery('')}
                    className="text-muted hover:text-cream transition-colors text-lg leading-none">
              ×
            </button>
          )}
        </div>
      </div>

      {/* Section label */}
      <p className="text-[11px] font-semibold uppercase tracking-[1px] text-muted mb-3">
        {title}
      </p>

      {/* No results */}
      {query.trim().length >= 2 && !loading && results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-3xl mb-3 opacity-40">🔍</p>
          <p className="font-serif text-lg font-light text-cream mb-1">No users found</p>
          <p className="text-sm text-muted">Try a different name</p>
        </div>
      )}

      {/* User cards */}
      <div className="flex flex-col gap-3">
        {displayList.map((u, i) => (
          <div
            key={u.id}
            onClick={() => navigate(`/users/${u.id}`)}
            className="flex items-center gap-4 bg-forest2
                       border border-[rgba(74,124,89,0.18)] rounded-2xl p-4
                       cursor-pointer hover:border-[rgba(74,124,89,0.35)]
                       hover:bg-forest3/50 transition-all duration-200 anim-up"
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full flex-shrink-0
                            bg-gradient-to-br from-sage to-rust
                            flex items-center justify-center
                            text-cream text-[15px] font-bold overflow-hidden
                            border-2 border-[rgba(74,124,89,0.25)]">
              {u.avatarURL
                ? <img src={u.avatarURL} alt={u.name} className="w-full h-full object-cover"/>
                : getInitials(u.name)
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[15px] font-medium text-cream truncate">{u.name}</span>
                {u.role === 'EXPERT' && (
                  <span className="text-[10px] text-gold border border-gold/30 px-1.5 py-0.5 rounded flex-shrink-0">
                    Expert
                  </span>
                )}
              </div>
              {u.specialisation && (
                <p className="text-[12px] text-sage-l">{u.specialisation}</p>
              )}
              {u.bio && (
                <p className="text-[12px] text-muted truncate max-w-xs">{u.bio}</p>
              )}
              {u.goal && !u.bio && (
                <p className="text-[12px] text-muted">{GOAL_LABELS[u.goal] || u.goal}</p>
              )}
            </div>

            {/* Follow button */}
            <button
              onClick={(e) => handleFollow(e, u.id)}
              className={`text-[12px] px-4 py-1.5 rounded-xl border flex-shrink-0
                          transition-all duration-200 font-medium
                          ${following[u.id]
                            ? 'border-sage/40 bg-[rgba(74,124,89,0.14)] text-sage-l'
                            : 'border-[rgba(74,124,89,0.3)] text-muted hover:border-sage hover:text-cream'
                          }`}
            >
              {following[u.id] ? 'Following' : 'Follow'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8FA897" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);