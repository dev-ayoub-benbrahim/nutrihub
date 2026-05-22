import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getInitials } from '../../utils/helpers';
import api from '../../utils/axios';

export default function Navbar() {
  const { user, logout }  = useAuth();
  const navigate          = useNavigate();
  const [showDropdown,    setShowDropdown]    = useState(false);
  const [showNotifs,      setShowNotifs]      = useState(false);
  const [query,           setQuery]           = useState('');
  const [notifications,   setNotifications]   = useState([]);
  const [unreadCount,     setUnreadCount]     = useState(0);
  const notifRef          = useRef(null);

  // Load notifications
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data } = await api.get('/notifications');
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      } catch { }
    };
    load();
    // Poll every 60 seconds
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/recipes/search?q=${encodeURIComponent(query.trim())}`);
    setQuery('');
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const openNotifs = async () => {
    setShowNotifs(s => !s);
    setShowDropdown(false);
    if (unreadCount > 0) {
      try {
        await api.put('/notifications/read-all');
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      } catch { }
    }
  };

  const handleNotifClick = (notif) => {
    setShowNotifs(false);
    if (notif.link) navigate(notif.link);
  };

  const typeIcon = (type) => {
    const icons = {
      like:            '❤️',
      comment:         '💬',
      follow:          '👤',
      community_join:  '👥',
      recipe_shared:   '🍽️',
    };
    return icons[type] || '🔔';
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[60px]
                       bg-[rgba(15,26,18,0.92)] backdrop-blur-[16px]
                       border-b border-[rgba(74,124,89,0.18)] flex items-center">

      {/* Logo */}
      <div className="w-[220px] flex-shrink-0 flex items-center gap-2.5
                      px-5 h-full border-r border-[rgba(74,124,89,0.18)] cursor-pointer"
           onClick={() => navigate('/')}>
        <div className="w-[34px] h-[34px] rounded-[8px] flex-shrink-0
                        bg-gradient-to-br from-sage to-gold
                        flex items-center justify-center font-serif text-[18px] font-bold text-forest">
          N
        </div>
        <span className="font-serif text-[18px] text-cream tracking-[-0.3px]">
          Nutri<span className="text-gold">Hub</span>
        </span>
      </div>

      {/* Search */}
      <div className="flex-1 flex items-center px-6">
        <form onSubmit={handleSearch} className="w-full max-w-[500px]">
          <div className="flex items-center gap-2.5 bg-forest2
                          border border-[rgba(74,124,89,0.18)] rounded-full px-4 py-2
                          focus-within:border-sage transition-colors duration-200">
            <SearchIcon/>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search recipes"
              className="bg-transparent border-none outline-none text-cream
                         text-sm font-sans w-full placeholder:text-muted"
            />
            {query.trim() && (
              <button type="submit"
                      className="text-sage-l hover:text-cream text-xs font-medium transition-colors flex-shrink-0">
                Search
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 pr-5">

        {/* Add recipe */}
        <button onClick={() => navigate('/add-recipe')}
                className="w-9 h-9 rounded-full border border-[rgba(74,124,89,0.25)]
                           text-muted hover:text-cream hover:border-sage
                           flex items-center justify-center transition-all duration-200"
                title="Add recipe">
          <PlusIcon/>
        </button>

        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={openNotifs}
            className="relative w-9 h-9 rounded-full border border-[rgba(74,124,89,0.25)]
                       text-muted hover:text-cream hover:border-sage
                       flex items-center justify-center transition-all duration-200"
            title="Notifications"
          >
            <BellIcon/>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rust
                               text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-80
                            bg-forest2 border border-[rgba(74,124,89,0.25)]
                            rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]
                            z-50 overflow-hidden anim-in">
              <div className="flex items-center justify-between px-4 py-3
                              border-b border-[rgba(74,124,89,0.18)]">
                <p className="text-[14px] font-medium text-cream">Notifications</p>
                {notifications.length > 0 && (
                  <button onClick={async () => {
                            await api.put('/notifications/read-all').catch(()=>{});
                            setUnreadCount(0);
                            setNotifications(p => p.map(n=>({...n,read:true})));
                          }}
                          className="text-[11px] text-muted hover:text-sage-l transition-colors">
                    Mark all read
                  </button>
                )}
              </div>

              <div className="overflow-y-auto max-h-72">
                {notifications.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-2xl mb-2">🔔</p>
                    <p className="text-sm text-muted">No notifications yet</p>
                  </div>
                ) : notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left
                                transition-colors border-b border-[rgba(74,124,89,0.1)] last:border-0
                                hover:bg-forest3 ${!n.read ? 'bg-[rgba(74,124,89,0.07)]' : ''}`}
                  >
                    <span className="text-[18px] flex-shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-cream leading-snug">{n.message}</p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {new Date(n.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-sage flex-shrink-0 mt-1.5"/>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avatar dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowDropdown(s => !s); setShowNotifs(false); }}
            className="w-[34px] h-[34px] rounded-full flex-shrink-0
                       bg-gradient-to-br from-sage to-rust
                       border-2 border-[rgba(74,124,89,0.35)] hover:border-gold
                       flex items-center justify-center text-cream text-[13px] font-semibold
                       overflow-hidden transition-all duration-200"
          >
            {user?.avatarURL
              ? <img src={user.avatarURL} alt="" className="w-full h-full object-cover"/>
              : getInitials(user?.name || '?')
            }
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-48
                            bg-forest2 border border-[rgba(74,124,89,0.25)]
                            rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-1 z-50 anim-in">
              <div className="px-4 py-2.5 border-b border-[rgba(74,124,89,0.18)]">
                <p className="text-[13px] font-medium text-cream truncate">{user?.name}</p>
                <p className="text-[11px] text-muted truncate">{user?.email}</p>
              </div>
              {[
                ['/profile',      <UserIcon/>,     'My Profile'],
                ['/meal-planner', <PlannerIcon/>,  'Meal Planner'],
                ['/saved',        <BookmarkIcon/>, 'Saved Recipes'],
              ].map(([path, icon, label]) => (
                <button key={path} onClick={() => { navigate(path); setShowDropdown(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px]
                                   text-muted hover:text-cream hover:bg-forest3 transition-colors text-left">
                  <span className="w-4 h-4 flex-shrink-0">{icon}</span>{label}
                </button>
              ))}
              <div className="border-t border-[rgba(74,124,89,0.18)] mt-1 pt-1">
                <button onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px]
                                   text-red-400 hover:bg-red-900/20 transition-colors text-left">
                  <span className="w-4 h-4 flex-shrink-0"><LogoutIcon/></span>Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close dropdowns on outside click */}
      {(showDropdown || showNotifs) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowDropdown(false); setShowNotifs(false); }}/>
      )}
    </header>
  );
}

const SearchIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8FA897" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const PlusIcon     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const BellIcon     = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>;
const UserIcon     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const PlannerIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const BookmarkIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>;
const LogoutIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;