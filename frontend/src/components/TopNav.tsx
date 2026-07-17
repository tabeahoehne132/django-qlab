import React from 'react'
import { handleRovingKeyDown } from '../lib/keyboardNav'
import './TopNav.css'

export type TabId = 'home' | 'queries' | 'schema' | 'saved' | 'history' | 'docs'
export type ThemeMode = 'dark' | 'light'

interface TopNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  theme: ThemeMode
  onThemeToggle: () => void
  version?: string
}

const IconHome = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M4 11 L12 4 L20 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 10 L6 20 L18 20 L18 10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
)

const IconQueries = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="2" />
    <line x1="14.8" y1="14.8" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const IconSchema = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
    <line x1="3" y1="10.5" x2="21" y2="10.5" stroke="currentColor" strokeWidth="2" />
  </svg>
)

const IconSaved = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
)

const IconHistory = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
    <line x1="12" y1="12" x2="12" y2="7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="12" x2="15.2" y2="13.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const IconDocs = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
    <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.5" />
    <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" />
    <line x1="8" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const IconSun = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
    <line x1="12" y1="2.5" x2="12" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="19" x2="12" y2="21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="2.5" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="19" y1="12" x2="21.5" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="5.3" y1="5.3" x2="7" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="17" y1="17" x2="18.7" y2="18.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="17" y1="7" x2="18.7" y2="5.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="5.3" y1="18.7" x2="7" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const IconMoon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="7" fill="currentColor" />
    <circle cx="15.5" cy="9" r="6.5" fill="var(--bg-app)" />
  </svg>
)

const Logo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginRight: 6 }}>
    <path d="M3 9 L3 3 L9 3" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 3 L21 3 L21 9" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 15 L3 21 L9 21" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 15 L21 21 L15 21" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="10.5" y="10.5" width="3" height="3" fill="var(--accent)" />
  </svg>
)

interface NavItemProps {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

const NavItem: React.FC<NavItemProps> = ({ label, icon, active, onClick }) => (
  <button
    type="button"
    className={`topnav-item${active ? ' active' : ''}`}
    onClick={onClick}
    data-tour={label.toLowerCase()}
    data-roving-item
  >
    {icon}
    <span>{label}</span>
  </button>
)

export const TopNav: React.FC<TopNavProps> = ({ activeTab, onTabChange, theme, onThemeToggle, version }) => {
  const isLight = theme === 'light'

  return (
    <div className="topnav" onKeyDown={(event) => handleRovingKeyDown(event, 'horizontal')}>
      <Logo />
      <span className="topnav-wordmark">
        <span className="topnav-wordmark-accent">Q</span>LAB
      </span>

      <NavItem label="Home" icon={<IconHome />} active={activeTab === 'home'} onClick={() => onTabChange('home')} />
      <NavItem label="Queries" icon={<IconQueries />} active={activeTab === 'queries'} onClick={() => onTabChange('queries')} />
      <NavItem label="Schema" icon={<IconSchema />} active={activeTab === 'schema'} onClick={() => onTabChange('schema')} />
      <NavItem label="Saved" icon={<IconSaved />} active={activeTab === 'saved'} onClick={() => onTabChange('saved')} />
      <NavItem label="History" icon={<IconHistory />} active={activeTab === 'history'} onClick={() => onTabChange('history')} />
      <NavItem label="Docs" icon={<IconDocs />} active={activeTab === 'docs'} onClick={() => onTabChange('docs')} />

      <div className="topnav-spacer" />

      {version && <span className="topnav-version">{version}</span>}

      <button
        type="button"
        className="topnav-theme-btn"
        onClick={onThemeToggle}
        title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {isLight ? <IconSun /> : <IconMoon />}
      </button>
    </div>
  )
}
