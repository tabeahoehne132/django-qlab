import { useEffect, useState } from 'react'
import { NavSidebar, TabId, ThemeMode } from './components/NavSidebar'
import { ContentSidebar, DocsNavGroup, DocsNavItem, RecentQuery } from './components/ContentSidebar'
import { QueriesPage } from './pages/QueriesPage'
import {
  DocsEntry,
  DocsPage,
  HistoryItem,
  ModelDetail,
  HistoryPage,
  ModelsPage,
  SavedQueriesPage,
  SettingsPage,
  SettingsGroup,
  SettingsToggle,
} from './pages/WorkspacePages'
import {
  BootstrapModel,
  BootstrapSettings,
  MetadataField,
  MetadataResponse,
  QueryHistoryItem,
  QueryRequest,
  QueryResponse,
  SavedQuery,
  createSavedQuery,
  deleteSavedQuery,
  getBootstrap,
  getHistory,
  getModelMetadata,
  markSavedQueryRun,
  patchSettings,
  runQuery,
  updateSavedQuery,
} from './lib/api'
import './App.css'

const TOUR_STEPS: Array<{
  title: string
  body: string
  tab: TabId
  selector: string
}> = [
  {
    title: 'Start in the query builder',
    body: 'Pick a model in the left sidebar, choose fields, then build up filters without writing lookups by hand.',
    tab: 'queries',
    selector: '.query-builder-card',
  },
  {
    title: 'Build queries interactively',
    body: 'Choose fields, create nested filter groups and run the query without writing Django lookups by hand.',
    tab: 'queries',
    selector: '.query-builder-card',
  },
  {
    title: 'Save useful query states',
    body: 'Save useful query states directly from the builder, then manage and edit them later in the Saved tab.',
    tab: 'queries',
    selector: '.query-builder-card',
  },
  {
    title: 'Use History as your audit trail',
    body: 'Replay past runs or convert them into saved queries when an ad-hoc exploration becomes something reusable.',
    tab: 'history',
    selector: '.history-list',
  },
]

const SETTINGS_SECTIONS: SettingsGroup[] = [
  {
    key: 'general',
    title: 'General',
    items: [
      { label: 'Enable saved views', description: 'Allow users to persist named views inside the host application.', control: <SettingsToggle checked /> },
      { label: 'Default page size', description: 'Initial result size applied before users override the limit.', control: <input className="setting-input" defaultValue="100" /> },
      { label: 'Environment badge', description: 'Visible environment marker shown in the left sidebar.', control: <select className="setting-select" defaultValue="Local"><option>Local</option><option>Staging</option><option>Prod</option></select> },
    ],
  },
  {
    key: 'permissions',
    title: 'Permissions',
    items: [
      { label: 'Require authentication', description: 'Delegate access control to the host project before queries execute.', control: <SettingsToggle checked /> },
      { label: 'Expose restricted models', description: 'Keep disabled for internal-only models or sensitive endpoints.', control: <SettingsToggle /> },
    ],
  },
  {
    key: 'scopes',
    title: 'Scopes',
    items: [
      { label: 'Allowed apps', description: 'Limit the metadata browser to approved Django apps.', control: <div className="scope-tag-list"><span className="scope-tag">core <span className="scope-tag-remove">×</span></span><span className="scope-tag">network <span className="scope-tag-remove">×</span></span></div> },
      { label: 'Max relation depth', description: 'Avoid overly expensive nested relation traversals.', control: <input className="setting-input" defaultValue="2" /> },
    ],
  },
  {
    key: 'rate-limits',
    title: 'Rate Limits',
    items: [
      { label: 'Throttle query runs', description: 'Protect shared environments from accidental bursts.', control: <SettingsToggle checked /> },
      { label: 'Requests per minute', description: 'Upper bound for interactive usage from the UI shell.', control: <input className="setting-input" defaultValue="60" /> },
    ],
  },
  {
    key: 'advanced',
    title: 'Advanced',
    items: [
      { label: 'Metadata cache', description: 'Reuse schema responses to speed up the builder experience.', control: <SettingsToggle checked /> },
      { label: 'Response mode', description: 'Switch how much payload detail the frontend should request.', control: <select className="setting-select" defaultValue="Full"><option>Full</option><option>Compact</option></select> },
    ],
  },
]

const SETTINGS_NAV_ITEMS: DocsNavItem[] = SETTINGS_SECTIONS.map((section) => ({
  key: section.key,
  label: section.title,
}))

