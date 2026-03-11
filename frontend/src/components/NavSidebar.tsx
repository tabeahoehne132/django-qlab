import React from 'react'
import './NavSidebar.css'

export type TabId = 'queries' | 'models' | 'saved' | 'history' | 'settings' | 'docs'
export type ThemeMode = 'dark' | 'light'

interface NavSidebarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  theme: ThemeMode
  onThemeToggle: () => void
  projectName?: string
  userInitials?: string
}

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
)

const IconModels = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
  </svg>
)

const IconHistory = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M12 7v5l4 2"/>
  </svg>
)

const IconBookmark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
)

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

const IconDocs = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
)

const IconTheme = ({ theme }: { theme: ThemeMode }) => (
  theme === 'dark' ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a1 1 0 0 1 0 18 9 9 0 1 0 0-18Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
)

const Logo = () => (
  <svg viewBox="0 0 30 30" fill="none" width="30" height="30">
    <rect width="30" height="30" rx="6" fill="#1a1e26"/>
    <path d="M8 15h14M15 8v14" stroke="#4a9eff" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="15" cy="15" r="3.5" stroke="#4a9eff" strokeWidth="1.5"/>
    <circle cx="8"  cy="8"  r="1.5" fill="#4a9eff"/>
    <circle cx="22" cy="8"  r="1.5" fill="#4a9eff"/>
    <circle cx="8"  cy="22" r="1.5" fill="#4a9eff"/>
    <circle cx="22" cy="22" r="1.5" fill="#4a9eff"/>
  </svg>
)

interface NavItemProps {
  tab: TabId
  tip: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

const NavItem: React.FC<NavItemProps> = ({ tip, icon, active, onClick }) => (
  <button
    className={`nav-icon-btn${active ? ' active' : ''}`}
    data-tip={tip}
    data-tour={tip.toLowerCase().replace(/\s+/g, '-')}
    onClick={onClick}
    title={tip}
  >
    {icon}
  </button>
)

export const NavSidebar: React.FC<NavSidebarProps> = ({
  activeTab,
  onTabChange,
  theme,
  onThemeToggle,
  projectName = 'QLAB',
  userInitials = '??',
}) => {
  return (
    <nav className="nav-sidebar">
      <div className="nav-logo">
        <Logo />
      </div>

      <div className="nav-items">
        <NavItem tab="queries"  tip="Queries"       icon={<IconSearch />}   active={activeTab === 'queries'}  onClick={() => onTabChange('queries')} />
        <NavItem tab="models"   tip="Models"        icon={<IconModels />}   active={activeTab === 'models'}   onClick={() => onTabChange('models')} />
        <NavItem tab="saved"    tip="Saved Queries" icon={<IconBookmark />} active={activeTab === 'saved'}    onClick={() => onTabChange('saved')} />
        <NavItem tab="history"  tip="History"       icon={<IconHistory />}  active={activeTab === 'history'}  onClick={() => onTabChange('history')} />
        <div className="nav-divider" />
        <NavItem tab="settings" tip="Settings"      icon={<IconSettings />} active={activeTab === 'settings'} onClick={() => onTabChange('settings')} />
        <NavItem tab="docs"     tip="Documentation" icon={<IconDocs />}     active={activeTab === 'docs'}     onClick={() => onTabChange('docs')} />
      </div>

      <div className="nav-bottom">
        <button
          className="nav-theme-btn"
          onClick={onThemeToggle}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <IconTheme theme={theme} />
        </button>
        <div className="nav-status" title={projectName} />
        <div className="nav-avatar" title={projectName}>{userInitials}</div>
      </div>
    </nav>
  )
}
