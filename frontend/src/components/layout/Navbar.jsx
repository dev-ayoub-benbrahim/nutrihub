import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getInitials } from '../../utils/helpers';

export default function Navbar({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[60px]
                       bg-[rgba(15,26,18,0.92)] backdrop-blur-[16px]
                       border-b border-[rgba(74,124,89,0.18)]
                       flex items-center">

      {/* Logo area */}
      <div className="w-[220px] flex-shrink-0 flex items-center gap-2.5
                      px-5 h-full border-r border-[rgba(74,124,89,0.18)]">
        <div className="w-[34px] h-[34px] rounded-[8px] flex-shrink-0
                        bg-gradient-to-br from-sage to-gold
                        flex items-center justify-center
                        font-serif text-[18px] font-bold text-forest">
          N
        </div>
        <span className="font-serif text-[18px] text-cream tracking-[-0.3px]">
          Nutri<span className="text-gold">Hub</span>
        </span>
      </div>

      {/* Search bar */}
      <div className="flex-1 flex items-center px-6">
        <div className="flex items-center gap-2.5 bg-forest2
                        border border-[rgba(74,124,89,0.18)]
                        rounded-full px-4 py-2 w-full max-w-[500px]
                        focus-within:border-sage transition-colors duration-200">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes, ingredients, chefs..."
            className="bg-transparent border-none outline-none text-cream
                       text-sm font-sans w-full placeholder:text-muted"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 pr-5">
        {/* Add recipe */}
        <button
          onClick={() => navigate('/add-recipe')}
          className="w-9 h-9 rounded-full border border-[rgba(74,124,89,0.25)]
                     text-muted hover:text-cream hover:border-sage
                     flex items-center justify-center transition-all duration-200"
          title="Add recipe"
        >
          <PlusIcon />
        </button>

        {/* Notifications */}
        <button
          className="w-9 h-9 rounded-full border border-[rgba(74,124,89,0.25)]
                     text-muted hover:text-cream hover:border-sage
                     flex items-center justify-center transition-all duration-200"
          title="Notifications"
        >
          <BellIcon />
        </button>

        {/* Avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown((s) => !s)}
            className="w-[34px] h-[34px] rounded-full flex-shrink-0
                       bg-gradient-to-br from-sage to-rust
                       border-2 border-[rgba(74,124,89,0.35)]
                       hover:border-gold flex items-center justify-center
                       text-cream text-[13px] font-semibold
                       transition-all duration-200"
          >
            {user ? getInitials(user.name) : '?'}
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-48
                            bg-forest2 border border-[rgba(74,124,89,0.25)]
                            rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]
                            py-1 z-50 anim-in">
              <div className="px-4 py-2.5 border-b border-[rgba(74,124,89,0.18)]">
                <p className="text-[13px] font-medium text-cream truncate">{user?.name}</p>
                <p className="text-[11px] text-muted truncate">{user?.email}</p>
              </div>
              <DropdownItem onClick={() => { navigate('/profile'); setShowDropdown(false); }} icon={<UserIcon />}>
                My Profile
              </DropdownItem>
              <DropdownItem onClick={() => { navigate('/meal-planner'); setShowDropdown(false); }} icon={<PlannerIcon />}>
                Meal Planner
              </DropdownItem>
              <div className="border-t border-[rgba(74,124,89,0.18)] mt-1 pt-1">
                <DropdownItem onClick={handleLogout} icon={<LogoutIcon />} danger>
                  Sign out
                </DropdownItem>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop to close dropdown */}
      {showDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)}/>
      )}
    </header>
  );
}

function DropdownItem({ children, onClick, icon, danger = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px]
                  transition-colors duration-150 text-left
                  ${danger
                    ? 'text-red-400 hover:bg-red-900/20'
                    : 'text-muted hover:text-cream hover:bg-forest3'
                  }`}
    >
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      {children}
    </button>
  );
}

// Icons
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8FA897" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const BellIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);
const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const PlannerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const LogoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);