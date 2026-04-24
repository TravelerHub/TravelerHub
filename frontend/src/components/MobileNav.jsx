import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { icon: '🗺️', label: 'Map',      path: '/navigation' },
  { icon: '💰', label: 'Expenses', path: '/expenses' },
  { icon: '💬', label: 'Chat',     path: '/message' },
  { icon: '🖼️', label: 'Gallery',  path: '/gallery' },
  { icon: '👤', label: 'Profile',  path: '/profile' },
];

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        background: '#183a37',
        height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
            style={{
              color: isActive ? '#ffffff' : 'rgba(255,255,255,0.5)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {/* Active indicator dot above icon */}
            {isActive && (
              <span
                className="absolute"
                style={{
                  top: 6,
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: '#ffffff',
                }}
              />
            )}
            <span className="text-xl leading-none">{tab.icon}</span>
            <span className="text-xs font-medium leading-none">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
