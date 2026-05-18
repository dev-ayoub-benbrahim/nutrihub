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

const TABS = [
  { id: 'all',     label: 'Suggested'    },
  { id: 'experts', label: '✓ Experts'    },
  { id: 'new',     label: '🌱 New members' },
];

export default function PeoplePage() {
  const { user: me } = useAuth();
  const navigate     = useNavigate();

  const [activeTab,  setActiveTab]  = useState('all');
  const [query,      setQuery]      = useState('');
  const [suggested,  setSuggested]  = useState([]);
  const [results,    setResults]    = useState([]);
  const [following,  setFollowing]  = useState({}); // { userId: bool }
  const [loading,    setLoading]    = useState(true);
  const [searching,  setSearching]  = useState(false);
  const debounceRef  = useRef(null);

  // Load suggestions when tab changes
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setQuery('');
      setResults([]);
      try {
        const { data } = await api.get(`/users/suggested?filter=${activeTab === 'all' ? '' : activeTab}&limit=12`);
        setSuggested(data.users || []);
      } catch { } finally { setLoading(false); }
    };
    load();
  }, [activeTab, me]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(query.trim())}&limit=15`);
        setResults(data.users.filter(u => u.id !== me?.id) || []);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally { setSearching(false); }
    }, 350);
  }, [query, me]);

  const handleFollow = async (e, userId) => {
    e.stopPropagation();
    if (!me) return navigate('/login');
    const wasFollowing = following[userId];
    setFollowing(prev => ({ ...prev, [userId]: !wasFollowing }));
    try {
      if (wasFollowing) {
        await api.delete(`/social/users/${userId}/follow`);
      } else {
        await api.post(`/social/users/${userId}/follow`);
      }
    } catch (err) {
      setFollowing(prev => ({ ...prev, [userId]: wasFollowing }));
      toast.error(getErrorMessage(err));
    }
  };

  const isSearching   = query.trim().length >= 2;
  const displayList   = isSearching ? results : suggested;

  return (
    <div className="max-w-2xl mx-auto anim-up">

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-[32px] font-light text-cream leading-tight">
          Find <em className="text-gold not-italic italic">People</em>
        </h1>
        <p className="text-sm text-muted mt-1">
          Discover food lovers, verified experts, and chefs to follow
        </p>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 bg-forest2
                      border border-[rgba(74,124,89,0.18)] rounded-2xl
                      px-4 py-3 mb-5 focus-within:border-sage transition-colors">
        <SearchIcon/>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name..."
          className="flex-1 bg-transparent outline-none text-cream text-sm placeholder:text-muted"
        />
        {searching && (
          <div className="w-4 h-4 border-2 border-sage border-t-transparent rounded-full animate-spin flex-shrink-0"/>
        )}
        {query && !searching && (
          <button onClick={() => setQuery('')}
                  className="text-muted hover:text-cream transition-colors text-xl leading-none">
            ×
          </button>
        )}
      </div>

      {/* Category tabs — hidden while searching */}
      {!isSearching && (
        <div className="flex gap-1 mb-5 bg-forest2 p-1 rounded-xl w-fit border border-[rgba(74,124,89,0.18)]">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-1.5 rounded-[8px] text-[13px] transition-all duration-200
                                ${activeTab === tab.id
                                  ? 'bg-forest3 text-cream font-medium'
                                  : 'text-muted hover:text-cream'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Section label */}
      <p className="text-[11px] font-semibold uppercase tracking-[1px] text-muted mb-3">
        {isSearching
          ? `Results for "${query}"`
          : activeTab === 'experts'
            ? 'Verified Experts'
            : activeTab === 'new'
              ? 'Recently Joined'
              : 'People You Might Like'
        }
      </p>

      {/* Loading state */}
      {(loading || (isSearching && searching)) && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-forest2 rounded-2xl animate-pulse"/>
          ))}
        </div>
      )}

      {/* No results */}
      {!loading && !searching && isSearching && results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-3xl mb-3 opacity-40">🔍</p>
          <p className="font-serif text-lg font-light text-cream mb-1">No users found</p>
          <p className="text-sm text-muted">Try a different name</p>
        </div>
      )}

      {/* Empty suggestions */}
      {!loading && !isSearching && suggested.length === 0 && (
        <div className="text-center py-12">
          <p className="text-3xl mb-3 opacity-40">
            {activeTab === 'experts' ? '🏅' : activeTab === 'new' ? '🌱' : '👥'}
          </p>
          <p className="font-serif text-lg font-light text-cream mb-1">
            {activeTab === 'experts' ? 'No experts yet' : activeTab === 'new' ? 'No new members recently' : 'No suggestions right now'}
          </p>
          <p className="text-sm text-muted">Check back soon</p>
        </div>
      )}

      {/* User list */}
      {!loading && !(isSearching && searching) && displayList.length > 0 && (
        <div className="flex flex-col gap-3">
          {displayList.map((u, i) => (
            <UserCard
              key={u.id}
              user={u}
              index={i}
              isFollowing={following[u.id] ?? false}
              onFollow={(e) => handleFollow(e, u.id)}
              onClick={() => navigate(`/users/${u.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── UserCard ───────────────────────────────────────────────────
function UserCard({ user: u, index, isFollowing, onFollow, onClick }) {
  return (
    <div onClick={onClick}
         className="flex items-center gap-4 bg-forest2
                    border border-[rgba(74,124,89,0.18)] rounded-2xl p-4
                    cursor-pointer hover:border-[rgba(74,124,89,0.35)]
                    hover:bg-forest3/40 transition-all duration-200 anim-up"
         style={{ animationDelay: `${index * 0.04}s` }}>

      {/* Avatar */}
      <div className="w-12 h-12 rounded-full flex-shrink-0
                      bg-gradient-to-br from-sage to-rust
                      flex items-center justify-center text-cream text-[15px] font-bold
                      overflow-hidden border-2 border-[rgba(74,124,89,0.25)]">
        {u.avatarURL
          ? <img src={u.avatarURL} alt={u.name} className="w-full h-full object-cover"/>
          : getInitials(u.name)
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[15px] font-medium text-cream truncate">{u.name}</span>
          {u.role === 'EXPERT' && (
            <span className="text-[10px] text-gold border border-gold/30 px-1.5 py-0.5 rounded flex-shrink-0">
              ✓ Expert
            </span>
          )}
        </div>

        {/* Specialisation or bio */}
        {u.specialisation && (
          <p className="text-[12px] text-sage-l truncate">{u.specialisation}</p>
        )}
        {!u.specialisation && u.bio && (
          <p className="text-[12px] text-muted truncate max-w-xs">{u.bio}</p>
        )}
        {!u.specialisation && !u.bio && u.goal && (
          <p className="text-[12px] text-muted">{GOAL_LABELS[u.goal] || u.goal}</p>
        )}

        {/* Stats */}
        {u._count && (
          <div className="flex gap-3 mt-1">
            {u._count.followers > 0 && (
              <span className="text-[11px] text-muted">
                <span className="text-cream">{u._count.followers}</span> followers
              </span>
            )}
            {u._count.recipes > 0 && (
              <span className="text-[11px] text-muted">
                <span className="text-cream">{u._count.recipes}</span> recipes
              </span>
            )}
          </div>
        )}
      </div>

      {/* Follow button */}
      <button
        onClick={onFollow}
        className={`text-[12px] px-4 py-1.5 rounded-xl border flex-shrink-0
                    transition-all duration-200 font-medium
                    ${isFollowing
                      ? 'border-sage/40 bg-[rgba(74,124,89,0.14)] text-sage-l'
                      : 'border-[rgba(74,124,89,0.3)] text-muted hover:border-sage hover:text-cream'}`}>
        {isFollowing ? '✓ Following' : 'Follow'}
      </button>
    </div>
  );
}

const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8FA897" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);