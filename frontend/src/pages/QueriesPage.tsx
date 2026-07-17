import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import {
  AggregationFunction,
  MetadataField,
  MetadataResponse,
  QueryCondition,
  QueryFilterGroup,
  QueryRequest,
  QueryResponse,
} from '../lib/api'
import { setUrlParam } from '../lib/url'
import './QueriesPage.css'

type FilterOp = 'is' | 'is_not' | 'icontains' | 'lt' | 'lte' | 'gt' | 'gte'
type FilterJoiner = 'and' | 'or'

interface FilterConditionNode {
  id: string
  type: 'condition'
  field: string
  op: FilterOp
  value: string
}

interface FilterGroupNode {
  id: string
  type: 'group'
  operator: FilterJoiner
  children: FilterNode[]
}

type FilterNode = FilterConditionNode | FilterGroupNode

interface ResultRow {
  [key: string]: string | number | boolean | null
}

type ResultTab = 'table' | 'json'

interface FieldSuggestion {
  path: string
  label: string
  displayLabel: string
  type: string
  isRelation: boolean
  relatedModel?: string | null
  relatedAppLabel?: string | null
}

interface FieldResolution {
  suggestions: FieldSuggestion[]
  exactMatch: FieldSuggestion | null
  error: string | null
}

interface FieldAutocompleteProps {
  value: string
  rootModel: string
  rootAppLabel?: string
  rootMetadata?: MetadataResponse
  placeholder?: string
  className?: string
  autoFocus?: boolean
  compact?: boolean
  excludeFields?: string[]
  onChange: (value: string) => void
  onRequestMetadata: (modelName: string, appLabel?: string) => Promise<MetadataResponse>
  onSubmit?: (value: string) => void
}

const RELATION_TYPES = new Set([
  'foreignkey',
  'onetoone',
  'manytomany',
  'reverse_relation',
])

const DEFAULT_OPERATIONS: FilterOp[] = [
  'is',
  'is_not',
  'icontains',
  'lt',
  'lte',
  'gt',
  'gte',
]

const AGGREGATION_FUNCTIONS: AggregationFunction[] = ['count', 'sum', 'avg', 'min', 'max']

interface AggregationRow {
  id: string
  field: string
  function: AggregationFunction
  distinct: boolean
  alias: string
}

const splitIdentifier = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()

const normalizeDisplayLabel = (label: string, fieldName: string) => {
  const normalizedLabel = label.trim().toLowerCase()
  const normalizedField = splitIdentifier(fieldName).trim().toLowerCase()
  return normalizedLabel === normalizedField ? splitIdentifier(fieldName) : label
}

const IconPlay = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
)

const IconCopy = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const IconDownload = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

function getRelativeTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 15) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

const IconShare = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

const IconSave = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
)

let idCounter = 0
const newId = () => `filter-${++idCounter}`

function newCondition(fallbackField: string): FilterConditionNode {
  return {
    id: newId(),
    type: 'condition',
    field: fallbackField,
    op: 'is',
    value: '',
  }
}

function newGroup(fallbackField: string, operator: FilterJoiner = 'and'): FilterGroupNode {
  return {
    id: newId(),
    type: 'group',
    operator,
    children: fallbackField ? [newCondition(fallbackField)] : [],
  }
}

function toCondition(node: FilterConditionNode): QueryCondition {
  return {
    field: node.field,
    op: node.op,
    value: node.value,
  }
}

function serializeNode(node: FilterNode): QueryCondition | QueryFilterGroup | null {
  if (node.type === 'condition') {
    if (!node.field.trim() || !node.value.trim()) {
      return null
    }
    return toCondition(node)
  }

  const children = node.children
    .map((child) => serializeNode(child))
    .filter((child): child is QueryCondition | QueryFilterGroup => child !== null)

  if (children.length === 0) {
    return null
  }

  return node.operator === 'or'
    ? { or_operation: children }
    : { and_operation: children }
}

function serializeFilters(root: FilterGroupNode): QueryFilterGroup | undefined {
  const serialized = serializeNode(root)
  if (!serialized || 'field' in serialized) {
    return undefined
  }
  return serialized
}

function deserializeFilters(
  filterGroup: QueryFilterGroup | undefined,
  fallbackField: string,
): FilterGroupNode {
  if (!filterGroup) {
    return newGroup(fallbackField, 'and')
  }

  const walk = (node: QueryFilterGroup | QueryCondition): FilterNode => {
    if ('field' in node) {
      return {
        id: newId(),
        type: 'condition',
        field: node.field,
        op: (node.op as FilterOp) || 'is',
        value: String(node.value ?? ''),
      }
    }

    if (node.or_operation) {
      return {
        id: newId(),
        type: 'group',
        operator: 'or',
        children: node.or_operation.map((child) =>
          walk(child as QueryFilterGroup | QueryCondition),
        ),
      }
    }

    return {
      id: newId(),
      type: 'group',
      operator: 'and',
      children: (node.and_operation || []).map((child) =>
        walk(child as QueryFilterGroup | QueryCondition),
      ),
    }
  }

  const result = walk(filterGroup)
  return result.type === 'group'
    ? result
    : {
        id: newId(),
        type: 'group',
        operator: 'and',
        children: [result],
      }
}

function getDirectFields(metadata?: MetadataResponse): MetadataField[] {
  return metadata ? metadata.fields.filter((field) => !field.name.includes('__')) : []
}

function isRelationField(field: MetadataField) {
  return RELATION_TYPES.has(field.type) && Boolean(field.related_model)
}