const DOCS_ENTRIES: DocsEntry[] = [
  {
    key: 'overview',
    section: 'Getting Started',
    title: 'Overview',
    tagline: 'What QLab gives you inside a Django project.',
    intro: 'QLab combines dynamic querying, metadata discovery and a packaged UI so teams can inspect model data without hand-writing every query or view.',
    endpoints: [
      { method: 'POST', path: '/api/query/', description: 'run model queries' },
      { method: 'POST', path: '/api/metadata/', description: 'inspect model schema' },
    ],
    params: [
      { name: 'model', type: 'string', description: 'Target model for queries or metadata.' },
      { name: 'select_fields', type: 'array', description: 'Fields returned by query runs.' },
    ],
    code: `pip install git+https://github.com/tabeahoehne132/django-qlab.git`,
  },
  {
    key: 'installation',
    section: 'Getting Started',
    title: 'Installation',
    tagline: 'Install the package and expose both API and UI.',
    intro: 'Install directly from GitHub, add qlab to INSTALLED_APPS and mount qlab.urls if you want the packaged browser UI.',
    endpoints: [
      { method: 'GET', path: '/qlab/', description: 'bundled UI entrypoint' },
    ],
    params: [
      { name: 'INSTALLED_APPS', type: 'list', description: 'Must include qlab and staticfiles.' },
      { name: 'urlpatterns', type: 'list', description: 'Include qlab.urls to mount the UI.' },
    ],
    code: `pip install git+https://github.com/tabeahoehne132/django-qlab.git\n\nINSTALLED_APPS = [\n    "django.contrib.staticfiles",\n    "qlab",\n]`,
  },
  {
    key: 'quick-start',
    section: 'Getting Started',
    title: 'Quick Start',
    tagline: 'Wire a ViewSet in a few lines and start querying.',
    intro: 'Mix QLab into a DRF ViewSet, expose query and metadata routes and optionally scope the queryset per model.',
    endpoints: [
      { method: 'POST', path: '/api/query/', description: 'query endpoint' },
      { method: 'POST', path: '/api/metadata/', description: 'metadata endpoint' },
      { method: 'POST', path: '/api/neighborhood/', description: 'relation graph endpoint' },
    ],
    params: [
      { name: 'get_queryset', type: 'callable', description: 'Optional scoping hook by model.' },
      { name: 'permission_classes', type: 'list', description: 'Standard DRF permission configuration.' },
    ],
    code: `class QLab(QLabMixin, NeighborhoodMixin, QLabMetadataMixin, viewsets.ViewSet):\n    permission_classes = [IsAuthenticated]\n\n    def get_queryset(self, model):\n        return model.objects.all()`,
  },
  {
    key: 'query-params',
    section: 'API Reference',
    title: 'Query Endpoint',
    tagline: 'Run interactive model queries through the packaged QLab shell.',
    intro: 'Use the query endpoint to select fields, apply nested filters and paginate results. This is the primary runtime surface the builder will target.',
    endpoints: [
      { method: 'POST', path: '/api/query/', description: 'execute a filtered query' },
    ],
    params: [
      { name: 'model', type: 'string', description: 'Target Django model name.' },
      { name: 'select_fields', type: 'array', description: 'Field paths returned in each result row.' },
      { name: 'filter_fields', type: 'object', description: 'AND/OR/NOT filter tree.' },
    ],
    code: `POST /api/query/\n{\n  "model": "Device",\n  "select_fields": ["id", "name", "status"],\n  "filter_fields": {\n    "and_operation": [\n      { "field": "status", "op": "is", "value": "active" }\n    ]\n  }\n}`,
  },
  {
    key: 'filtering',
    section: 'API Reference',
    title: 'Filtering',
    tagline: 'Build AND, OR and NOT groups across flat or nested field paths.',
    intro: 'QLab supports structured filter groups so the UI can express multiple conditions without string-building raw Django lookups.',
    endpoints: [
      { method: 'POST', path: '/api/query/', description: 'apply filter groups inside query payloads' },
    ],
    params: [
      { name: 'and_operation', type: 'array', description: 'All conditions must match.' },
      { name: 'or_operation', type: 'array', description: 'At least one condition must match.' },
      { name: 'not_operation', type: 'array', description: 'Excluded conditions.' },
    ],
    code: `{\n  "filter_fields": {\n    "and_operation": [\n      { "field": "status", "op": "is", "value": "active" }\n    ],\n    "or_operation": [\n      { "field": "region", "op": "is", "value": "DE" },\n      { "field": "region", "op": "is", "value": "AT" }\n    ]\n  }\n}`,
  },
  {
    key: 'pagination',
    section: 'API Reference',
    title: 'Pagination',
    tagline: 'Keep result volumes predictable for both API consumers and the UI.',
    intro: 'Query responses return count and paging metadata so the frontend can switch pages without losing context.',
    endpoints: [
      { method: 'POST', path: '/api/query/', description: 'paginated result response' },
    ],
    params: [
      { name: 'page', type: 'integer', description: 'Requested result page.' },
      { name: 'page_size', type: 'integer', description: 'Requested page size within allowed limits.' },
    ],
    code: `{\n  "count": 250,\n  "page": 1,\n  "page_size": 100,\n  "total_pages": 3,\n  "next": 2,\n  "previous": null\n}`,
  },
  {
    key: 'permissions',
    section: 'API Reference',
    title: 'Permissions',
    tagline: 'QLab follows the permissions and scoping rules of the host project.',
    intro: 'The package does not replace your authorization model. Apply DRF permission classes and per-model scoping in the hosting ViewSet.',
    endpoints: [
      { method: 'POST', path: '/api/query/', description: 'protected by your DRF permissions' },
    ],
    params: [
      { name: 'permission_classes', type: 'list', description: 'DRF permission classes on the ViewSet.' },
      { name: 'RESTRICTED_MODELS', type: 'list', description: 'Block models globally.' },
    ],
    code: `class QLab(QLabMixin, viewsets.ViewSet):\n    permission_classes = [IsAuthenticated]\n\n    def get_queryset(self, model):\n        return model.objects.filter(tenant=self.request.user.tenant)`,
  },
  {
    key: 'metadata-endpoint',
    section: 'API Reference',
    title: 'Metadata Endpoint',
    tagline: 'Populate field choices, relations and allowed operators before query execution.',
    intro: 'The metadata endpoint is the schema feed for the frontend. It enables autocomplete, field grouping and relation traversal without hardcoded model knowledge.',
    endpoints: [
      { method: 'POST', path: '/api/metadata/', description: 'return schema metadata for one model' },
      { method: 'GET', path: '/api/metadata/', description: 'optionally expose a lightweight index' },
    ],
    params: [
      { name: 'model', type: 'string', description: 'Model to inspect.' },
      { name: 'include_relations', type: 'boolean', description: 'Include related models and nested lookups.' },
    ],
    code: `POST /api/metadata/\n{\n  "model": "Device",\n  "include_relations": true\n}`,
  },
  {
    key: 'qlab-mixin',
    section: 'Guides',
    title: 'QLabMixin',
    tagline: 'Core query execution mixin for field selection and filter validation.',
    intro: 'Use QLabMixin when you only need dynamic querying. It validates incoming field paths and builds queryset annotations safely.',
    endpoints: [
      { method: 'POST', path: '/api/query/', description: 'query execution route' },
    ],
    params: [
      { name: 'post', type: 'action', description: 'Main query action on the ViewSet.' },
    ],
    code: `class QLab(QLabMixin, viewsets.ViewSet):\n    def get_queryset(self, model):\n        return model.objects.all()`,
  },
  {
    key: 'neighborhood-mixin',
    section: 'Guides',
    title: 'NeighborhoodMixin',
    tagline: 'Resolve connected records to drive graph-like UI views.',
    intro: 'NeighborhoodMixin returns related node IDs for a set of records and is useful when the frontend wants graph exploration or relation previews.',
    endpoints: [
      { method: 'POST', path: '/api/neighborhood/', description: 'resolve neighborhood graph' },
    ],
    params: [
      { name: 'model', type: 'string', description: 'Source model.' },
      { name: 'node_ids', type: 'array', description: 'IDs to expand from.' },
    ],
    code: `{\n  "model": "Author",\n  "node_ids": ["1", "2"]\n}`,
  },
  {
    key: 'error-shapes',
    section: 'Guides',
    title: 'Error Shapes',
    tagline: 'Understand validation and query execution failures from the API.',
    intro: 'Validation errors come back as structured payloads so the UI can point users to the problematic field, operator or model selection.',
    endpoints: [
      { method: 'POST', path: '/api/query/', description: 'validation and execution errors' },
    ],
    params: [
      { name: 'detail', type: 'string', description: 'Top-level error message.' },
      { name: 'errors', type: 'array', description: 'Optional list of field-specific issues.' },
    ],
    code: `{\n  "detail": "Invalid filter field",\n  "errors": [\n    { "field": "foo__bar", "message": "Unknown lookup path" }\n  ]\n}`,
  },
]

