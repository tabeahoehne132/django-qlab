export function setUrlParam(key: string, value: string | null) {
  const params = new URLSearchParams(window.location.search)
  if (value === null || value === '') {
    params.delete(key)
  } else {
    params.set(key, value)
  }
  const search = params.toString()
  window.history.replaceState(
    null,
    '',
    search ? `${window.location.pathname}?${search}` : window.location.pathname,
  )
}
