import React, { useMemo, useState } from 'react'
import { TabId } from './NavSidebar'
import './ContentSidebar.css'

export interface ModelEntry {
  name: string
  count: number
  color: string
  appLabel?: string
  favorite?: boolean
}

export interface RecentQuery {
  title: string
  meta: string
}

export interface SavedQueryNavItem {
  id: number
  name: string
  modelName: string
  updatedAt: string
}

export interface DocsNavItem {
  key: string
  label: string
}

export interface DocsNavGroup {
  label: string
  items: DocsNavItem[]
}

interface SidebarChoice {
  label: string
  count?: number
  color?: string
  active?: boolean
}

interface ContentSidebarProps {
  activeTab: TabId
  models: ModelEntry[]
  recentQueries: RecentQuery[]
  recentModelNames?: string[]
  activeModel?: string
  savedQueries?: SavedQueryNavItem[]
  activeSavedQueryId?: number | null
  historyModelOptions?: Array<{ label: string; count: number }>
  activeHistoryModel?: string
  onHistoryModelSelect?: (model: string) => void
  activeHistoryRange?: 'all' | 'today' | '7d' | '30d'
  onHistoryRangeSelect?: (range: 'all' | 'today' | '7d' | '30d') => void
  settingsItems?: DocsNavItem[]
  activeSettingsKey?: string
  onSettingsSelect?: (key: string) => void
  docsGroups?: DocsNavGroup[]
  activeDocsKey?: string
  onDocsSelect?: (key: string) => void
  onModelSelect: (name: string) => void
  onSavedQuerySelect?: (id: number) => void
  onToggleModelFavorite?: (name: string) => void
  onRecentQuerySelect: (q: RecentQuery) => void
  environment?: string
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase()
}

function groupModels(models: ModelEntry[]) {
  const groups = new Map<string, ModelEntry[]>()
  models.forEach((model) => {
    const key = model.appLabel || 'other'
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)?.push(model)
  })
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, entries]) => ({
      label,
      entries: entries.sort((left, right) => left.name.localeCompare(right.name)),
    }))
}

const FavoriteButton: React.FC<{
  active: boolean
  onClick: () => void
}> = ({ active, onClick }) => (
  <button
    className={`favorite-btn${active ? ' active' : ''}`}
    type="button"
    title={active ? 'Remove favorite' : 'Add favorite'}
    onClick={(event) => {
      event.stopPropagation()
      onClick()
    }}
  >
    ★
  </button>
)

const ModelListItem: React.FC<{
  model: ModelEntry
  active?: boolean
  onSelect: (name: string) => void
  onToggleFavorite?: (name: string) => void
}> = ({ model, active, onSelect, onToggleFavorite }) => (
  <div
    className={`res-item${active ? ' active' : ''}`}
    onClick={() => onSelect(model.name)}
  >
    <div className="res-pip" style={{ background: model.color, color: model.color }} />
    <span className="res-name">{model.name}</span>
    <span className="res-count">{model.count.toLocaleString()}</span>
    {onToggleFavorite && (
      <FavoriteButton active={Boolean(model.favorite)} onClick={() => onToggleFavorite(model.name)} />
    )}
  </div>
)

const ModelSearch: React.FC<{
  value: string
  onChange: (value: string) => void
}> = ({ value, onChange }) => (
  <input
    className="sidebar-search"
    placeholder="Search models"
    value={value}
    onChange={(event) => onChange(event.target.value)}
  />
)

export const ContentSidebar: React.FC<ContentSidebarProps> = ({
  activeTab,
  models,
  recentQueries,
  recentModelNames = [],
  activeModel,
  savedQueries = [],
  activeSavedQueryId,
  historyModelOptions = [],
  activeHistoryModel,
  onHistoryModelSelect,
  activeHistoryRange,
  onHistoryRangeSelect,
  settingsItems = [],
  activeSettingsKey,
  onSettingsSelect,
  docsGroups = [],
  activeDocsKey,
  onDocsSelect,
  onModelSelect,
  onSavedQuerySelect,
  onToggleModelFavorite,
  onRecentQuerySelect,
  environment = 'LOCAL · DEV',
}) => {
  return (
    <aside className="content-sidebar">
      <div className="csidebar-head">
        <div className="csidebar-context">Environment</div>
        <div className="csidebar-env">
          <div className="env-dot" />
          {environment}
        </div>
      </div>

      {activeTab === 'queries' && (
        <QueriesSidebarPanel
          models={models}
          recentQueries={recentQueries}
          recentModelNames={recentModelNames}
          activeModel={activeModel}
          onModelSelect={onModelSelect}
          onToggleModelFavorite={onToggleModelFavorite}
          onRecentQuerySelect={onRecentQuerySelect}
        />
      )}

      {activeTab === 'models' && (
        <ModelsSidebarPanel
          models={models}
          recentModelNames={recentModelNames}
          activeModel={activeModel}
          onModelSelect={onModelSelect}
          onToggleModelFavorite={onToggleModelFavorite}
        />
      )}

      {activeTab === 'saved' && (
        <SavedSidebarPanel
          queries={savedQueries}
          activeId={activeSavedQueryId}
          onSelect={onSavedQuerySelect}
        />
      )}

      {activeTab === 'history' && (
        <HistorySidebarPanel
          modelOptions={historyModelOptions}
          activeModel={activeHistoryModel || 'all'}
          onSelectModel={onHistoryModelSelect}
          activeRange={activeHistoryRange || 'all'}
          onSelectRange={onHistoryRangeSelect}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsSidebarPanel
          items={settingsItems}
          activeKey={activeSettingsKey}
          onSelect={onSettingsSelect}
        />
      )}

      {activeTab === 'docs' && (
        <DocsSidebarPanel
          groups={docsGroups}
          activeKey={activeDocsKey}
          onSelect={onDocsSelect}
        />
      )}
    </aside>
  )
}

