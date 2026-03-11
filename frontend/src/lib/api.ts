export interface BootstrapSettings {
  theme: 'dark' | 'light'
  default_page_size: number
  last_active_tab: string
  active_docs_key: string
  active_settings_key: string
  ui_state: Record<string, unknown>
}

export interface BootstrapModel {
  app_label: string
  model_name: string
  verbose_name: string
  verbose_name_plural: string
  count?: number
}

export interface SavedQuery {
  id: number
  name: string
  description: string
  app_label: string
  model_name: string
  query_payload: Record<string, unknown>
  tags: string[]
  is_shared: boolean
  last_run_at: string | null
  created_at: string
  updated_at: string
}

export interface QueryHistoryItem {
  id: number
  title: string
  app_label: string
  model_name: string
  query_payload: Record<string, unknown>
  status: 'success' | 'failed' | 'draft'
  duration_ms: number | null
  result_count: number | null
  error_message: string
  saved_query: number | null
  saved_query_name: string
  created_at: string
}

export interface BootstrapResponse {
  user: {
    id: number
    username: string
    is_authenticated: boolean
  }
  settings: BootstrapSettings
  models: BootstrapModel[]
  saved_queries: SavedQuery[]
  history: QueryHistoryItem[]
}

export interface MetadataField {
  name: string
  type: string
  label: string
  required: boolean
  primary_key?: boolean
  allowed_operations: string[]
  related_model?: string | null
  filter_name?: string | null
  max_length?: number | null
  choices?: Array<{ value: string; label: string }> | null
}

export interface MetadataResponse {
  model_name: string
  app_label: string
  primary_key_field: string
  fields: MetadataField[]
  all_lookups: string[]
}

export interface QueryCondition {
  field: string
  op: string
  value: string
}

export interface QueryFilterGroup {
  and_operation?: Array<QueryCondition | QueryFilterGroup>
  or_operation?: Array<QueryCondition | QueryFilterGroup>
  not_operation?: Array<QueryCondition | QueryFilterGroup>
}

export interface QueryRequest {
  model: string
  app_label?: string
  select_fields: string[]
  filter_fields?: QueryFilterGroup
  page?: number
  page_size?: number
  title?: string
  saved_query_id?: number
}

export interface QueryResponse {
  count: number
  page: number
  page_size: number
  total_pages: number
  next: number | null
  previous: number | null
  results: Array<Record<string, unknown>>
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')
const envBase =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_QLAB_API_BASE
const windowBase =
  typeof window !== 'undefined'
    ? (window as Window & { __QLAB_API_BASE__?: string }).__QLAB_API_BASE__
    : undefined

export const API_BASE = trimTrailingSlash(
  windowBase || envBase || '/qlab/api',
)

function getCookie(name: string): string {
  if (typeof document === 'undefined') {
    return ''
  }

  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))

  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : ''
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const csrfToken = getCookie('csrftoken')
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : null

  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.errors?.[0]?.msg ||
      `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

export function getBootstrap() {
  return requestJson<BootstrapResponse>('/bootstrap/')
}

export function getModelMetadata(model: string, appLabel?: string) {
  return requestJson<MetadataResponse>('/metadata/', {
    method: 'POST',
    body: JSON.stringify({
      model,
      ...(appLabel ? { app_label: appLabel } : {}),
    }),
  })
}

export function runQuery(payload: QueryRequest) {
  return requestJson<QueryResponse>('/query/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getHistory(limit = 50) {
  return requestJson<QueryHistoryItem[]>(`/history/?limit=${limit}`)
}

export function patchSettings(payload: Partial<BootstrapSettings>) {
  return requestJson<BootstrapSettings>('/settings/', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getSavedQueries() {
  return requestJson<SavedQuery[]>('/saved-queries/')
}

export function createSavedQuery(payload: Omit<SavedQuery, 'id' | 'last_run_at' | 'created_at' | 'updated_at'>) {
  return requestJson<SavedQuery>('/saved-queries/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSavedQuery(id: number, payload: Partial<Omit<SavedQuery, 'id' | 'last_run_at' | 'created_at' | 'updated_at'>>) {
  return requestJson<SavedQuery>(`/saved-queries/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteSavedQuery(id: number) {
  return requestJson<void>(`/saved-queries/${id}/`, {
    method: 'DELETE',
  })
}

export function markSavedQueryRun(id: number) {
  return requestJson<QueryResponse>(`/saved-queries/${id}/run/`, {
    method: 'POST',
  })
}
