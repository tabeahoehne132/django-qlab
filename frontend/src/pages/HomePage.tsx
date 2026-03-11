import React from 'react'
import './HomePage.css'
import { ModelEntry, RecentQuery } from '../components/ContentSidebar'
import { TabId } from '../components/NavSidebar'

interface HomePageProps {
  models: ModelEntry[]
  recentQueries: RecentQuery[]
  activeModel: string
  savedQueryCount: number
  historyCount: number
  onTabChange: (tab: TabId) => void
  onStartTour: () => void
  onModelSelect: (name: string) => void
  onRecentQuerySelect: (query: RecentQuery) => void
}

const FEATURE_ITEMS: Array<{
  eyebrow: string
  desc: string
  cta: string
  tab: TabId
}> = [
  {
    eyebrow: 'Query Builder',
    desc: 'Compose filters, select fields and inspect results without writing Django lookups by hand.',
    cta: 'Open Builder',
    tab: 'queries',
  },
  {
    eyebrow: 'Model Browser',
    desc: 'Explore all registered models, their fields, relations and filterable attributes.',
    cta: 'Browse Models',
    tab: 'models',
  },
  {
    eyebrow: 'Documentation',
    desc: 'API reference, endpoint examples and usage guides available right inside the shell.',
    cta: 'Read Docs',
    tab: 'docs',
  },
]

export const HomePage: React.FC<HomePageProps> = ({
  models,
  recentQueries,
  activeModel,
  savedQueryCount,
  historyCount,
  onTabChange,
  onStartTour,
  onModelSelect,
  onRecentQuerySelect,
}) => {
  const activeModelMeta = models.find((m) => m.name === activeModel) ?? models[0]
  const topModels = [...models].sort((a, b) => b.count - a.count).slice(0, 5)
  const maxCount = topModels[0]?.count || 1

  return (
    <div className="tab-panel active home-page">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="home-hero card animate-in">
        <div className="home-hero-copy">
          <div className="home-kicker">QLab · Django Query Lab</div>
          <h1 className="home-title">
            Query with confidence,
            <span> keep context in view.</span>
          </h1>
          <p className="home-subtitle">
            A packaged Django control surface for interactive querying, saved explorations,
            schema inspection and run history — fast enough for daily investigation,
            structured enough to ship as reusable internal tooling.
          </p>
          <div className="home-actions">
            <button className="btn btn-primary" onClick={() => onTabChange('queries')}>
              Open Query Builder
            </button>
            <button className="btn btn-secondary" onClick={() => onTabChange('models')}>
              Explore Models
            </button>
            <button className="btn btn-ghost home-tour-btn" onClick={onStartTour}>
              Start Tour
            </button>
          </div>
        </div>

        {/* Right panel — only shown on wide viewports via CSS */}
        {activeModelMeta && (
          <div className="home-hero-panel">
            <div className="hero-panel-head">
              <span className="hero-panel-label">Current Context</span>
              <span className="hero-panel-status">live</span>
            </div>

            <div className="hero-model">
              <div className="hero-model-pip" style={{ background: activeModelMeta.color }} />
              <div>
                <div className="hero-model-name">{activeModelMeta.name}</div>
                <div className="hero-model-meta">
                  {activeModelMeta.count.toLocaleString()} records
                </div>
              </div>
            </div>

            <div className="hero-metrics">
              <div>
                <span>Models</span>
                <strong>{models.length}</strong>
              </div>
              <div>
                <span>Saved</span>
                <strong>{savedQueryCount}</strong>
              </div>
              <div>
                <span>History</span>
                <strong>{historyCount}</strong>
              </div>
            </div>

            {topModels.length > 0 && (
              <div className="home-chart-list">
                {topModels.map((model) => (
                  <button
                    key={model.name}
                    className="home-chart-row"
                    onClick={() => onModelSelect(model.name)}
                  >
                    <div className="home-chart-head">
                      <span>{model.name}</span>
                      <strong>{model.count.toLocaleString()}</strong>
                    </div>
                    <div className="home-chart-bar">
                      <span
                        style={{
                          width: `${(model.count / maxCount) * 100}%`,
                          background: model.color,
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {recentQueries.length > 0 && (
              <div className="home-inline-recent">
                {recentQueries.slice(0, 2).map((query) => (
                  <button
                    key={query.title}
                    className="home-query-item"
                    onClick={() => onRecentQuerySelect(query)}
                  >
                    <strong>{query.title}</strong>
                    <span>{query.meta}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Feature Cards ─────────────────────────────────────── */}
      <div className="home-features-row animate-in" style={{ animationDelay: '0.06s' }}>
        {FEATURE_ITEMS.map((item) => (
          <button
            key={item.eyebrow}
            className="home-feature-card"
            onClick={() => onTabChange(item.tab)}
          >
            <span className="home-feature-eyebrow">{item.eyebrow}</span>
            <span className="home-feature-desc">{item.desc}</span>
            <span className="home-feature-cta">{item.cta}</span>
          </button>
        ))}
      </div>

      {/* ── Recent Queries ────────────────────────────────────── */}
      {recentQueries.length > 0 && (
        <div className="card animate-in" style={{ animationDelay: '0.1s' }}>
          <div className="card-header">
            <span className="card-title">Recent Queries</span>
            <div className="card-actions-right">
              <button className="btn btn-ghost" style={{ fontSize: '0.68rem' }} onClick={() => onTabChange('history')}>
                View all
              </button>
            </div>
          </div>
          <div className="home-recents-body">
            {recentQueries.map((query) => (
              <button
                key={query.title}
                className="home-query-item"
                onClick={() => onRecentQuerySelect(query)}
              >
                <strong>{query.title}</strong>
                <span>{query.meta}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