async function resolveFieldPath(
  query: string,
  rootModel: string,
  rootAppLabel: string | undefined,
  rootMetadata: MetadataResponse | undefined,
  onRequestMetadata: (modelName: string, appLabel?: string) => Promise<MetadataResponse>,
): Promise<FieldResolution> {
  const normalized = query.trim()
  const endsWithPathSeparator = normalized.endsWith('__')
  const segments = normalized.split('__').filter(Boolean)

  let currentModel = rootModel
  let currentAppLabel = rootAppLabel
  let currentMetadata =
    rootMetadata || (await onRequestMetadata(rootModel, rootAppLabel))
  const traversedSegments: string[] = []

  const relationSegments = endsWithPathSeparator ? segments : segments.slice(0, -1)
  const partial = endsWithPathSeparator ? '' : segments[segments.length - 1] || ''

  for (const segment of relationSegments) {
    const relationField = getDirectFields(currentMetadata).find(
      (field) => field.name === segment && isRelationField(field),
    )

    if (!relationField || !relationField.related_model) {
      return {
        suggestions: [],
        exactMatch: null,
        error: 'Unknown relation path.',
      }
    }

    traversedSegments.push(segment)
    currentModel = relationField.related_model
    currentAppLabel = relationField.related_app_label || currentAppLabel
    currentMetadata = await onRequestMetadata(currentModel, currentAppLabel)
  }

  const directFields = getDirectFields(currentMetadata)
  const exactField = !endsWithPathSeparator
    ? directFields.find((field) => field.name === partial)
    : null

  const suggestions = directFields
    .filter((field) => {
      if (!partial) {
        return true
      }
      const needle = partial.toLowerCase()
      return (
        field.name.toLowerCase().includes(needle) ||
        field.label.toLowerCase().includes(needle)
      )
    })
    .map((field) => ({
      path: [...traversedSegments, field.name].join('__'),
      label: field.label || field.name,
      displayLabel: normalizeDisplayLabel(field.label || field.name, field.name),
      type: field.type,
      isRelation: isRelationField(field),
      relatedModel: field.related_model,
      relatedAppLabel: field.related_app_label,
    }))

  return {
    suggestions,
    exactMatch: exactField
      ? {
          path: [...traversedSegments, exactField.name].join('__'),
          label: exactField.label || exactField.name,
          displayLabel: normalizeDisplayLabel(
            exactField.label || exactField.name,
            exactField.name,
          ),
          type: exactField.type,
          isRelation: isRelationField(exactField),
          relatedModel: exactField.related_model,
          relatedAppLabel: exactField.related_app_label,
        }
      : null,
    error: null,
  }
}

const ResourceRow: React.FC<{
  activeModel: string
  activeModelLabel?: string
}> = ({ activeModel, activeModelLabel }) => (
  <div className="resource-row">
    <span className="from-label">FROM</span>
    <div className="resource-current">
      <button className="resource-chip active" type="button">
        {activeModelLabel || activeModel}
      </button>
      <span className="field-hint">Change model in the left sidebar.</span>
    </div>
  </div>
)

const IconChevronDown = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

interface DropdownOption<T extends string> {
  value: T
  label: string
}

interface DropdownProps<T extends string> {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  className?: string
  menuClassName?: string
}

