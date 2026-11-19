import { supabase } from './supabase'

export const CANVAS_API = import.meta.env.VITE_API_URL ?? 'http://localhost:3002'

function send(path, options, token) {
  const { headers, ...rest } = options
  return fetch(`${CANVAS_API}${path}`, {
    ...rest,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })
}

// 로그인 토큰이 만료됐거나 서버가 재시작 직후 거부하면 토큰을 갱신해 한 번 더 시도한다
export async function apiFetch(path, options = {}) {
  const { data } = await supabase.auth.getSession()
  const res = await send(path, options, data?.session?.access_token)
  if (res.status !== 401) return res
  const { data: refreshed } = await supabase.auth.refreshSession()
  const token = refreshed?.session?.access_token
  return token ? send(path, options, token) : res
}
