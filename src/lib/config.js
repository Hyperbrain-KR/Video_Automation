import { supabase } from './supabase'

export const CANVAS_API = import.meta.env.VITE_API_URL ?? 'http://localhost:3002'

export async function apiFetch(path, options = {}) {
  const { headers, ...rest } = options
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return fetch(`${CANVAS_API}${path}`, {
    ...rest,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })
}