function Dropdown<T extends string>({ value, options, onChange, className = '', menuClassName = '' }: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const closeTimeout = useRef<number | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const current = options.find((option) => option.value === value)

  const clearCloseTimer = () => {
    if (closeTimeout.current) {
      window.clearTimeout(closeTimeout.current)
      closeTimeout.current = null
    }
  }

  const selectOption = (option: DropdownOption<T>) => {
    onChange(option.value)
    setOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setHighlightedIndex(Math.max(options.findIndex((option) => option.value === value), 0))
        return
      }
      const next = Math.min(highlightedIndex + 1, options.length - 1)
      setHighlightedIndex(next)
      menuRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setHighlightedIndex(Math.max(options.findIndex((option) => option.value === value), 0))
        return
      }
      const next = Math.max(highlightedIndex - 1, 0)
      setHighlightedIndex(next)
      menuRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open && highlightedIndex >= 0) {
        selectOption(options[highlightedIndex])
      } else {
        setOpen(true)
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
      setHighlightedIndex(-1)
    }
  }

  return (
    <div
      className={`dropdown${className ? ` ${className}` : ''}`}
      onBlur={() => {
        closeTimeout.current = window.setTimeout(() => setOpen(false), 120)
      }}
    >
      <button
        type="button"
        className="dropdown-trigger"
        onClick={() => {
          clearCloseTimer()
          setOpen((current) => !current)
        }}
        onKeyDown={handleKeyDown}
      >
        <span>{current?.label ?? value}</span>
        <IconChevronDown />
      </button>

      {open && (
        <div className={`field-autocomplete-menu dropdown-menu${menuClassName ? ` ${menuClassName}` : ''}`} ref={menuRef}>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              className={`field-picker-item${option.value === value ? ' selected' : ''}${index === highlightedIndex ? ' highlighted' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => selectOption(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const FieldAutocomplete: React.FC<FieldAutocompleteProps> = ({
  value,
  rootModel,
  rootAppLabel,
  rootMetadata,
  placeholder = 'Search field',
  className = '',
  autoFocus = false,
  compact = false,
  excludeFields,
  onChange,
  onRequestMetadata,
  onSubmit,
}) => {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resolution, setResolution] = useState<FieldResolution>({
    suggestions: [],
    exactMatch: null,
    error: null,
  })
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const closeTimeout = useRef<number | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      try {
        const nextResolution = await resolveFieldPath(
          query,
          rootModel,
          rootAppLabel,
          rootMetadata,
          onRequestMetadata,
        )
        if (active) {
          setResolution(nextResolution)
          setHighlightedIndex(-1)
        }
      } catch {
        if (active) {
          setResolution({
            suggestions: [],
            exactMatch: null,
            error: 'Could not load relation metadata.',
          })
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    if (!rootModel) {
      setResolution({ suggestions: [], exactMatch: null, error: null })
      return () => {
        active = false
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [onRequestMetadata, query, rootAppLabel, rootMetadata, rootModel])

  const clearCloseTimer = () => {
    if (closeTimeout.current) {
      window.clearTimeout(closeTimeout.current)
      closeTimeout.current = null
    }
  }

  const handleSuggestionClick = (suggestion: FieldSuggestion) => {
    if (suggestion.isRelation) {
      const nextPath = `${suggestion.path}__`
      setQuery(nextPath)
      onChange(nextPath)
      setHighlightedIndex(-1)
      setOpen(true)
      return
    }

    setQuery(suggestion.path)
    onChange(suggestion.path)
    setOpen(false)
    onSubmit?.(suggestion.path)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const visibleSuggestions = resolution.suggestions.filter(
      (s) => !excludeFields?.includes(s.path),
    )

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setHighlightedIndex(0)
        return
      }
      const next = Math.min(highlightedIndex + 1, visibleSuggestions.length - 1)
      setHighlightedIndex(next)
      menuRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.max(highlightedIndex - 1, 0)
      setHighlightedIndex(next)
      menuRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter') {
      if (highlightedIndex >= 0 && visibleSuggestions[highlightedIndex]) {
        event.preventDefault()
        handleSuggestionClick(visibleSuggestions[highlightedIndex])
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
      setHighlightedIndex(-1)
    }
  }

  return (
    <div
      className={`field-autocomplete${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`}
      onFocus={() => {
        clearCloseTimer()
        setOpen(true)
      }}
      onBlur={() => {
        closeTimeout.current = window.setTimeout(() => setOpen(false), 120)
      }}
    >
      <input
        className="field-autocomplete-input"
        value={query}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(event) => {
          const nextValue = event.target.value
          setQuery(nextValue)
          onChange(nextValue)
          setOpen(true)
        }}
        onKeyDown={handleKeyDown}
      />

      {open && (
        <div className="field-autocomplete-menu" ref={menuRef}>
          {loading && <div className="field-picker-empty">Loading fields…</div>}
          {!loading && resolution.error && (
            <div className="field-picker-empty">{resolution.error}</div>
          )}
          {!loading && !resolution.error && resolution.suggestions.length === 0 && (
            <div className="field-picker-empty">No matching fields.</div>
          )}
          {!loading && !resolution.error && resolution.suggestions
            .filter((s) => !excludeFields?.includes(s.path))
            .map((suggestion, index) => (
              <button
                key={suggestion.path}
                type="button"
                className={`field-picker-item${index === highlightedIndex ? ' highlighted' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <span className="field-picker-item-path">{suggestion.path}</span>
                {(suggestion.isRelation ||
                  suggestion.displayLabel.trim().toLowerCase() !==
                    suggestion.path.replace(/__/g, ' ').trim().toLowerCase()) && (
                  <span className="field-picker-item-meta">
                    {suggestion.isRelation
                      ? `Relation → ${suggestion.relatedModel}`
                      : suggestion.displayLabel}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

interface ConditionRowProps {
  node: FilterConditionNode
  rootModel: string
  rootAppLabel?: string
  rootMetadata?: MetadataResponse
  onChange: (id: string, patch: Partial<FilterConditionNode>) => void
  onRemove: (id: string) => void
  onRequestMetadata: (modelName: string, appLabel?: string) => Promise<MetadataResponse>
}

const ConditionRow: React.FC<ConditionRowProps> = ({
  node,
  rootModel,
  rootAppLabel,
  rootMetadata,
  onChange,
  onRemove,
  onRequestMetadata,
}) => (
  <div className="filter-row">
    <FieldAutocomplete
      value={node.field}
      rootModel={rootModel}
      rootAppLabel={rootAppLabel}
      rootMetadata={rootMetadata}
      onChange={(field) => onChange(node.id, { field })}
      onRequestMetadata={onRequestMetadata}
      className="filter-field-autocomplete"
      compact
    />

    <Dropdown
      className="dropdown-op"
      value={node.op}
      options={DEFAULT_OPERATIONS.map((operation) => ({
        value: operation,
        label: operation === 'is_not' ? 'is not' : operation,
      }))}
      onChange={(op) => onChange(node.id, { op })}
    />

    <input
      className="fval"
      type="text"
      placeholder="value…"
      value={node.value}
      onChange={(event) => onChange(node.id, { value: event.target.value })}
    />

    <button
      className="remove-btn"
      type="button"
      onClick={() => onRemove(node.id)}
      title="Remove filter"
    >
      ×
    </button>
  </div>
)

interface FilterGroupEditorProps {
  node: FilterGroupNode
  depth?: number
  isRoot?: boolean
  fallbackField: string
  rootModel: string
  rootAppLabel?: string
  rootMetadata?: MetadataResponse
  onUpdateGroup: (id: string, patch: Partial<FilterGroupNode>) => void
  onUpdateCondition: (id: string, patch: Partial<FilterConditionNode>) => void
  onAddCondition: (groupId: string) => void
  onAddGroup: (groupId: string) => void
  onRemoveNode: (id: string) => void
  onRequestMetadata: (modelName: string, appLabel?: string) => Promise<MetadataResponse>
}

const FilterGroupEditor: React.FC<FilterGroupEditorProps> = ({
  node,
  depth = 0,
  isRoot = false,
  fallbackField,
  rootModel,
  rootAppLabel,
  rootMetadata,
  onUpdateGroup,
  onUpdateCondition,
  onAddCondition,
  onAddGroup,
  onRemoveNode,
  onRequestMetadata,
}) => (
  <div className={`filter-group depth-${depth}`}>
    <div className="filter-group-head">
      <span className="filter-kw where">{isRoot ? 'WHERE' : 'GROUP'}</span>
      <Dropdown
        className="dropdown-group-op"
        value={node.operator}
        options={[
          { value: 'and', label: 'AND' },
          { value: 'or', label: 'OR' },
        ]}
        onChange={(operator) => onUpdateGroup(node.id, { operator })}
      />
      <button
        className="btn btn-ghost mini"
        type="button"
        title="Add a filter condition to this group"
        onClick={() => onAddCondition(node.id)}
      >
        + Rule
      </button>
      <button
        className="btn btn-ghost mini"
        type="button"
        title="Add a nested filter group (AND / OR)"
        onClick={() => onAddGroup(node.id)}
      >
        + Group
      </button>
      {!isRoot && (
        <button
          className="remove-btn"
          type="button"
          onClick={() => onRemoveNode(node.id)}
          title="Remove group"
        >
          ×
        </button>
      )}
    </div>
    <div className="filter-group-body">
      {node.children.length === 0 && (
        <div className="field-hint">No rules in this group.</div>
      )}
      {node.children.map((child) =>
        child.type === 'group' ? (
          <FilterGroupEditor
            key={child.id}
            node={child}
            depth={depth + 1}
            fallbackField={fallbackField}
            rootModel={rootModel}
            rootAppLabel={rootAppLabel}
            rootMetadata={rootMetadata}
            onUpdateGroup={onUpdateGroup}
            onUpdateCondition={onUpdateCondition}
            onAddCondition={onAddCondition}
            onAddGroup={onAddGroup}
            onRemoveNode={onRemoveNode}
            onRequestMetadata={onRequestMetadata}
          />
        ) : (
          <ConditionRow
            key={child.id}
            node={child}
            rootModel={rootModel}
            rootAppLabel={rootAppLabel}
            rootMetadata={rootMetadata}
            onChange={onUpdateCondition}
            onRemove={onRemoveNode}
            onRequestMetadata={onRequestMetadata}
          />
        ),
      )}
      {node.children.length === 0 && fallbackField && (
        <button
          className="btn btn-ghost mini"
          type="button"
          onClick={() => onAddCondition(node.id)}
        >
          Add first rule
        </button>
      )}
    </div>
  </div>
)

const ResultsTable: React.FC<{
  rows: ResultRow[]
  selectedRow: number | null
  onRowSelect: (index: number) => void
  sortField: string
  sortDir: 'asc' | 'desc'
  onSort: (field: string) => void
}> = ({ rows, selectedRow, onRowSelect, sortField, sortDir, onSort }) => {
  if (rows.length === 0) {
    return <div className="empty-state">No results</div>
  }

  const columns = Object.keys(rows[0])

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className={sortField === column ? 'sorted' : ''}
                onClick={() => onSort(column)}
              >
                {column} {sortField === column ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className={selectedRow === index ? 'selected' : ''}
              onClick={() => onRowSelect(index)}
            >
              {columns.map((column) => (
                <td
                  key={column}
                  className={
                    column === 'id'
                      ? 'td-id'
                      : column === 'name'
                        ? 'td-name'
                        : 'td-plain'
                  }
                >
                  {String(row[column] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const buildPaginationItems = (currentPage: number, totalPages: number) => {
  if (totalPages <= 1) {
    return [1] as Array<number | 'ellipsis'>
  }

  const pages = new Set<number>([1, totalPages])
  for (
    let page = Math.max(1, currentPage - 2);
    page <= Math.min(totalPages, currentPage + 2);
    page += 1
  ) {
    pages.add(page)
  }

  const sortedPages = Array.from(pages).sort((left, right) => left - right)
  const items: Array<number | 'ellipsis'> = []

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1]
    if (previousPage && page - previousPage > 1) {
      items.push('ellipsis')
    }
    items.push(page)
  })

  return items
}

interface QueriesPageProps {
  activeModel: string
  activeModelLabel?: string
  activeAppLabel?: string
  activeMetadata?: MetadataResponse
  metadataLoading?: boolean
  defaultPageSize: number
  queryPreset?: QueryRequest | null
  resultsPreset?: QueryResponse | null
  onPresetApplied?: () => void
  onResultsPresetApplied?: () => void
  onSaveQuery?: (input: {
    name: string
    description: string
    payload: QueryRequest
  }) => Promise<void>
  onRequestMetadata: (modelName: string, appLabel?: string) => Promise<MetadataResponse>
  onRunQuery: (payload: QueryRequest) => Promise<QueryResponse>
}

export const QueriesPage: React.FC<QueriesPageProps> = ({
  activeModel,
  activeModelLabel,
  activeAppLabel,
  activeMetadata,
  metadataLoading = false,
  defaultPageSize,
  queryPreset,
  resultsPreset,
  onPresetApplied,
  onResultsPresetApplied,
  onSaveQuery,
  onRequestMetadata,
  onRunQuery,
}) => {
  const directFields = useMemo(() => getDirectFields(activeMetadata), [activeMetadata])
  const directFieldNames = useMemo(
    () => directFields.map((field) => field.name),
    [directFields],
  )
  const validLookupNames = useMemo(
    () => new Set(activeMetadata?.all_lookups || directFieldNames),
    [activeMetadata, directFieldNames],
  )
  const fallbackField = directFieldNames[0] || 'id'
  const hasAppliedPreset = useRef(false)

  const [filters, setFilters] = useState<FilterGroupNode>(() => {
    const urlFilters = new URLSearchParams(window.location.search).get('filters')
    if (urlFilters) {
      try {
        return deserializeFilters(JSON.parse(atob(urlFilters)) as QueryFilterGroup, fallbackField)
      } catch {
        // malformed/legacy share link — fall back to an empty filter group below
      }
    }
    return newGroup(fallbackField, 'and')
  })
  const [limit, setLimit] = useState(defaultPageSize || 100)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultTab, setResultTab] = useState<ResultTab>('table')
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [sortField, setSortField] = useState('id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [results, setResults] = useState<QueryResponse | null>(null)
  const [selectedFields, setSelectedFields] = useState<string[]>(() => {
    const urlFields = new URLSearchParams(window.location.search).get('fields')
    return urlFields ? urlFields.split(',').filter(Boolean) : []
  })
  const [aggregations, setAggregations] = useState<AggregationRow[]>([])
  const [isFieldPickerOpen, setIsFieldPickerOpen] = useState(false)
  const [fieldSearch, setFieldSearch] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle')
  const [csvState, setCsvState] = useState<'idle' | 'done'>('idle')
  const [shareState, setShareState] = useState<'idle' | 'done'>('idle')
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null)
  const [relativeTime, setRelativeTime] = useState('')
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [savedQueryId, setSavedQueryId] = useState<number | null>(null)
  const [presetTitle, setPresetTitle] = useState<string | null>(null)
  const fieldPickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setError(null)
  }, [activeModel])

  useEffect(() => {
    // While metadata is still loading, activeMetadata is undefined and directFieldNames is
    // transiently empty — leave any URL-restored filters/fields alone until it resolves.
    if (!activeMetadata) {
      return
    }

    if (!directFieldNames.length) {
      setFilters(newGroup('', 'and'))
      setSelectedFields([])
      return
    }

    setSelectedFields((current) => {
      const next = current.filter((field) => validLookupNames.has(field))
      if (next.length > 0) {
        return next
      }
      return directFieldNames.slice(0, Math.min(directFieldNames.length, 5))
    })

    setFilters((current) => {
      const normalizeNode = (node: FilterNode): FilterNode => {
        if (node.type === 'group') {
          return { ...node, children: node.children.map((child) => normalizeNode(child)) }
        }
        return {
          ...node,
          field: node.field && validLookupNames.has(node.field) ? node.field : fallbackField,
        }
      }
      return normalizeNode(current) as FilterGroupNode
    })
  }, [activeModel, activeMetadata, directFieldNames, fallbackField, validLookupNames])

  useEffect(() => {
    if (selectedFields.length === 0) return
    setUrlParam('fields', selectedFields.join(','))
  }, [selectedFields])

  useEffect(() => {
    const serialized = serializeFilters(filters)
    if (serialized) {
      setUrlParam('filters', btoa(JSON.stringify(serialized)))
    } else {
      setUrlParam('filters', null)
    }
  }, [filters])

  useEffect(() => {
    if (!lastRunAt) return
    const update = () => setRelativeTime(getRelativeTime(lastRunAt))
    update()
    const id = window.setInterval(update, 30_000)
    return () => window.clearInterval(id)
  }, [lastRunAt])

  useEffect(() => {
    if (!queryPreset || hasAppliedPreset.current) {
      return
    }

    hasAppliedPreset.current = true
    setSavedQueryId(queryPreset.saved_query_id ?? null)
    setPresetTitle(queryPreset.title ?? null)
    setFilters(deserializeFilters(queryPreset.filter_fields, fallbackField))
    setLimit(queryPreset.page_size || defaultPageSize || 100)
    setSelectedFields(
      queryPreset.select_fields?.length
        ? queryPreset.select_fields
        : directFieldNames.slice(0, Math.min(directFieldNames.length, 5)),
    )

    if (resultsPreset) {
      setResults(resultsPreset)
      setLastRunAt(new Date())
      setSelectedRow(null)
      setSortField(Object.keys(resultsPreset.results[0] || {})[0] || 'id')
      onPresetApplied?.()
      onResultsPresetApplied?.()
      hasAppliedPreset.current = false
      return
    }

    void handleRunQuery({
      page: queryPreset.page || 1,
      explicitPayload: queryPreset,
    }).finally(() => {
      onPresetApplied?.()
      hasAppliedPreset.current = false
    })
  }, [
    defaultPageSize,
    directFieldNames,
    fallbackField,
    onPresetApplied,
    onResultsPresetApplied,
    queryPreset,
    resultsPreset,
  ])

  useEffect(() => {
    if (!isFieldPickerOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!fieldPickerRef.current?.contains(event.target as Node)) {
        setIsFieldPickerOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFieldPickerOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFieldPickerOpen])

  const updateNode = (
    node: FilterNode,
    id: string,
    updater: (target: FilterNode) => FilterNode,
  ): FilterNode => {
    if (node.id === id) {
      return updater(node)
    }
    if (node.type === 'group') {
      return {
        ...node,
        children: node.children.map((child) => updateNode(child, id, updater)),
      }
    }
    return node
  }

  const removeNode = (node: FilterNode, id: string): FilterNode | null => {
    if (node.id === id) {
      return null
    }
    if (node.type === 'group') {
      return {
        ...node,
        children: node.children
          .map((child) => removeNode(child, id))
          .filter((child): child is FilterNode => child !== null),
      }
    }
    return node
  }

  const appendToGroup = (node: FilterNode, groupId: string, child: FilterNode): FilterNode => {
    if (node.type === 'group' && node.id === groupId) {
      return { ...node, children: [...node.children, child] }
    }
    if (node.type === 'group') {
      return {
        ...node,
        children: node.children.map((current) => appendToGroup(current, groupId, child)),
      }
    }
    return node
  }

  const handleConditionChange = (id: string, patch: Partial<FilterConditionNode>) => {
    setFilters((current) =>
      updateNode(current, id, (node) =>
        node.type === 'condition' ? { ...node, ...patch } : node,
      ) as FilterGroupNode,
    )
  }

  const handleGroupChange = (id: string, patch: Partial<FilterGroupNode>) => {
    setFilters((current) =>
      updateNode(current, id, (node) =>
        node.type === 'group' ? { ...node, ...patch } : node,
      ) as FilterGroupNode,
    )
  }

  const handleAddConditionToGroup = (groupId: string) => {
    if (!fallbackField) {
      return
    }
    setFilters((current) =>
      appendToGroup(current, groupId, newCondition(fallbackField)) as FilterGroupNode,
    )
  }

  const handleAddGroupToGroup = (groupId: string) => {
    if (!fallbackField) {
      return
    }
    setFilters((current) =>
      appendToGroup(current, groupId, newGroup(fallbackField, 'and')) as FilterGroupNode,
    )
  }

  const handleRemoveFilterNode = (id: string) => {
    setFilters((current) => (removeNode(current, id) as FilterGroupNode) || newGroup(fallbackField, 'and'))
  }

  const toggleField = (field: string) => {
    setSelectedFields((current) => {
      if (current.includes(field)) {
        if (current.length === 1) {
          return current
        }
        return current.filter((item) => item !== field)
      }
      return [...current, field]
    })
  }

  const availableFields = selectedFields.length < validLookupNames.size

  const hasIncompleteFilters = useMemo(() => {
    const walk = (node: FilterNode): boolean => {
      if (node.type === 'condition') {
        return !node.field.trim() || !node.value.trim()
      }
      return node.children.some((child) => walk(child))
    }

    return walk(filters)
  }, [filters])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortField(field)
    setSortDir('asc')
  }

  const addAggregation = () => {
    setAggregations((current) => [
      ...current,
      { id: newId(), field: fallbackField, function: 'count', distinct: false, alias: '' },
    ])
  }

  const updateAggregation = (id: string, patch: Partial<AggregationRow>) => {
    setAggregations((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const removeAggregation = (id: string) => {
    setAggregations((current) => current.filter((row) => row.id !== id))
  }

  const buildPayload = (page: number): QueryRequest => ({
    model: activeModel,
    ...(activeAppLabel ? { app_label: activeAppLabel } : {}),
    select_fields: selectedFields.length > 0 ? selectedFields : ['id'],
    filter_fields: serializeFilters(filters),
    ...(aggregations.some((row) => row.field.trim())
      ? {
          aggregations: aggregations
            .filter((row) => row.field.trim())
            .map((row) => ({
              field: row.field,
              function: row.function,
              distinct: row.distinct,
              ...(row.alias.trim() ? { alias: row.alias.trim() } : {}),
            })),
        }
      : {}),
    page,
    page_size: limit,
    title: presetTitle || `${activeModelLabel || activeModel} query`,
    ...(savedQueryId ? { saved_query_id: savedQueryId } : {}),
  })

  const openSaveDialog = () => {
    setSaveName(presetTitle || `${activeModelLabel || activeModel} query`)
    setSaveDescription('')
    setSaveState('idle')
    setSaveDialogOpen(true)
  }

  const closeSaveDialog = () => {
    setSaveDialogOpen(false)
    setSaveState('idle')
  }

  const handleRunQuery = async ({
    page = 1,
    explicitPayload,
  }: {
    page?: number
    explicitPayload?: QueryRequest
  } = {}) => {
    if (!explicitPayload && hasIncompleteFilters) {
      setError('Every filter rule needs a field and a value.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await onRunQuery(explicitPayload || buildPayload(page))
      setResults(response)
      setLastRunAt(new Date())
      setSelectedRow(null)
      setSortField(Object.keys(response.results[0] || {})[0] || 'id')
    } catch (runError) {
      setResults(null)
      setError(runError instanceof Error ? runError.message : 'Query failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyJson = async () => {
    if (!results) {
      return
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(results.results, null, 2))
      setCopyState('done')
      window.setTimeout(() => setCopyState('idle'), 1600)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  const handleExportCsv = () => {
    if (!results || results.results.length === 0) {
      return
    }

    const columns = Array.from(new Set(results.results.flatMap((row) => Object.keys(row))))

    const escapeCsvValue = (value: unknown) => {
      const normalized = value == null ? '' : String(value)
      if (/[",\n]/.test(normalized)) {
        return `"${normalized.replace(/"/g, '""')}"`
      }
      return normalized
    }

    const csvLines = [
      columns.join(','),
      ...results.results.map((row) =>
        columns.map((column) => escapeCsvValue(row[column])).join(','),
      ),
    ]

    const blob = new Blob([csvLines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeModel.toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setCsvState('done')
    window.setTimeout(() => setCsvState('idle'), 1600)
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareState('done')
      window.setTimeout(() => setShareState('idle'), 1600)
    } catch {}
  }

  const rows = (results?.results || []) as ResultRow[]
  const displayModelLabel = activeModelLabel || activeModel
  const sortedResults = [...rows].sort((left, right) => {
    const leftValue = left[sortField] ?? ''
    const rightValue = right[sortField] ?? ''
    const comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
      numeric: true,
    })
    return sortDir === 'asc' ? comparison : -comparison
  })
  const paginationItems = useMemo(
    () => buildPaginationItems(results?.page || 1, results?.total_pages || 1),
    [results?.page, results?.total_pages],
  )

  return (
    <div className="tab-panel active queries-page">
      <div className="animate-in">
        <div className="page-title-row">
          <h1 className="page-title">Queries</h1>
        </div>
      </div>

      <div className="card animate-in query-builder-card">
        <div className="card-header">
          <span className="card-title">
            {displayModelLabel}
          </span>
        </div>
        <div className="card-body">
          <ResourceRow activeModel={activeModel} activeModelLabel={activeModelLabel} />

          <div className="field-selector">
            <span className="from-label">SELECT</span>
            {metadataLoading && <span className="field-hint">Loading fields…</span>}
            {!metadataLoading && directFieldNames.length === 0 && (
              <span className="field-hint">No fields available.</span>
            )}
            {!metadataLoading &&
              selectedFields.map((field) => (
                <button
                  key={field}
                  type="button"
                  className="resource-chip active"
                  onClick={() => toggleField(field)}
                >
                  {field} ×
                </button>
              ))}
            {!metadataLoading && directFieldNames.length > 0 && (
              <div className="field-picker-wrap">
                <button
                  type="button"
                  className="resource-chip add field-selector-trigger"
                  disabled={!availableFields}
                  onClick={() => {
                    setFieldSearch('')
                    setIsFieldPickerOpen((current) => !current)
                  }}
                >
                  {availableFields ? '+ Add Field' : 'All Fields Added'}
                </button>
                {isFieldPickerOpen && availableFields && (
                  <div className="field-picker-popover" ref={fieldPickerRef}>
                    <div className="field-picker-popover-head">
                      <span className="field-picker-popover-kicker">Add field</span>
                      <button
                        type="button"
                        className="field-picker-close"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          setIsFieldPickerOpen(false)
                        }}
                        aria-label="Close field picker"
                      >
                        ×
                      </button>
                    </div>
                    <FieldAutocomplete
                      value={fieldSearch}
                      rootModel={activeModel}
                      rootAppLabel={activeAppLabel}
                      rootMetadata={activeMetadata}
                      onRequestMetadata={onRequestMetadata}
                      excludeFields={selectedFields}
                      onChange={setFieldSearch}
                      onSubmit={(path) => {
                        if (!selectedFields.includes(path)) {
                          toggleField(path)
                        }
                        setIsFieldPickerOpen(false)
                        setFieldSearch('')
                      }}
                      autoFocus
                      compact
                      className="field-picker-popover-autocomplete"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="aggregation-section">
            <div className="aggregation-header">
              <span className="from-label">AGGREGATE</span>
              <button className="btn btn-ghost mini" type="button" onClick={addAggregation}>
                + Aggregation
              </button>
            </div>
            {aggregations.map((row) => (
              <div key={row.id} className="aggregation-row">
                <FieldAutocomplete
                  value={row.field}
                  rootModel={activeModel}
                  rootAppLabel={activeAppLabel}
                  rootMetadata={activeMetadata}
                  onChange={(field) => updateAggregation(row.id, { field })}
                  onRequestMetadata={onRequestMetadata}
                  className="aggregation-field-autocomplete"
                  compact
                />
                <Dropdown
                  className="dropdown-op"
                  value={row.function}
                  options={AGGREGATION_FUNCTIONS.map((fn) => ({ value: fn, label: fn }))}
                  onChange={(fn) => updateAggregation(row.id, { function: fn })}
                />
                {row.function === 'count' && (
                  <label className="aggregation-distinct">
                    <input
                      type="checkbox"
                      checked={row.distinct}
                      onChange={(event) => updateAggregation(row.id, { distinct: event.target.checked })}
                    />
                    distinct
                  </label>
                )}
                <input
                  className="aggregation-alias"
                  type="text"
                  placeholder={`${row.function}_${row.field || 'field'}`}
                  title="Result column name (optional)"
                  value={row.alias}
                  onChange={(event) => updateAggregation(row.id, { alias: event.target.value })}
                />
                <button
                  className="remove-btn"
                  type="button"
                  onClick={() => removeAggregation(row.id)}
                  title="Remove aggregation"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="filter-rows">
            <FilterGroupEditor
              node={filters}
              isRoot
              fallbackField={fallbackField}
              rootModel={activeModel}
              rootAppLabel={activeAppLabel}
              rootMetadata={activeMetadata}
              onUpdateGroup={handleGroupChange}
              onUpdateCondition={handleConditionChange}
              onAddCondition={handleAddConditionToGroup}
              onAddGroup={handleAddGroupToGroup}
              onRemoveNode={handleRemoveFilterNode}
              onRequestMetadata={onRequestMetadata}
            />
          </div>

          <div className="qactions">
            <button
              className="btn btn-primary"
              title="Execute the query with the current fields and filters"
              onClick={() => void handleRunQuery({ page: 1 })}
              disabled={
                isLoading ||
                metadataLoading ||
                directFieldNames.length === 0 ||
                selectedFields.length === 0
              }
            >
              <IconPlay />
              {isLoading ? 'Running…' : 'Run Query'}
            </button>
            {onSaveQuery && (
              <button
                className="btn btn-secondary"
                title="Save the current query for later reuse"
                onClick={openSaveDialog}
                disabled={
                  metadataLoading ||
                  directFieldNames.length === 0 ||
                  selectedFields.length === 0
                }
              >
                <IconSave /> Save Query
              </button>
            )}
            <button
              className="btn btn-ghost"
              title="Copy shareable link to this query"
              onClick={() => void handleShare()}
              disabled={directFieldNames.length === 0}
            >
              <IconShare /> {shareState === 'done' ? 'Copied!' : 'Share'}
            </button>
            {filters.children.length > 0 && (
              <button
                className="btn btn-ghost"
                title="Remove all active filter rules"
                onClick={() => setFilters(newGroup(fallbackField, 'and'))}
              >
                Clear
              </button>
            )}
          </div>

          {error && <div className="query-error">{error}</div>}
        </div>
      </div>

      <Dialog open={saveDialogOpen} onClose={closeSaveDialog} className="field-picker-overlay">
        <div className="field-picker-backdrop" aria-hidden="true" />
        <div className="field-picker-overlay-shell">
          <DialogPanel className="field-picker-modal save-query-modal">
            <div className="field-picker-modal-head">
              <div>
                <div className="field-picker-modal-kicker">{savedQueryId ? 'Update query' : 'Save query'}</div>
                <DialogTitle className="field-picker-modal-title">
                  {displayModelLabel}
                </DialogTitle>
              </div>
              <button
                type="button"
                className="field-picker-close"
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  closeSaveDialog()
                }}
                aria-label="Close save query dialog"
              >
                ×
              </button>
            </div>
            <div className="save-query-summary">{selectedFields.length} fields selected</div>
            <div className="save-query-dialog-grid">
              <input
                className="save-query-input"
                placeholder="Name"
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
              />
              <textarea
                className="save-query-textarea"
                placeholder="Description"
                value={saveDescription}
                onChange={(event) => setSaveDescription(event.target.value)}
              />
            </div>
            <div className="save-query-actions">
              <div className="save-query-actions-right">
                <button className="btn btn-ghost" type="button" onClick={closeSaveDialog}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={!saveName.trim() || saveState === 'saving'}
                  onClick={async () => {
                    if (!onSaveQuery) {
                      return
                    }
                    setSaveState('saving')
                    try {
                      await onSaveQuery({
                        name: saveName.trim(),
                        description: saveDescription.trim(),
                        payload: buildPayload(1),
                      })
                      setSaveState('saved')
                      window.setTimeout(() => closeSaveDialog(), 300)
                    } catch {
                      setSaveState('idle')
                    }
                  }}
                >
                  {saveState === 'saving'
                    ? (savedQueryId ? 'Updating…' : 'Saving…')
                    : saveState === 'saved'
                      ? (savedQueryId ? 'Updated' : 'Saved')
                      : (savedQueryId ? 'Update Query' : 'Save Query')}
                </button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {results && (
        <div
          className="card animate-in query-results-card"
        >
          <div className="results-meta">
            <span className="result-count">{results.count}</span>
            <span className="result-count-label">results</span>
            <div className="timing-pill">
              <span className="dot">●</span> {results.page_size} / page
            </div>
            {lastRunAt && (
              <div className={`timing-pill${Date.now() - lastRunAt.getTime() > 5 * 60_000 ? ' stale' : ''}`}>
                {relativeTime}
              </div>
            )}
            <div className="card-actions-right">
              <button className="btn btn-ghost" onClick={() => void handleCopyJson()} title="Copy JSON">
                <IconCopy />{' '}
                {copyState === 'done'
                  ? 'Copied'
                  : copyState === 'error'
                    ? 'Copy failed'
                    : 'JSON'}
              </button>
              <button className="btn btn-ghost" onClick={handleExportCsv} title="Export CSV">
                <IconDownload /> {csvState === 'done' ? 'Downloaded' : 'CSV'}
              </button>
            </div>
          </div>

          <div className="result-tabs">
            <button
              className={`rtab${resultTab === 'table' ? ' active' : ''}`}
              onClick={() => setResultTab('table')}
            >
              Table
            </button>
            <button
              className={`rtab${resultTab === 'json' ? ' active' : ''}`}
              onClick={() => setResultTab('json')}
            >
              JSON
            </button>
          </div>

          {resultTab === 'table' && (
            <ResultsTable
              rows={sortedResults}
              selectedRow={selectedRow}
              onRowSelect={setSelectedRow}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}

          {resultTab === 'json' && (
            <div className="json-view">
              <pre>{JSON.stringify(results.results, null, 2)}</pre>
            </div>
          )}

          <div className="pagination">
            <button
              className="ppage ppage-nav"
              disabled={results.page <= 1}
              onClick={() => void handleRunQuery({ page: results.page - 1 })}
            >
              Prev
            </button>
            {paginationItems.map((item, index) =>
              item === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="ppage-ellipsis">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  className={`ppage${results.page === item ? ' cur' : ''}`}
                  onClick={() => void handleRunQuery({ page: item })}
                >
                  {item}
                </button>
              ),
            )}
            <button
              className="ppage ppage-nav"
              disabled={results.page >= results.total_pages}
              onClick={() => void handleRunQuery({ page: results.page + 1 })}
            >
              Next
            </button>
            <span className="page-summary">
              {(results.page - 1) * results.page_size + 1}–
              {Math.min(results.page * results.page_size, results.count)} of {results.count}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
