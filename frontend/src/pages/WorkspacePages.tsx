import React from 'react'
import { ModelEntry } from '../components/ContentSidebar'
import { MetadataResponse, SavedQuery } from '../lib/api'
import './WorkspacePages.css'

interface ModelField {
  name: string
  type: string
  nullable: boolean
  filterable: boolean
  notes: string
}

interface ModelRelation {
  direction: string
  target: string
  field: string
  kind: 'fk' | 'm2m' | 'rev'
}

interface ModelDetail extends ModelEntry {
  description: string
  tags: string[]
  fields: ModelField[]
  relations: ModelRelation[]
}

interface ModelsPageProps {
  models: ModelDetail[]
  activeModel: string
  activeMetadata?: MetadataResponse
  onRequestMetadata?: (modelName: string, appLabel?: string) => Promise<MetadataResponse>
  onQueryModel?: (modelName: string) => void
}

interface HistoryItem {
  id: string | number
  title: string
  model: string
  modelLabel?: string
  filters: string
  ranAt: string
  duration: string
  status: 'ok' | 'cached' | 'draft' | 'failed'
  queryPayload?: Record<string, unknown>
}

interface HistoryPageProps {
  historyItems: HistoryItem[]
  onReplayQuery: (query: HistoryItem) => void
  onSaveQuery: (query: HistoryItem) => Promise<void>
}

interface SettingsItem {
  label: string
  description: string
  control: React.ReactNode
}

interface SettingsGroup {
  key: string
  title: string
  items: SettingsItem[]
}

interface SettingsPageProps {
  sections: SettingsGroup[]
  activeSettingsKey: string
}

interface DocsEndpoint {
  method: 'GET' | 'POST'
  path: string
  description: string
}

interface DocsParam {
  name: string
  type: string
  description: string
}

interface DocsEntry {
  key: string
  section: string
  title: string
  tagline: string
  intro: string
  endpoints: DocsEndpoint[]
  params: DocsParam[]
  code: string
}

interface DocsPageProps {
  docs: DocsEntry[]
  activeDocKey: string
}

interface SavedQueriesPageProps {
  savedQueries: Array<SavedQuery & { display_name?: string; display_model_name?: string }>
  activeSavedQueryId: number | null
  onSelectSavedQuery: (id: number) => void
  onUpdateSavedQuery: (id: number, payload: Partial<SavedQuery>) => Promise<void>
  onDeleteSavedQuery: (id: number) => Promise<void>
  onOpenInBuilder: (query: SavedQuery) => void
  onRunSavedQuery: (query: SavedQuery) => Promise<void>
}

const statusClass = {
  ok: 'badge-active',
  cached: 'badge-prov',
  draft: 'badge-maint',
  failed: 'badge-offline',
} as const

const RELATION_TYPES = new Set(['foreignkey', 'onetoone', 'manytomany', 'reverse_relation'])

const asDisplayString = (value: unknown) =>
  typeof value === 'string' ? value : value == null ? '' : String(value)

