import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { useAuth } from '../../hooks/useAuth';
import { getInitials, getErrorMessage, formatCount } from '../../utils/helpers';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const [activeTab, setTab]       = useState('reports');
  const [stats,     setStats]     = useState(null);
  const [reports,   setReports]   = useState([]);
  const [requests,  setRequests]  = useState([]);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [userQuery, setUserQuery] = useState('');

  // Guard — admin only
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsRes, reportsRes, requestsRes] = await Promise.allSettled([
          api.get('/admin/stats'),
          api.get('/admin/reports?resolved=false'),
          api.get('/admin/expert-requests?status=pending'),
        ]);
        if (statsRes.status    === 'fulfilled') setStats(statsRes.value.data);
        if (reportsRes.status  === 'fulfilled') setReports(reportsRes.value.data.reports || []);
        if (requestsRes.status === 'fulfilled') setRequests(requestsRes.value.data.requests || []);
      } catch { } finally { setLoading(false); }
    };
    load();
  }, []);

  const loadUsers = async (q = '') => {
    try {
      const { data } = await api.get(`/admin/users?q=${encodeURIComponent(q)}`);
      setUsers(data.users || []);
    } catch { }
  };

  useEffect(() => {
    if (activeTab === 'users') loadUsers(userQuery);
  }, [activeTab, userQuery]);

  const handleResolveReport = async (reportId, action = 'dismiss') => {
    const notes = { dismiss: 'No violation found', warn: 'User warned by admin', remove: 'Content removed' };
    try {
      await api.put(`/admin/reports/${reportId}/resolve`, { resolvedNote: notes[action] });
      setReports(prev => prev.filter(r => r.id !== reportId));
      toast.success(action === 'dismiss' ? 'Report dismissed' : action === 'warn' ? 'User warned' : 'Content removed');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleDeleteContent = async (recipeId, type, reportId) => {
    if (!window.confirm('Delete this recipe? This cannot be undone.')) return;
    try {
      await api.delete(`/recipes/${recipeId}`);
      await api.put(`/admin/reports/${reportId}/resolve`, { resolvedNote: 'Content removed by admin' });
      setReports(prev => prev.filter(r => r.id !== reportId));
      toast.success('Recipe deleted and report resolved');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleExpertDecision = async (requestId, decision) => {
    const note = decision === 'rejected'
      ? window.prompt('Optional: reason for rejection (visible to user)?') || ''
      : '';
    try {
      await api.put(`/admin/expert-requests/${requestId}`, { decision, adminNote: note });
      setRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success(`Request ${decision}`);
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success('Role updated');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  if (!user || user.role !== 'ADMIN') return null;

  const TABS = [
    { id: 'reports',  label: `Reports (${reports.length})`   },
    { id: 'experts',  label: `Expert Requests (${requests.length})` },
    { id: 'users',    label: 'Users'                         },
  ];

  return (
    <div className="max-w-4xl mx-auto anim-up">
      <div className="mb-6">
        <h1 className="font-serif text-[32px] font-light text-cream">
          Admin <em className="text-gold not-italic italic">Panel</em>
        </h1>
        <p className="text-sm text-muted mt-1">Manage reports, expert requests, and users</p>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            [stats.users,                'Users',           'text-cream'],
            [stats.recipes,              'Recipes',         'text-cream'],
            [stats.communities,          'Communities',     'text-cream'],
            [stats.pendingReports,       'Pending Reports', 'text-rust-l'],
            [stats.pendingExpertRequests,'Expert Requests', 'text-gold'],
          ].map(([val, label, color]) => (
            <div key={label} className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-3 text-center">
              <p className={`font-serif text-[22px] font-light ${color}`}>{formatCount(val)}</p>
              <p className="text-[10px] text-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-forest2 p-1 rounded-xl w-fit border border-[rgba(74,124,89,0.18)]">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setTab(tab.id)}
                  className={`px-4 py-1.5 rounded-[8px] text-sm transition-all duration-200
                              ${activeTab === tab.id ? 'bg-forest3 text-cream font-medium' : 'text-muted hover:text-cream'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── REPORTS ──────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        reports.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-3 opacity-40">✅</p>
            <p className="font-serif text-lg font-light text-cream">No pending reports</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map(r => (
              <div key={r.id}
                   className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold
                                        ${r.category === 'Spam'           ? 'bg-yellow-900/30 text-yellow-400' :
                                          r.category === 'Inappropriate'  ? 'bg-orange-900/30 text-orange-400' :
                                          r.category === 'Misinformation' ? 'bg-blue-900/30 text-blue-400'    :
                                          r.category === 'Harassment'     ? 'bg-red-900/30 text-red-400'      :
                                          'bg-forest3 text-muted'}`}>
                        {r.category}
                      </span>
                      <span className="text-[12px] text-muted">
                        Reported by <span className="text-cream">{r.reporter?.name}</span>
                        {' · '}{new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-[13px] text-cream/85 mb-2">{r.reason}</p>
                    {r.recipe && (
                      <p className="text-[12px] text-muted">
                        Recipe: <span className="text-sage-l cursor-pointer hover:text-cream"
                                      onClick={() => navigate(`/recipes/${r.recipe.id}`)}>
                          {r.recipe.title}
                        </span>
                      </p>
                    )}
                    {r.reportedUser && (
                      <p className="text-[12px] text-muted">
                        User: <span className="text-sage-l cursor-pointer hover:text-cream"
                                    onClick={() => navigate(`/users/${r.reportedUser.id}`)}>
                          {r.reportedUser.name}
                        </span>{' '}
                        <span className="text-muted">({r.reportedUser.role})</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {/* View the content first */}
                    {r.recipe && (
                      <a href={`/recipes/${r.recipe.id}`} target="_blank" rel="noreferrer"
                         className="text-[11px] text-sage-l hover:text-cream border border-[rgba(74,124,89,0.25)]
                                    hover:border-sage px-3 py-1.5 rounded-lg transition-all text-center block">
                        View Recipe →
                      </a>
                    )}
                    {r.reportedUser && (
                      <a href={`/users/${r.reportedUser.id}`} target="_blank" rel="noreferrer"
                         className="text-[11px] text-sage-l hover:text-cream border border-[rgba(74,124,89,0.25)]
                                    hover:border-sage px-3 py-1.5 rounded-lg transition-all text-center block">
                        View Profile →
                      </a>
                    )}
                    <button onClick={() => handleResolveReport(r.id, 'dismiss')}
                            className="text-[11px] text-muted hover:text-cream border border-[rgba(74,124,89,0.2)]
                                       hover:border-sage px-3 py-1.5 rounded-lg transition-all text-center">
                      Dismiss
                    </button>
                    <button onClick={() => handleResolveReport(r.id, 'warn')}
                            className="text-[11px] text-gold border border-gold/20
                                       hover:border-gold/50 px-3 py-1.5 rounded-lg transition-all text-center">
                      Warn User
                    </button>
                    {r.recipe && (
                      <button onClick={() => handleDeleteContent(r.recipe.id, 'recipe', r.id)}
                              className="text-[11px] text-red-400 border border-red-500/20
                                         hover:border-red-400/50 px-3 py-1.5 rounded-lg transition-all text-center">
                        Delete Recipe
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── EXPERT REQUESTS ──────────────────────────────────── */}
      {activeTab === 'experts' && (
        requests.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-3 opacity-40">✅</p>
            <p className="font-serif text-lg font-light text-cream">No pending expert requests</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {requests.map(r => (
              <div key={r.id}
                   className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
                {/* Applicant */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sage to-rust
                                  flex items-center justify-center text-cream text-[13px] font-bold
                                  overflow-hidden flex-shrink-0">
                    {r.user?.avatarURL
                      ? <img src={r.user.avatarURL} alt="" className="w-full h-full object-cover"/>
                      : getInitials(r.user?.name)}
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-cream">{r.user?.name}</p>
                    <p className="text-[12px] text-muted">{r.user?.email}</p>
                  </div>
                  <span className="ml-auto text-[11px] text-muted">
                    {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {/* Application details */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    ['Profession',      r.profession],
                    ['Experience',      r.experience],
                    ['Qualifications',  r.qualifications],
                    r.linkedin ? ['LinkedIn', r.linkedin] : null,
                  ].filter(Boolean).map(([label, value]) => (
                    <div key={label} className="bg-forest rounded-xl px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">{label}</p>
                      <p className="text-[13px] text-cream/85 leading-snug">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleExpertDecision(r.id, 'approved')}>
                    ✓ Approve
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleExpertDecision(r.id, 'rejected')}>
                    ✗ Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── USERS ─────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div>
          <div className="flex items-center gap-3 bg-forest2 border border-[rgba(74,124,89,0.18)]
                          rounded-2xl px-4 py-2.5 mb-4 focus-within:border-sage transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8FA897" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={userQuery} onChange={e => setUserQuery(e.target.value)}
                   placeholder="Search users by name..."
                   className="flex-1 bg-transparent outline-none text-cream text-sm placeholder:text-muted"/>
          </div>

          <div className="flex flex-col gap-2">
            {users.map(u => (
              <div key={u.id}
                   className="flex items-center gap-3 bg-forest2 border border-[rgba(74,124,89,0.18)]
                              rounded-2xl px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sage to-rust
                                flex items-center justify-center text-cream text-[12px] font-bold
                                overflow-hidden flex-shrink-0">
                  {u.avatarURL
                    ? <img src={u.avatarURL} alt="" className="w-full h-full object-cover"/>
                    : getInitials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-cream">{u.name}</p>
                  <p className="text-[11px] text-muted">{u.email}</p>
                </div>
                <select
                  value={u.role}
                  onChange={e => handleRoleChange(u.id, e.target.value)}
                  className="bg-forest border border-[rgba(74,124,89,0.25)] rounded-lg
                             px-2.5 py-1.5 text-[12px] text-cream outline-none
                             focus:border-sage transition-colors"
                >
                  {['USER', 'EXPERT', 'ADMIN'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}