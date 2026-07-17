import React from 'react'
import './HomePage.css'

interface ReleaseEntry {
  version: string
  summary: string
}

interface HomeStats {
  totalModels: number
  totalApps: number
  queriesThisWeek: number
  savedQueriesCount: number
}

interface RoadmapItem {
  label: string
  status: 'In progress' | 'Planned'
}

const CURRENT_VERSION = 'v0.4.0'
const CURRENT_RELEASE_DATE = 'Jul 15, 2026'
const CURRENT_RELEASE_NOTES = [
  'Fixed a pagination bug where querying a to-many relation (reverse foreign keys or many-to-many fields) could duplicate or drop rows across pages.',
  'Added aggregations to the query engine — count, sum, avg, min, and max, with optional distinct.',
  "Fixed a server crash when saving a query under a name you'd already used; now shows a clear validation message instead.",
  "Sharing a query now reliably restores its filters, and never leaks fields from a model you don't have access to.",
  'Redesigned the UI: new top navigation, consistent dropdowns, full keyboard/arrow-key navigation, and a responsive layout.',
]

const PREVIOUS_RELEASES: ReleaseEntry[] = [
  { version: 'v0.3.x', summary: 'Frontend integration, model metadata, and pagination fixes.' },
]

const ROADMAP: RoadmapItem[] = [
  { label: 'Custom order_by for query results', status: 'Planned' },
]

interface HomePageProps {
  stats: HomeStats
}

export const HomePage: React.FC<HomePageProps> = ({ stats }) => (
  <div className="home-page">
    <div>
      <div className="home-eyebrow">Current Release</div>
      <div className="home-card">
        <div className="home-release-head">
          <span className="home-release-version">{CURRENT_VERSION}</span>
          <span className="home-release-date">Released {CURRENT_RELEASE_DATE}</span>
        </div>
        <ul className="home-release-notes">
          {CURRENT_RELEASE_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
      <div className="home-history">
        {PREVIOUS_RELEASES.map((release) => (
          <div key={release.version} className="home-history-row">
            <span className="home-history-version">{release.version}</span>
            <span className="home-history-summary">{release.summary}</span>
          </div>
        ))}
      </div>
    </div>

    <div>
      <div className="home-eyebrow">This Environment</div>
      <div className="home-stats-grid">
        <div className="home-stat-card">
          <div className="home-stat-value">{stats.totalModels}</div>
          <div className="home-stat-label">Registered models</div>
        </div>
        <div className="home-stat-card">
          <div className="home-stat-value">{stats.totalApps}</div>
          <div className="home-stat-label">Registered apps</div>
        </div>
        <div className="home-stat-card">
          <div className="home-stat-value">{stats.queriesThisWeek}</div>
          <div className="home-stat-label">Queries run this week</div>
        </div>
        <div className="home-stat-card">
          <div className="home-stat-value">{stats.savedQueriesCount}</div>
          <div className="home-stat-label">Saved queries</div>
        </div>
      </div>
    </div>

    <div>
      <div className="home-eyebrow">Roadmap</div>
      <div className="home-card home-roadmap">
        {ROADMAP.map((item) => (
          <div key={item.label} className="home-roadmap-row">
            <span className="home-roadmap-label">{item.label}</span>
            <span className={`home-roadmap-badge${item.status === 'In progress' ? ' active' : ''}`}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
)
