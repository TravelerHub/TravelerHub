import { useLocation, useNavigate } from 'react-router-dom';
import {
  MapIcon,
  WalletIcon,
  ChatIcon,
  GalleryIcon,
  ProfileIcon,
} from './icons/NavIcons.jsx';

const tabs = [
  { Icon: MapIcon,     label: 'Map',      path: '/navigation' },
  { Icon: WalletIcon,  label: 'Expenses', path: '/expenses' },
  { Icon: ChatIcon,    label: 'Chat',     path: '/message' },
  { Icon: GalleryIcon, label: 'Gallery',  path: '/gallery' },
  { Icon: ProfileIcon, label: 'Profile',  path: '/profile' },
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
              color: isActive ? '#ffffff' : 'rgba(255,255,255,0.55)',
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
            <tab.Icon size={22} />
            <span className="text-[11px] font-medium leading-none">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