const DOCS_GROUPS: DocsNavGroup[] = [
  {
    label: 'Getting Started',
    items: [
      { key: 'overview', label: 'Overview' },
      { key: 'installation', label: 'Installation' },
      { key: 'quick-start', label: 'Quick Start' },
    ],
  },
  {
    label: 'API Reference',
    items: [
      { key: 'query-params', label: 'Query Params' },
      { key: 'filtering', label: 'Filtering' },
      { key: 'pagination', label: 'Pagination' },
      { key: 'permissions', label: 'Permissions' },
    ],
  },
  {
    label: 'Guides',
    items: [
      { key: 'qlab-mixin', label: 'QLabMixin' },
      { key: 'neighborhood-mixin', label: 'NeighborhoodMixin' },
      { key: 'error-shapes', label: 'Error Shapes' },
    ],
  },
]

type HistoryRange = 'all' | 'today' | '7d' | '30d'
type ToastTone = 'success' | 'error'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('queries')
  const [activeModel, setActiveModel] = useState<string>('')
  const [activeSettingsKey, setActiveSettingsKey] = useState<string>('general')
  const [activeDocsKey, setActiveDocsKey] = useState<string>('overview')
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark'
    const savedTheme = window.localStorage.getItem('qlab-theme')
    return savedTheme === 'light' ? 'light' : 'dark'
  })
  const [defaultPageSize, setDefaultPageSize] = useState(100)
  const [bootstrapModels, setBootstrapModels] = useState<BootstrapModel[]>([])
  const [historyItems, setHistoryItems] = useState<QueryHistoryItem[]>([])
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [metadataByModel, setMetadataByModel] = useState<Record<string, MetadataResponse>>({})
  const [queryPreset, setQueryPreset] = useState<QueryRequest | null>(null)
  const [queryResultPreset, setQueryResultPreset] = useState<QueryResponse | null>(null)
  const [activeSavedQueryId, setActiveSavedQueryId] = useState<number | null>(null)
  const [favoriteModels, setFavoriteModels] = useState<string[]>([])
  const [recentModelNames, setRecentModelNames] = useState<string[]>([])
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [settingsReady, setSettingsReady] = useState(false)
  const [tourSeen, setTourSeen] = useState(true)
  const [tourStep, setTourStep] = useState(0)
  const [tourCardPos, setTourCardPos] = useState<{ top: number; left: number } | null>(null)
  const [activeHistoryModel, setActiveHistoryModel] = useState<string>('all')
  const [activeHistoryRange, setActiveHistoryRange] = useState<HistoryRange>('all')
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const normalizeTab = (tab: string | null | undefined): TabId => {
    switch (tab) {
      case 'models':
      case 'saved':
      case 'history':
      case 'settings':
      case 'docs':
      case 'queries':
        return tab
      default:
        return 'queries'
    }
  }

  const pushToast = (tone: ToastTone, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id, tone, message }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 2400)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('qlab-theme', theme)
  }, [theme])

  useEffect(() => {
    let isMounted = true

    const loadBootstrap = async () => {
      try {
        const bootstrap = await getBootstrap()
        if (!isMounted) {
          return
        }
        setBootstrapModels(bootstrap.models)
        setHistoryItems(bootstrap.history)
        setSavedQueries(bootstrap.saved_queries)
        setActiveSavedQueryId(bootstrap.saved_queries[0]?.id ?? null)
        setActiveModel(bootstrap.models[0]?.model_name || '')
        setActiveTab(normalizeTab(bootstrap.settings.last_active_tab))
        setActiveDocsKey(bootstrap.settings.active_docs_key || 'overview')
        setActiveSettingsKey(bootstrap.settings.active_settings_key || 'general')
        setDefaultPageSize(bootstrap.settings.default_page_size || 100)
        setTheme(bootstrap.settings.theme || 'dark')
        setFavoriteModels(
          Array.isArray(bootstrap.settings.ui_state?.favorite_models)
            ? (bootstrap.settings.ui_state.favorite_models as string[])
            : [],
        )
        setRecentModelNames(
          Array.isArray(bootstrap.settings.ui_state?.recent_models)
            ? (bootstrap.settings.ui_state.recent_models as string[])
            : [],
        )
        const hasSeenTour = Boolean(bootstrap.settings.ui_state?.tour_seen)
        setTourSeen(hasSeenTour)
        setTourStep(0)
        setSettingsReady(true)
      } catch (error) {
        if (!isMounted) {
          return
        }
        setBootstrapError(error instanceof Error ? error.message : 'Failed to load QLab.')
      } finally {
        if (isMounted) {
          setIsBootstrapping(false)
        }
      }
    }

    void loadBootstrap()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!settingsReady) {
      return
    }
    const timeoutId = window.setTimeout(() => {
      void patchSettings({
        theme,
        default_page_size: defaultPageSize,
        last_active_tab: activeTab,
        active_docs_key: activeDocsKey,
        active_settings_key: activeSettingsKey,
        ui_state: {
          favorite_models: favoriteModels,
          recent_models: recentModelNames,
          tour_seen: tourSeen,
        },
      } as Partial<BootstrapSettings>)
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [
    activeDocsKey,
    activeSettingsKey,
    activeTab,
    defaultPageSize,
    favoriteModels,
    recentModelNames,
    settingsReady,
    theme,
    tourSeen,
  ])

  useEffect(() => {
    if (tourSeen) {
      return
    }
    const step = TOUR_STEPS[tourStep]
    if (activeTab !== step.tab) {
      setActiveTab(step.tab)
    }
  }, [activeTab, tourSeen, tourStep])

  useEffect(() => {
    if (tourSeen) {
      setTourCardPos(null)
      return
    }

    const updateRect = () => {
      const step = TOUR_STEPS[tourStep]
      const element = document.querySelector(step.selector)
      if (!element) {
        setTourCardPos({ top: 24, left: 24 })
        return
      }
      const rect = element.getBoundingClientRect()

      const cardWidth = Math.min(420, window.innerWidth - 32)
      const preferredLeft = rect.left + 12
      const maxLeft = Math.max(16, window.innerWidth - cardWidth - 16)
      const left = Math.min(preferredLeft, maxLeft)

      const spaceBelow = window.innerHeight - rect.bottom
      const top = spaceBelow > 260
        ? Math.min(window.innerHeight - 220 - 16, rect.bottom + 20)
        : Math.max(16, rect.top - 220 - 20)

      setTourCardPos({ top, left })
    }

    const timeoutId = window.setTimeout(updateRect, 80)
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [activeTab, tourSeen, tourStep])

  const activeModelEntry = bootstrapModels.find((model) => model.model_name === activeModel)

  useEffect(() => {
    if (!activeModel || metadataByModel[activeModel]) {
      return
    }

    const loadMetadata = async () => {
      try {
        const metadata = await getModelMetadata(activeModel, activeModelEntry?.app_label)
        setMetadataByModel((current) => ({ ...current, [activeModel]: metadata }))
      } catch (error) {
        console.error(error)
      }
    }

    void loadMetadata()
  }, [activeModel, activeModelEntry?.app_label, metadataByModel])

  const refreshHistory = async () => {
    try {
      setHistoryItems(await getHistory(50))
    } catch (error) {
      console.error(error)
      pushToast('error', 'Failed to refresh history.')
    }
  }

  const syncSavedQuery = (savedQuery: SavedQuery) => {
    setSavedQueries((current) => {
      const exists = current.some((entry) => entry.id === savedQuery.id)
      const next = exists
        ? current.map((entry) => entry.id === savedQuery.id ? savedQuery : entry)
        : [...current, savedQuery]
      return [...next].sort((left, right) => left.name.localeCompare(right.name))
    })
    setActiveSavedQueryId(savedQuery.id)
  }

  const handleModelSelect = (name: string) => {
    setActiveModel(name)
    setRecentModelNames((current) => {
      const next = [name, ...current.filter((entry) => entry !== name)]
      return next.slice(0, 6)
    })
  }

  const handleToggleModelFavorite = (name: string) => {
    setFavoriteModels((current) => (
      current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name]
    ))
  }

  const handleRecentQuerySelect = (query: RecentQuery) => {
    const modelFromMeta = query.meta.split(' · ')[0]
    const match = bootstrapModels.find((model) => model.model_name === modelFromMeta)
    if (match) {
      handleModelSelect(match.model_name)
    }
    setActiveTab('queries')
  }

  const handleReplayQuery = (item: HistoryItem) => {
    const model = bootstrapModels.find((entry) => entry.model_name === item.model)
    if (model) {
      handleModelSelect(model.model_name)
    }
    if (item.queryPayload) {
      setQueryPreset(item.queryPayload as unknown as QueryRequest)
    }
    setActiveTab('queries')
  }

  const handleOpenSavedQuery = (query: SavedQuery) => {
    const model = bootstrapModels.find((entry) => entry.model_name === query.model_name)
    if (model) {
      handleModelSelect(model.model_name)
    }
    setQueryPreset({
      ...(query.query_payload as unknown as QueryRequest),
      saved_query_id: query.id,
      title: query.name,
    })
    setActiveTab('queries')
  }

  const handleRunSavedQuery = async (query: SavedQuery) => {
    const response = await markSavedQueryRun(query.id)
    pushToast('success', `Ran saved query "${query.name}".`)
    await refreshHistory()
    setSavedQueries((current) => current.map((entry) => (
      entry.id === query.id
        ? { ...entry, last_run_at: new Date().toISOString() }
        : entry
    )))
    const model = bootstrapModels.find((entry) => entry.model_name === query.model_name)
    if (model) {
      handleModelSelect(model.model_name)
    }
    setQueryPreset({
      ...(query.query_payload as unknown as QueryRequest),
      saved_query_id: query.id,
      title: query.name,
    })
    setQueryResultPreset(response)
    setActiveTab('queries')
  }

  const activeMetadata = activeModel ? metadataByModel[activeModel] : undefined
  const buildBlockedLookupMatcher = (metadata: MetadataResponse) => {
    const blockedRoots = metadata.fields
      .filter((field) => field.type === 'reverse_relation' || field.type === 'manytomany')
      .map((field) => field.name)

    return (lookup: string) => blockedRoots.some((root) => lookup === root || lookup.startsWith(`${root}__`))
  }

  const fieldOptions = activeMetadata
    ? (() => {
        const isBlockedLookup = buildBlockedLookupMatcher(activeMetadata)
        return Array.from(
          new Set([
            ...activeMetadata.fields.map((field) => field.name),
            ...activeMetadata.all_lookups,
          ]),
        ).filter((lookup) => !isBlockedLookup(lookup))
      })()
    : []

  const colors = ['#4a9eff', '#7cbcff', '#f59e0b', '#2c7be5', '#ef4444', '#f97316']
  const buildFieldNotes = (field: MetadataField) => {
    const notes: string[] = []
    if (field.primary_key) notes.push('Primary key')
    if (field.max_length) notes.push(`max_length=${field.max_length}`)
    if (field.related_model) notes.push(`${field.type === 'reverse_relation' ? '←' : '→'} ${field.related_model}`)
    if (field.filter_name) notes.push(`filter: ${field.filter_name}`)
    if (field.choices?.length) notes.push(`choices: ${field.choices.map((choice) => choice.label).join(', ')}`)
    return notes.join(' · ')
  }

  const models: ModelDetail[] = bootstrapModels.map((model, index) => {
    const metadata = metadataByModel[model.model_name]
    const directFields = metadata
      ? (() => {
          const isBlockedLookup = buildBlockedLookupMatcher(metadata)
          const fieldMap = new Map(
            metadata.fields
              .filter((field) => !isBlockedLookup(field.name))
              .map((field) => [field.name, field]),
          )

          for (const lookup of metadata.all_lookups) {
            if (isBlockedLookup(lookup) || fieldMap.has(lookup)) {
              continue
            }

            fieldMap.set(lookup, {
              name: lookup,
              type: 'lookup',
              label: lookup,
              required: false,
              allowed_operations: ['is', 'is_not', 'icontains'],
              related_model: null,
              filter_name: lookup,
              max_length: null,
              choices: null,
            })
          }

          return Array.from(fieldMap.values())
        })()
      : []
    return {
      name: model.model_name,
      count: model.count || 0,
      color: colors[index % colors.length],
      appLabel: model.app_label,
      favorite: favoriteModels.includes(model.model_name),
      description: model.verbose_name_plural,
      tags: [
        directFields.some((field) => field.allowed_operations.length > 0) ? 'filterable' : 'read-only',
        model.app_label,
      ],
      fields: directFields.map((field) => ({
        name: field.name,
        type: field.type,
        nullable: !field.required,
        filterable: field.allowed_operations.length > 0,
        notes: buildFieldNotes(field),
      })),
      relations: directFields
        .filter((field) => field.related_model)
        .map((field) => ({
          direction: field.type === 'reverse_relation' ? '<-' : field.type === 'manytomany' ? '↔' : '->',
          target: field.related_model || '',
          field: field.filter_name || field.name,
          kind: field.type === 'reverse_relation' ? 'rev' : field.type === 'manytomany' ? 'm2m' : 'fk',
        })),
    }
  })

  const recentQueries: RecentQuery[] = historyItems.slice(0, 4).map((item) => ({
    title: item.title || `${item.model_name} query`,
    meta: `${item.model_name} · ${item.result_count ?? 0} results`,
  }))

  const savedQueryNavItems = savedQueries.map((query) => ({
    id: query.id,
    name: query.name,
    modelName: query.model_name,
    updatedAt: query.updated_at,
  }))

  const historyViewItems: HistoryItem[] = historyItems.map((item) => ({
    id: item.id,
    title: item.title || `${item.model_name} query`,
    model: item.model_name,
    filters: item.query_payload.filter_fields ? 'custom filters' : 'all records',
    ranAt: new Date(item.created_at).toLocaleString(),
    duration: item.duration_ms ? `${item.duration_ms} ms` : '—',
    status: item.status === 'failed' ? 'failed' : item.status === 'draft' ? 'draft' : item.saved_query ? 'cached' : 'ok',
    queryPayload: item.query_payload,
  }))

  const closeTour = () => {
    setTourSeen(true)
    setTourStep(0)
    pushToast('success', 'QLab tour completed.')
  }

  const now = Date.now()
  const historyModelCounts = historyItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.model_name] = (acc[item.model_name] || 0) + 1
    return acc
  }, {})

  const filteredHistoryItems = historyViewItems.filter((item, index) => {
    const raw = historyItems[index]
    if (!raw) {
      return true
    }
    if (activeHistoryModel !== 'all' && item.model !== activeHistoryModel) {
      return false
    }
    if (activeHistoryRange === 'today') {
      return new Date(raw.created_at).toDateString() === new Date(now).toDateString()
    }
    if (activeHistoryRange === '7d') {
      return now - new Date(raw.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000
    }
    if (activeHistoryRange === '30d') {
      return now - new Date(raw.created_at).getTime() <= 30 * 24 * 60 * 60 * 1000
    }
    return true
  })

  const settingsSections: SettingsGroup[] = [
    {
      key: 'general',
      title: 'General',
      items: [
        {
          label: 'Theme',
          description: 'Default UI theme persisted for the current user.',
          control: (
            <select className="setting-select" value={theme} onChange={(event) => setTheme(event.target.value as ThemeMode)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          ),
        },
        {
          label: 'Default page size',
          description: 'Initial result size used by the query builder.',
          control: (
            <input
              className="setting-input"
              type="number"
              min={1}
              max={500}
              value={defaultPageSize}
              onChange={(event) => setDefaultPageSize(Number(event.target.value))}
            />
          ),
        },
      ],
    },
    ...SETTINGS_SECTIONS.slice(1),
  ]

  if (isBootstrapping) {
    return <div className="app-screen"><div className="app-screen-panel"><strong>Loading QLab</strong><span>Bootstrapping models, settings and saved query state.</span></div></div>
  }

  if (bootstrapError) {
    return <div className="app-screen"><div className="app-screen-panel error"><strong>QLab failed to load</strong><span>{bootstrapError}</span></div></div>
  }

  return (
    <>
      <NavSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        theme={theme}
        onThemeToggle={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
        projectName="QLAB"
        userInitials="TH"
      />

      <ContentSidebar
        activeTab={activeTab}
        models={models}
        recentQueries={recentQueries}
        recentModelNames={recentModelNames}
        activeModel={activeModel}
        savedQueries={savedQueryNavItems}
        activeSavedQueryId={activeSavedQueryId}
        historyModelOptions={Object.entries(historyModelCounts).map(([label, count]) => ({ label, count }))}
        activeHistoryModel={activeHistoryModel}
        onHistoryModelSelect={setActiveHistoryModel}
        activeHistoryRange={activeHistoryRange}
        onHistoryRangeSelect={setActiveHistoryRange}
        settingsItems={SETTINGS_NAV_ITEMS}
        activeSettingsKey={activeSettingsKey}
        onSettingsSelect={setActiveSettingsKey}
        docsGroups={DOCS_GROUPS}
        activeDocsKey={activeDocsKey}
        onDocsSelect={setActiveDocsKey}
        onModelSelect={handleModelSelect}
        onSavedQuerySelect={(id) => {
          setActiveSavedQueryId(id)
          setActiveTab('saved')
        }}
        onToggleModelFavorite={handleToggleModelFavorite}
        onRecentQuerySelect={handleRecentQuerySelect}
        environment="LOCAL · DEV"
      />

      <div className="app-body">
        <div className="toast-stack">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast-item ${toast.tone}`}>
              {toast.message}
            </div>
          ))}
        </div>
        {!tourSeen && (
          <div className="tour-overlay">
            <div
              className="tour-card"
              style={tourCardPos ? { top: tourCardPos.top, left: tourCardPos.left } : undefined}
            >
              <div className="tour-kicker">Welcome to QLab</div>
              <div className="tour-title">{TOUR_STEPS[tourStep].title}</div>
              <div className="tour-body">{TOUR_STEPS[tourStep].body}</div>
              <div className="tour-progress">
                {TOUR_STEPS.map((_, index) => (
                  <span key={index} className={`tour-dot${index === tourStep ? ' active' : ''}`} />
                ))}
              </div>
              <div className="tour-actions">
                <button className="btn btn-ghost" onClick={closeTour}>Skip</button>
                {tourStep > 0 && (
                  <button className="btn btn-secondary" onClick={() => setTourStep((current) => current - 1)}>Back</button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (tourStep === TOUR_STEPS.length - 1) {
                      closeTour()
                      return
                    }
                    setTourStep((current) => current + 1)
                  }}
                >
                  {tourStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'queries' && (
          <QueriesPage
            activeModel={activeModel}
            activeAppLabel={activeModelEntry?.app_label}
            fieldOptions={fieldOptions}
            metadataLoading={Boolean(activeModel) && !activeMetadata}
            defaultPageSize={defaultPageSize}
            queryPreset={queryPreset}
            resultsPreset={queryResultPreset}
            onPresetApplied={() => setQueryPreset(null)}
            onResultsPresetApplied={() => setQueryResultPreset(null)}
            onSaveQuery={async ({ name, description, payload }) => {
              try {
                const created = await createSavedQuery({
                  name,
                  description,
                  app_label: activeModelEntry?.app_label || '',
                  model_name: payload.model,
                  query_payload: payload as unknown as Record<string, unknown>,
                  tags: [],
                  is_shared: false,
                })
                syncSavedQuery(created)
                pushToast('success', `Saved query "${created.name}".`)
              } catch (error) {
                pushToast('error', error instanceof Error ? error.message : 'Could not save query.')
                throw error
              }
            }}
            onRunQuery={async (payload) => {
              try {
                const response = await runQuery(payload)
                await refreshHistory()
                if (payload.saved_query_id) {
                  setSavedQueries((current) => current.map((entry) => (
                    entry.id === payload.saved_query_id
                      ? { ...entry, last_run_at: new Date().toISOString() }
                      : entry
                  )))
                }
                return response
              } catch (error) {
                pushToast('error', error instanceof Error ? error.message : 'Query failed.')
                throw error
              }
            }}
          />
        )}
        {activeTab === 'models' && (
          <ModelsPage
            models={models}
            activeModel={activeModel}
            onQueryModel={(modelName) => {
              setActiveModel(modelName)
              setActiveTab('queries')
            }}
          />
        )}
        {activeTab === 'saved' && (
          <SavedQueriesPage
            savedQueries={savedQueries}
            activeSavedQueryId={activeSavedQueryId}
            onSelectSavedQuery={setActiveSavedQueryId}
            onUpdateSavedQuery={async (id, payload) => {
              try {
                const updated = await updateSavedQuery(id, payload)
                syncSavedQuery(updated)
                pushToast('success', `Updated "${updated.name}".`)
              } catch (error) {
                pushToast('error', error instanceof Error ? error.message : 'Could not update saved query.')
              }
            }}
            onDeleteSavedQuery={async (id) => {
              try {
                await deleteSavedQuery(id)
                setSavedQueries((current) => {
                  const next = current.filter((entry) => entry.id !== id)
                  setActiveSavedQueryId((currentActive) => currentActive === id ? next[0]?.id ?? null : currentActive)
                  return next
                })
                pushToast('success', 'Saved query deleted.')
              } catch (error) {
                pushToast('error', error instanceof Error ? error.message : 'Could not delete saved query.')
              }
            }}
            onOpenInBuilder={handleOpenSavedQuery}
            onRunSavedQuery={async (query) => {
              try {
                await handleRunSavedQuery(query)
              } catch (error) {
                pushToast('error', error instanceof Error ? error.message : 'Could not run saved query.')
              }
            }}
          />
        )}
        {activeTab === 'history' && (
          <HistoryPage
            historyItems={filteredHistoryItems}
            onReplayQuery={handleReplayQuery}
            onSaveQuery={async (item) => {
              try {
                const created = await createSavedQuery({
                  name: item.title || `${item.model} query`,
                  description: `Saved from history on ${item.ranAt}`,
                  app_label: bootstrapModels.find((entry) => entry.model_name === item.model)?.app_label || '',
                  model_name: item.model,
                  query_payload: item.queryPayload as Record<string, unknown>,
                  tags: ['history'],
                  is_shared: false,
                })
                syncSavedQuery(created)
                setActiveTab('saved')
                pushToast('success', `Saved "${created.name}" from history.`)
              } catch (error) {
                pushToast('error', error instanceof Error ? error.message : 'Could not save from history.')
              }
            }}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsPage sections={settingsSections} activeSettingsKey={activeSettingsKey} />
        )}
        {activeTab === 'docs' && (
          <DocsPage docs={DOCS_ENTRIES} activeDocKey={activeDocsKey} />
        )}
      </div>
    </>
  )
}