const splitModelIdentifier = (value: unknown) =>
  asDisplayString(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()

const titleCaseWords = (value: unknown) =>
  asDisplayString(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const getReadableModelLabel = (modelName: string, fallback?: string) =>
  titleCaseWords((fallback || splitModelIdentifier(modelName)).trim())

const getDirectMetadataFields = (metadata?: MetadataResponse) =>
  metadata ? metadata.fields.filter((field) => !field.name.includes('__')) : []

const isRelationMetadataField = (field: MetadataResponse['fields'][number]) =>
  RELATION_TYPES.has(field.type) && Boolean(field.related_model)

const buildFieldNotes = (field: MetadataResponse['fields'][number]) => {
  const notes: string[] = []
  if (field.primary_key) notes.push('Primary key')
  if (field.max_length) notes.push(`max_length=${field.max_length}`)
  if (field.related_model) {
    notes.push(`${field.type === 'reverse_relation' ? '←' : '→'} ${field.related_model}`)
  }
  if (field.filter_name) notes.push(`filter: ${field.filter_name}`)
  if (field.choices?.length) {
    notes.push(`choices: ${field.choices.map((choice) => choice.label).join(', ')}`)
  }
  return notes.join(' · ')
}

type MetadataFieldLike = MetadataResponse['fields'][number]

interface RelationSummary {
  key: string
  fieldName: string
  targetModel: string
  targetAppLabel?: string
  kind: 'fk' | 'm2m' | 'rev'
}

const getRelationKind = (field: MetadataFieldLike): RelationSummary['kind'] => (
  field.type === 'reverse_relation'
    ? 'rev'
    : field.type === 'manytomany'
      ? 'm2m'
      : 'fk'
)

const buildRelations = (metadata?: MetadataResponse): RelationSummary[] =>
  getDirectMetadataFields(metadata)
    .filter((field) => isRelationMetadataField(field))
    .map((field) => ({
      key: `${field.name}:${field.related_model}:${field.related_app_label || metadata?.app_label || ''}`,
      fieldName: field.filter_name || field.name,
      targetModel: field.related_model || '',
      targetAppLabel: field.related_app_label || metadata?.app_label,
      kind: getRelationKind(field),
    }))

interface ModelInspectPanelProps {
  modelName: string
  modelLabel: string
  appLabel?: string
  metadata?: MetadataResponse
  modelsIndex: Map<string, ModelDetail>
  onRequestMetadata: (modelName: string, appLabel?: string) => Promise<MetadataResponse>
  onQueryModel?: (modelName: string) => void
  level?: number
  root?: boolean
}

const ModelInspectPanel: React.FC<ModelInspectPanelProps> = ({
  modelName,
  modelLabel,
  appLabel,
  metadata,
  modelsIndex,
  onRequestMetadata,
  onQueryModel,
  level = 0,
  root = false,
}) => {
  const [resolvedMetadata, setResolvedMetadata] = React.useState<MetadataResponse | undefined>(metadata)
  const [isLoading, setIsLoading] = React.useState(!metadata)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [expandedKeys, setExpandedKeys] = React.useState<string[]>([])
  const [nestedMetadata, setNestedMetadata] = React.useState<Record<string, MetadataResponse>>({})
  const [nestedLoading, setNestedLoading] = React.useState<Record<string, boolean>>({})
  const [nestedErrors, setNestedErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    setResolvedMetadata(metadata)
    setIsLoading(!metadata)
    setLoadError(null)
    setExpandedKeys([])
    setNestedMetadata({})
    setNestedLoading({})
    setNestedErrors({})
  }, [metadata, modelName, appLabel])

  React.useEffect(() => {
    if (metadata || !modelName) {
      return
    }

    let active = true
    setIsLoading(true)
    setLoadError(null)

    void onRequestMetadata(modelName, appLabel)
      .then((response) => {
        if (active) {
          setResolvedMetadata(response)
        }
      })
      .catch((error) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Could not load model metadata.')
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [appLabel, metadata, modelName, onRequestMetadata])

  const directFields = React.useMemo(
    () => getDirectMetadataFields(resolvedMetadata),
    [resolvedMetadata],
  )
  const relations = React.useMemo(
    () => buildRelations(resolvedMetadata),
    [resolvedMetadata],
  )

  const toggleRelation = async (relation: RelationSummary) => {
    setExpandedKeys((current) =>
      current.includes(relation.key)
        ? current.filter((key) => key !== relation.key)
        : [...current, relation.key],
    )

    if (nestedMetadata[relation.key] || nestedLoading[relation.key]) {
      return
    }

    setNestedLoading((current) => ({ ...current, [relation.key]: true }))
    setNestedErrors((current) => ({ ...current, [relation.key]: '' }))

    try {
      const response = await onRequestMetadata(relation.targetModel, relation.targetAppLabel)
      setNestedMetadata((current) => ({ ...current, [relation.key]: response }))
    } catch (error) {
      setNestedErrors((current) => ({
        ...current,
        [relation.key]: error instanceof Error ? error.message : 'Could not load relation metadata.',
      }))
    } finally {
      setNestedLoading((current) => ({ ...current, [relation.key]: false }))
    }
  }

  return (
    <div className={`card models-card${root ? ' root-model-card' : ' nested-model-card'} level-${level}`}>
      <div className="card-header">
        <span className="card-title">
          <span className="card-title-accent">{root ? '▸' : '↳'}</span> {modelLabel}
        </span>
        <div className="card-actions-right">
          <button className="query-hint-btn" onClick={() => onQueryModel?.(modelName)}>
            Query this Model →
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card-body">
          <div className="empty-state">Loading model metadata…</div>
        </div>
      ) : loadError ? (
        <div className="card-body">
          <div className="compact-error">{loadError}</div>
        </div>
      ) : resolvedMetadata ? (
        <>
          <div className="result-tabs">
            <button className="rtab active">Selectable Fields</button>
          </div>
          <div className="table-scroll">
            <table className="field-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Null</th>
                  <th>Filterable</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {directFields.map((field) => (
                  <tr key={field.name}>
                    <td className="field-name">{field.name}</td>
                    <td className="field-type">{field.type}</td>
                    <td className="field-null">{field.required ? '—' : 'nullable'}</td>
                    <td className={field.allowed_operations.length > 0 ? 'field-filter-yes' : 'field-filter-no'}>
                      {field.allowed_operations.length > 0 ? '✓ yes' : '✗ no'}
                    </td>
                    <td className="td-plain">{buildFieldNotes(field)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card relation-card relation-card-inline">
            <div className="card-header">
              <span className="card-title">
                <span className="card-title-accent">▸</span> Relations
              </span>
            </div>
            <div>
              {relations.length === 0 && <div className="empty-state compact">No direct relations.</div>}
              {relations.map((relation) => {
                const isExpanded = expandedKeys.includes(relation.key)
                const nested = nestedMetadata[relation.key]
                const nestedLabel =
                  modelsIndex.get(`${relation.targetAppLabel || ''}:${relation.targetModel}`)?.displayName ||
                  getReadableModelLabel(relation.targetModel)

                return (
                  <div key={relation.key} className="relation-block">
                    <button
                      type="button"
                      className={`relation-row relation-toggle${isExpanded ? ' expanded' : ''}`}
                      onClick={() => void toggleRelation(relation)}
                    >
                      <span
                        className={
                          relation.kind === 'fk'
                            ? 'badge badge-fk'
                            : relation.kind === 'm2m'
                              ? 'badge badge-m2m'
                              : 'badge badge-offline'
                        }
                      >
                        {relation.kind === 'fk' ? 'FK →' : relation.kind === 'm2m' ? 'M2M ↔' : '← REV'}
                      </span>
                      <span className="relation-arrow">{modelLabel}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      <span className="relation-target">{nestedLabel}</span>
                      <span className="relation-field">{relation.fieldName}</span>
                      <span className="relation-expand">{isExpanded ? '−' : '+'}</span>
                    </button>

                    {isExpanded && (
                      <div className="nested-model-panels">
                        {nestedLoading[relation.key] && (
                          <div className="empty-state compact">Loading related model…</div>
                        )}
                        {!nestedLoading[relation.key] && nestedErrors[relation.key] && (
                          <div className="compact-error">{nestedErrors[relation.key]}</div>
                        )}
                        {!nestedLoading[relation.key] && nested && (
                          <ModelInspectPanel
                            modelName={relation.targetModel}
                            modelLabel={nestedLabel}
                            appLabel={relation.targetAppLabel}
                            metadata={nested}
                            modelsIndex={modelsIndex}
                            onRequestMetadata={onRequestMetadata}
                            onQueryModel={onQueryModel}
                            level={level + 1}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

export const ModelsPage: React.FC<ModelsPageProps> = ({
  models,
  activeModel,
  activeMetadata,
  onRequestMetadata,
  onQueryModel,
}) => {
  const active = models.find((model) => model.name === activeModel) ?? models[0]
  const modelsIndex = React.useMemo(
    () =>
      new Map(
        models.map((model) => [`${model.appLabel || ''}:${model.name}`, model] as const),
      ),
    [models],
  )

  if (!active || !onRequestMetadata) {
    return (
      <div className="tab-panel active workspace-page">
        <div className="empty-state">No model metadata available yet.</div>
      </div>
    )
  }

  return (
    <div className="tab-panel active workspace-page models-page">
      <div className="animate-in">
        <div className="page-title-row">
          <h1 className="page-title">MO<span>dels</span></h1>
        </div>
        <div className="page-subtitle">browse · inspect · relate</div>
      </div>

      <div className="workspace-stack models-stack animate-in">
        <ModelInspectPanel
          modelName={active.name}
          modelLabel={active.displayName || getReadableModelLabel(active.name)}
          appLabel={active.appLabel}
          metadata={activeMetadata}
          modelsIndex={modelsIndex}
          onRequestMetadata={onRequestMetadata}
          onQueryModel={onQueryModel}
          root
        />
      </div>
    </div>
  )
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ historyItems, onReplayQuery, onSaveQuery }) => {
  const [search, setSearch] = React.useState('')
  const [filter, setFilter] = React.useState<'all' | 'errors' | 'saved'>('all')
  const [selectedIds, setSelectedIds] = React.useState<Array<string | number>>([])

  const filteredItems = historyItems.filter((item) => {
    if (filter === 'errors' && item.status !== 'failed') {
      return false
    }
    if (filter === 'saved' && item.status !== 'cached') {
      return false
    }
    const query = search.trim().toLowerCase()
    if (!query) {
      return true
    }
    return `${item.title} ${item.model} ${item.filters}`.toLowerCase().includes(query)
  })

  React.useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filteredItems.some((item) => item.id === id)))
  }, [historyItems.length, filteredItems.length])

  const toggleSelected = (id: string | number) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  return (
    <div className="tab-panel active workspace-page">
      <div className="animate-in">
        <div className="page-title-row">
          <h1 className="page-title">HIST<span>ory</span></h1>
        </div>
        <div className="page-subtitle">recent · replay · export</div>
      </div>

      <div className="card animate-in history-card">
        <div className="card-header">
          <span className="card-title">Run <span className="card-title-accent">History</span></span>
          {selectedIds.length > 0 && (
            <div className="card-actions-right">
              <button
                className="btn btn-secondary"
                onClick={async () => {
                  await Promise.all(
                    filteredItems
                      .filter((item) => selectedIds.includes(item.id))
                      .map((item) => onSaveQuery(item)),
                  )
                  setSelectedIds([])
                }}
              >
                Save Selected ({selectedIds.length})
              </button>
            </div>
          )}
        </div>
        <div className="card-body history-toolbar">
          <div className="history-filters">
            <button className={`hfilter-chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>All</button>
            <button className={`hfilter-chip${filter === 'errors' ? ' active' : ''}`} onClick={() => setFilter('errors')}>Errors</button>
            <button className={`hfilter-chip${filter === 'saved' ? ' active' : ''}`} onClick={() => setFilter('saved')}>Saved Query Runs</button>
          </div>
          <input className="history-search" placeholder="Search history" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="history-list">
          {filteredItems.map((item) => (
            <div key={item.id} className="history-item">
              <input
                type="checkbox"
                className="bulk-checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => toggleSelected(item.id)}
              />
              <span className={`history-status-dot ${statusClass[item.status]}`} />
              <div className="history-main">
                <div className="history-query-name">{item.title || `${item.modelLabel || item.model} query`}</div>
                <div className="history-query-params">{item.modelLabel || item.model} · {item.filters}</div>
              </div>
              <div className="history-meta">
                <span className="history-time">{item.ranAt}</span>
                <span className="history-duration">{item.duration}</span>
              </div>
              <div className="history-actions">
                <button className="h-action-btn replay" onClick={() => onReplayQuery(item)}>
                  Replay
                </button>
                <button className="h-action-btn" onClick={() => void onSaveQuery(item)}>
                  Save
                </button>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && <div className="empty-state">No matching history entries.</div>}
        </div>
      </div>
    </div>
  )
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ sections, activeSettingsKey }) => {
  const section = sections.find((item) => item.key === activeSettingsKey) ?? sections[0]

  return (
    <div className="tab-panel active workspace-page">
      <div className="animate-in">
        <div className="page-title-row">
          <h1 className="page-title">SET<span>tings</span></h1>
        </div>
        <div className="page-subtitle">configure · restrict · tune</div>
      </div>

      <div className="workspace-stack animate-in saved-queries-stack">
        <div className="card saved-queries-card settings-card">
          <div className="card-header">
            <span className="card-title">{section.title}</span>
          </div>
          <div className="card-body settings-content">
            <div className="settings-section-title">{section.title}</div>
            {section.items.map((item) => (
              <div key={item.label} className="setting-row">
                <div className="setting-info">
                  <div className="setting-label">{item.label}</div>
                  <div className="setting-desc">{item.description}</div>
                </div>
                <div className="setting-control">{item.control}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export const DocsPage: React.FC<DocsPageProps> = ({ docs, activeDocKey }) => {
  const entry = docs.find((doc) => doc.key === activeDocKey) ?? docs[0]

  return (
    <div className="tab-panel active workspace-page">
      <div className="animate-in">
        <div className="page-title-row">
          <h1 className="page-title">DO<span>cs</span></h1>
        </div>
        <div className="page-subtitle">reference · examples · guides</div>
      </div>

      <div className="workspace-stack animate-in docs-stack">
        <div className="card docs-card">
          <div className="card-body docs-content docs-content-single">
            <div className="docs-h1">
              {entry.title.split(' ')[0]} <span>{entry.title.split(' ').slice(1).join(' ')}</span>
            </div>
            <div className="docs-tagline">{entry.tagline}</div>

            <div className="docs-h2">Overview</div>
            <p className="docs-p">{entry.intro}</p>

            <div className="docs-h2">Endpoints</div>
            {entry.endpoints.map((endpoint) => (
              <div key={`${endpoint.method}-${endpoint.path}`} className="docs-endpoint">
                <span className={`docs-method ${endpoint.method === 'GET' ? 'method-get' : 'method-post'}`}>
                  {endpoint.method}
                </span>
                <span className="docs-endpoint-path">{endpoint.path}</span>
                <span className="docs-endpoint-desc">{endpoint.description}</span>
              </div>
            ))}

            <div className="docs-h2">Parameters</div>
            <table className="docs-param-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {entry.params.map((param) => (
                  <tr key={param.name}>
                    <td className="param-name">{param.name}</td>
                    <td className="param-type">{param.type}</td>
                    <td className="param-desc">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="docs-h2">Example</div>
            <pre className="docs-code-block">
              <span className="copy-hint">copy</span>
              <code>{entry.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export const SavedQueriesPage: React.FC<SavedQueriesPageProps> = ({
  savedQueries,
  activeSavedQueryId,
  onSelectSavedQuery,
  onUpdateSavedQuery,
  onDeleteSavedQuery,
  onOpenInBuilder,
  onRunSavedQuery,
}) => {
  const activeQuery = savedQueries.find((item) => item.id === activeSavedQueryId) ?? savedQueries[0] ?? null
  const [activeName, setActiveName] = React.useState(activeQuery?.name || '')
  const [activeDescription, setActiveDescription] = React.useState(activeQuery?.description || '')
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])

  React.useEffect(() => {
    setActiveName(activeQuery?.name || '')
    setActiveDescription(activeQuery?.description || '')
  }, [activeQuery])

  React.useEffect(() => {
    setSelectedIds((current) => current.filter((id) => savedQueries.some((item) => item.id === id)))
  }, [savedQueries.length])

  return (
    <div className="tab-panel active workspace-page">
      <div className="animate-in">
        <div className="page-title-row">
          <h1 className="page-title">SAV<span>ed</span></h1>
        </div>
        <div className="page-subtitle">store · reopen · reuse</div>
      </div>

      <div className="workspace-stack animate-in">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Saved <span className="card-title-accent">Queries</span></span>
            {selectedIds.length > 0 && (
              <div className="card-actions-right">
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    await Promise.all(selectedIds.map((id) => onDeleteSavedQuery(id)))
                    setSelectedIds([])
                  }}
                >
                  Delete Selected ({selectedIds.length})
                </button>
              </div>
            )}
          </div>
          <div className="card-body saved-queries-card-body saved-query-layout">
            <div className="saved-query-list">
              {savedQueries.length === 0 && <div className="empty-state">No saved queries yet.</div>}
              {savedQueries.map((query) => (
                <div
                  key={query.id}
                  className={`saved-query-list-item${activeQuery?.id === query.id ? ' active' : ''}`}
                  onClick={() => onSelectSavedQuery(query.id)}
                >
                  <input
                    type="checkbox"
                    className="bulk-checkbox"
                    checked={selectedIds.includes(query.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => setSelectedIds((current) => (
                      current.includes(query.id)
                        ? current.filter((id) => id !== query.id)
                        : [...current, query.id]
                    ))}
                  />
                  <div className="saved-query-list-copy">
                    <span className="saved-query-list-name">{query.display_name || query.name}</span>
                    <span className="saved-query-list-meta">{query.display_model_name || query.model_name} · {new Date(query.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="saved-query-detail">
              {activeQuery ? (
                <>
                  <div className="saved-query-detail-meta">
                    <span className="saved-query-detail-model">Model: {activeQuery.display_model_name || activeQuery.model_name}</span>
                  </div>
                  <div className="saved-query-form-grid">
                    <label className="saved-query-field">
                      <span className="saved-query-field-label">Name</span>
                      <input className="setting-input saved-query-input saved-query-input-left" value={activeName} onChange={(event) => setActiveName(event.target.value)} />
                    </label>
                    <label className="saved-query-field saved-query-field-full">
                      <span className="saved-query-field-label">Description</span>
                      <textarea className="setting-textarea" value={activeDescription} onChange={(event) => setActiveDescription(event.target.value)} />
                    </label>
                  </div>
                  <div className="saved-query-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => void onUpdateSavedQuery(activeQuery.id, {
                        name: activeName.trim(),
                        description: activeDescription.trim(),
                      })}
                    >
                      Update
                    </button>
                    <button className="btn btn-ghost" onClick={() => onOpenInBuilder(activeQuery)}>Open in Builder</button>
                    <button className="btn btn-ghost" onClick={() => void onRunSavedQuery(activeQuery)}>Run</button>
                    <button className="btn btn-danger" onClick={() => void onDeleteSavedQuery(activeQuery.id)}>Delete</button>
                  </div>
                  <div className="saved-query-payload">
                    <div className="docs-h2">Payload</div>
                    <pre className="docs-code-block saved-query-code-block"><code>{JSON.stringify(activeQuery.query_payload, null, 2)}</code></pre>
                  </div>
                </>
              ) : (
                <div className="empty-state">Select a saved query.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export type { DocsEntry, HistoryItem, ModelDetail, SettingsGroup }
