import type { KeyboardEvent } from 'react'

export function handleRovingKeyDown(
  event: KeyboardEvent<HTMLElement>,
  orientation: 'vertical' | 'horizontal' = 'vertical',
) {
  const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
  const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'

  if (![nextKey, prevKey, 'Home', 'End'].includes(event.key)) {
    return
  }

  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[data-roving-item]'),
  )
  if (items.length === 0) {
    return
  }

  const currentIndex = items.indexOf(document.activeElement as HTMLElement)
  let nextIndex = currentIndex

  if (event.key === nextKey) {
    nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length
  } else if (event.key === prevKey) {
    nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = items.length - 1
  }

  event.preventDefault()
  items[nextIndex]?.focus()
}

export function handleActivationKeyDown(event: KeyboardEvent<HTMLElement>, onActivate: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onActivate()
  }
}
