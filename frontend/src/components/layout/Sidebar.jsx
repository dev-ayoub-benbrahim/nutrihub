import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getInitials } from '../../utils/helpers';


const CompassIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
  </svg>
);

const BrainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 017 4.5A2.5 2.5 0 014.5 7H4a2 2 0 00-2 2 2 2 0 002 2h.5A2.5 2.5 0 017 13.5V14a2 2 0 002 2m3.5-14A2.5 2.5 0 0115 4.5 2.5 2.5 0 0117.5 7H18a2 2 0 012 2 2 2 0 01-2 2h-.5A2.5 2.5 0 0115 13.5V14a2 2 0 01-2 2"/>
    <path d="M9 16v2a2 2 0 002 2h2a2 2 0 002-2v-2"/>
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

const BookmarkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);


const NAV = [
  { path: '/',             label: 'Explore',      icon: <CompassIcon /> },
  { path: '/meal-planner', label: 'Meal Planner', icon: <BrainIcon />   },
  { path: '/communities',  label: 'Communities',  icon: <UsersIcon />   },
  { path: '/saved',        label: 'Saved',        icon: <BookmarkIcon />},
  { path: '/profile',      label: 'My Profile',   icon: <UserIcon />    },
];


export default function Sidebar() {
  const navigate         = useNavigate();
  const location         = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="fixed top-[60px] left-0 bottom-0 w-[220px] z-40
                      bg-[rgba(15,26,18,0.97)]
                      border-r border-[rgba(74,124,89,0.18)]
                      flex flex-col py-5 overflow-y-auto">

      {/* Main navigation */}
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[1.2px]
                      text-muted px-5 pb-2">
          Main
        </p>
        {NAV.map(({ path, label, icon }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={[
                'w-full flex items-center gap-3 px-5 py-[9px] text-[14px]',
                'border-l-2 transition-all duration-200 text-left',
                active
                  ? 'border-l-sage bg-[rgba(74,124,89,0.14)] text-cream font-medium'
                  : 'border-l-transparent text-muted hover:text-cream hover:bg-[rgba(74,124,89,0.07)]',
              ].join(' ')}
            >
              <span className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-gold' : ''}`}>
                {icon}
              </span>
              {label}
            </button>
          );
        })}
      </div>

      {/* User card at bottom */}
      <div className="mt-auto pt-4 px-4 border-t border-[rgba(74,124,89,0.18)]">
        <div
          className="flex items-center gap-2.5 p-2.5 rounded-xl
                     bg-forest2 hover:bg-forest3 cursor-pointer
                     transition-colors duration-200 group"
          onClick={() => navigate('/profile')}
        >
          <div className="w-8 h-8 rounded-full flex-shrink-0
                          bg-gradient-to-br from-sage to-rust
                          flex items-center justify-center
                          text-cream text-[12px] font-bold">
            {user ? getInitials(user.name) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-cream truncate">
              {user?.name || 'User'}
            </p>
            <p className="text-[11px] text-muted">{user?.role || 'USER'}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleLogout(); }}
            className="text-muted hover:text-red-400 transition-colors
                       duration-200 opacity-0 group-hover:opacity-100"
            title="Sign out"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}