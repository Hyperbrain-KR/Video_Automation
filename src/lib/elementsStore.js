const KEY = 'canvas-elements'
const genId = () => `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

export const ELEMENT_CATEGORIES = ['Character', 'Location', 'Prop', 'Auto']

export const CATEGORY_ICON = {
  Character: '🧑',
  Location:  '🌍',
  Prop:      '📦',
  Auto:      '✨',
}

export function loadElements() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveElements(elements) {
  try { localStorage.setItem(KEY, JSON.stringify(elements)) } catch {}
}

export function addElement(name, category = 'Character') {
  const elements = loadElements()
  const trimmed = name.trim().startsWith('@') ? name.trim() : `@${name.trim()}`
  if (elements.some(e => e.name === trimmed)) return elements
  const next = [...elements, { id: genId(), name: trimmed, category }]
  saveElements(next)
  return next
}

export function deleteElement(id) {
  const next = loadElements().filter(e => e.id !== id)
  saveElements(next)
  return next
}
