export const CANVAS_API = import.meta.env.VITE_API_URL ?? 'http://localhost:3002'
const API_SECRET = import.meta.env.VITE_API_SECRET ?? ''

export function apiFetch(path, options = {}) {
  const { headers, ...rest } = options
  return fetch(`${CANVAS_API}${path}`, {
    ...rest,
    headers: { 'x-api-secret': API_SECRET, ...headers },
  })
}
