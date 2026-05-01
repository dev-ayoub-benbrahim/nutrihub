import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/helpers';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import toast from 'react-hot-toast';

export default function CommunitiesPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [communities, setCommunities] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [form,        setForm]        = useState({ name: '', description: '' });
  const [creating,    setCreating]    = useState(false);
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/communities');
        setCommunities(data.communities || []);
      } catch {
        setCommunities([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/communities', {
        name:        form.name.trim(),
        description: form.description.trim() || undefined,
      });
      setCommunities(prev => [data.community, ...prev]);
      setForm({ name: '', description: '' });
      setShowCreate(false);
      toast.success(`"${data.community.name}" created!`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e, communityId) => {
    // CRITICAL: stop the card navigation when clicking join
    e.stopPropagation();
    if (!user) return navigate('/login');
    try {
      await api.post(`/communities/${communityId}/join`);
      setCommunities(prev => prev.map(c =>
        c.id === communityId
          ? { ...c, isMember: true, _count: { ...c._count, members: (c._count?.members || 0) + 1 } }
          : c
      ));
      toast.success('Joined!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="anim-up">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-[32px] font-light text-cream leading-tight">
            <em className="text-gold not-italic italic">Communities</em>
          </h1>
          <p className="text-sm text-muted mt-1">Join groups built around cuisines and dietary goals</p>
        </div>
        {user && (
          <Button onClick={() => setShowCreate(s => !s)} size="sm">
            {showCreate ? 'Cancel' : '+ Create'}
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate}
              className="bg-forest2 border border-[rgba(74,124,89,0.25)] rounded-2xl p-5 mb-6 anim-up">
          <h2 className="text-[13px] font-semibold text-gold uppercase tracking-wide mb-4">New Community</h2>
          <div className="flex flex-col gap-3">
            <Input label="Community name" placeholder="e.g. Mediterranean Food Lovers"
                   value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Description (optional)</label>
              <textarea rows={2} placeholder="What is this community about?"
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full bg-forest border border-[rgba(74,124,89,0.25)] rounded-[10px]
                                   px-3.5 py-2.5 text-cream text-sm placeholder:text-muted
                                   outline-none focus:border-sage transition-colors resize-none"/>
            </div>
            <Button type="submit" loading={creating} size="sm">Create community</Button>
          </div>
        </form>
      )}

      {/* Search bar */}
      <div className="flex items-center gap-3 bg-forest2 border border-[rgba(74,124,89,0.18)]
                      rounded-2xl px-4 py-2.5 mb-5 focus-within:border-sage transition-colors">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8FA897" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search communities..."
          className="flex-1 bg-transparent outline-none text-cream text-sm placeholder:text-muted"
        />
        {search && <button onClick={() => setSearch('')} className="text-muted hover:text-cream text-lg">×</button>}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 bg-forest2 rounded-2xl animate-pulse"/>
          ))}
        </div>
      ) : communities.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4 opacity-40">👥</p>
          <p className="font-serif text-xl font-light text-cream mb-2">No communities yet</p>
          <p className="text-sm text-muted mb-5">Be the first to create one</p>
          {user && <Button onClick={() => setShowCreate(true)} size="sm">Create the first community</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {communities.filter(c =>
            !search.trim() ||
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            (c.description || '').toLowerCase().includes(search.toLowerCase())
          ).map((community, i) => (
            // The entire card navigates — only the join button stops propagation
            <div
              key={community.id}
              onClick={() => navigate(`/communities/${community.id}`)}
              className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5
                         cursor-pointer transition-all duration-200
                         hover:border-[rgba(74,124,89,0.35)]
                         hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.3)]
                         flex flex-col gap-3 anim-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {/* Avatar + name */}
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex-shrink-0
                                bg-gradient-to-br from-sage to-forest3
                                border border-[rgba(74,124,89,0.3)]
                                flex items-center justify-center
                                text-cream text-[15px] font-bold font-serif">
                  {community.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-cream text-[15px] leading-tight truncate">
                    {community.name}
                  </h3>
                  <p className="text-[12px] text-muted mt-0.5">
                    by <span className="text-sage-l">{community.creator?.name || 'Unknown'}</span>
                  </p>
                </div>
              </div>

              {community.description && (
                <p className="text-[13px] text-cream/70 leading-snug line-clamp-2">
                  {community.description}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-auto pt-2
                              border-t border-[rgba(74,124,89,0.15)]">
                <span className="text-[12px] text-muted flex items-center gap-1">
                  <MembersIcon/> {community._count?.members || 0} members
                </span>

                {/* Only the join button uses stopPropagation */}
                {user && !community.isMember && community.creatorId !== user.id && (
                  <button
                    onClick={(e) => handleJoin(e, community.id)}
                    className="text-[12px] text-sage-l hover:text-cream
                               border border-[rgba(74,124,89,0.3)] hover:border-sage
                               px-3 py-1.5 rounded-lg transition-all duration-200"
                  >
                    Join
                  </button>
                )}
                {community.isMember && community.creatorId !== user?.id && (
                  <span className="text-[12px] text-sage-l">✓ Joined</span>
                )}
                {community.creatorId === user?.id && (
                  <span className="text-[12px] text-gold">Your community</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MembersIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);