export const boardFromUrl = () => new URLSearchParams(window.location.search).get('board')

export function openBoard(id) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('board', id)
  else url.searchParams.delete('board')
  window.history.pushState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