interface QueryModelPanelProps {
  models: ModelEntry[]
  recentModelNames: string[]
  activeModel?: string
  onModelSelect: (name: string) => void
  onToggleModelFavorite?: (name: string) => void
}

const QueryModelPanel: React.FC<QueryModelPanelProps> = ({
  models,
  recentModelNames,
  activeModel,
  onModelSelect,
  onToggleModelFavorite,
}) => {
  const [search, setSearch] = useState('')
  const query = normalizeQuery(search)

  const filteredModels = useMemo(() => (
    models.filter((model) => {
      if (!query) {
        return true
      }
      return model.name.toLowerCase().includes(query) || (model.appLabel || '').toLowerCase().includes(query)
    })
  ), [models, query])

  const favoriteNames = new Set(filteredModels.filter((model) => model.favorite).map((model) => model.name))
  const favorites = filteredModels.filter((model) => favoriteNames.has(model.name))
  const recentModels = recentModelNames
    .map((name) => filteredModels.find((model) => model.name === name))
    .filter((model): model is ModelEntry => model !== undefined)
    .filter((model) => !favoriteNames.has(model.name))
  const grouped = groupModels(filteredModels)

  return (
    <div>
      <ModelSearch value={search} onChange={setSearch} />

      {favorites.length > 0 && (
        <>
          <div className="sidebar-label">Favorites</div>
          {favorites.map((model) => (
            <ModelListItem
              key={model.name}
              model={model}
              active={activeModel === model.name}
              onSelect={onModelSelect}
              onToggleFavorite={onToggleModelFavorite}
            />
          ))}
          <div className="sidebar-divider" />
        </>
      )}

      {recentModels.length > 0 && (
        <>
          <div className="sidebar-label">Recent Models</div>
          {recentModels.map((model) => (
            <ModelListItem
              key={model.name}
              model={model}
              active={activeModel === model.name}
              onSelect={onModelSelect}
              onToggleFavorite={onToggleModelFavorite}
            />
          ))}
          <div className="sidebar-divider" />
        </>
      )}

      <div className="sidebar-label">All Models</div>
      {grouped.length === 0 && <div className="sidebar-empty">No models match.</div>}
      {grouped.map((group) => (
        <div key={group.label} className="model-group">
          <div className="sidebar-subgroup">{group.label}</div>
          {group.entries.map((model) => (
            <ModelListItem
              key={model.name}
              model={model}
              active={activeModel === model.name}
              onSelect={onModelSelect}
              onToggleFavorite={onToggleModelFavorite}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface QueriesSidebarPanelProps extends QueryModelPanelProps {
  recentQueries: RecentQuery[]
  onRecentQuerySelect: (q: RecentQuery) => void
}

const QueriesSidebarPanel: React.FC<QueriesSidebarPanelProps> = ({
  models,
  recentQueries,
  recentModelNames,
  activeModel,
  onModelSelect,
  onToggleModelFavorite,
  onRecentQuerySelect,
}) => (
  <div className="sidebar-panel active">
    <div className="csidebar-body">
      <QueryModelPanel
        models={models}
        recentModelNames={recentModelNames}
        activeModel={activeModel}
        onModelSelect={onModelSelect}
        onToggleModelFavorite={onToggleModelFavorite}
      />
      <div className="sidebar-divider" />
      <div>
        <div className="sidebar-label">Recent Queries</div>
        {recentQueries.map((query, index) => (
          <div
            key={`${query.title}-${index}`}
            className="recent-item"
            onClick={() => onRecentQuerySelect(query)}
          >
            <div className="recent-title">{query.title}</div>
            <div className="recent-meta">{query.meta}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
)

interface ModelsSidebarPanelProps extends QueryModelPanelProps {}

const ModelsSidebarPanel: React.FC<ModelsSidebarPanelProps> = ({
  models,
  recentModelNames,
  activeModel,
  onModelSelect,
  onToggleModelFavorite,
}) => (
  <div className="sidebar-panel active">
    <div className="csidebar-body">
      <QueryModelPanel
        models={models}
        recentModelNames={recentModelNames}
        activeModel={activeModel}
        onModelSelect={onModelSelect}
        onToggleModelFavorite={onToggleModelFavorite}
      />
    </div>
  </div>
)

const PassiveSidebarItem: React.FC<{ item: SidebarChoice }> = ({ item }) => (
  <div className={`res-item${item.active ? ' active' : ''}`}>
    {item.color && <div className="res-pip" style={{ background: item.color, color: item.color }} />}
    <span className="res-name">{item.label}</span>
    {typeof item.count === 'number' && <span className="res-count">{item.count}</span>}
  </div>
)

const HistorySidebarPanel: React.FC<{
  modelOptions: Array<{ label: string; count: number }>
  activeModel: string
  onSelectModel?: (model: string) => void
  activeRange: 'all' | 'today' | '7d' | '30d'
  onSelectRange?: (range: 'all' | 'today' | '7d' | '30d') => void
}> = ({ modelOptions, activeModel, onSelectModel, activeRange, onSelectRange }) => (
  <div className="sidebar-panel active">
    <div className="csidebar-body">
      <div>
        <div className="sidebar-label">Filter by Model</div>
        <div onClick={() => onSelectModel?.('all')}>
          <PassiveSidebarItem
            item={{ label: 'All Models', active: activeModel === 'all', color: 'var(--muted)' }}
          />
        </div>
        {modelOptions.map((item) => (
          <div key={item.label} onClick={() => onSelectModel?.(item.label)}>
            <PassiveSidebarItem item={{ label: item.label, count: item.count, active: activeModel === item.label }} />
          </div>
        ))}
      </div>
      <div className="sidebar-divider" />
      <div>
        <div className="sidebar-label">Time Range</div>
        <div onClick={() => onSelectRange?.('all')}><PassiveSidebarItem item={{ label: 'All Time', active: activeRange === 'all' }} /></div>
        <div onClick={() => onSelectRange?.('today')}><PassiveSidebarItem item={{ label: 'Today', active: activeRange === 'today' }} /></div>
        <div onClick={() => onSelectRange?.('7d')}><PassiveSidebarItem item={{ label: 'Last 7 days', active: activeRange === '7d' }} /></div>
        <div onClick={() => onSelectRange?.('30d')}><PassiveSidebarItem item={{ label: 'Last 30 days', active: activeRange === '30d' }} /></div>
      </div>
    </div>
  </div>
)

const SavedSidebarPanel: React.FC<{
  queries: SavedQueryNavItem[]
  activeId?: number | null
  onSelect?: (id: number) => void
}> = ({ queries, activeId, onSelect }) => (
  <div className="sidebar-panel active">
    <div className="csidebar-body">
      <div>
        <div className="sidebar-label">Saved Queries</div>
        {queries.length === 0 && <div className="sidebar-empty">No saved queries yet.</div>}
        {queries.map((query) => (
          <div
            key={query.id}
            className={`recent-item saved-query-item${activeId === query.id ? ' active' : ''}`}
            onClick={() => onSelect?.(query.id)}
          >
            <div className="recent-title">{query.name}</div>
            <div className="recent-meta">{query.modelName} · {new Date(query.updatedAt).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
    <div className="csidebar-footer">
      <div className="info-box">
        <strong>Tip</strong>
        Save useful builder states here and reopen them in one click.
      </div>
    </div>
  </div>
)

const SettingsSidebarPanel: React.FC<{
  items: DocsNavItem[]
  activeKey?: string
  onSelect?: (key: string) => void
}> = ({ items, activeKey, onSelect }) => (
  <div className="sidebar-panel active">
    <div className="csidebar-body">
      <div>
        <div className="sidebar-label">Settings</div>
        {items.map((item) => (
          <div
            key={item.key}
            className={`res-item${activeKey === item.key ? ' active' : ''}`}
            onClick={() => onSelect?.(item.key)}
          >
            <span className="res-name">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="csidebar-footer">
      <div className="info-box">
        <strong>v0.1.0</strong>
        django-qlab · MIT License
      </div>
    </div>
  </div>
)

const DocsSidebarPanel: React.FC<{
  groups: DocsNavGroup[]
  activeKey?: string
  onSelect?: (key: string) => void
}> = ({ groups, activeKey, onSelect }) => (
  <div className="sidebar-panel active docs-sidebar-panel">
    <div className="csidebar-body docs-sidebar-body">
      {groups.map((group, index) => (
        <React.Fragment key={group.label}>
          {index > 0 && <div className="sidebar-divider docs-sidebar-divider" />}
          <div className="docs-sidebar-group">
            <div className="sidebar-label">{group.label}</div>
            {group.items.map((item) => (
              <div
                key={item.key}
                className={`res-item${activeKey === item.key ? ' active' : ''}`}
                onClick={() => onSelect?.(item.key)}
              >
                <span className="res-name">{item.label}</span>
              </div>
            ))}
          </div>
        </React.Fragment>
      ))}
    </div>
  </div>
)
