import { supabase } from './supabase'

export const CANVAS_API = import.meta.env.VITE_API_URL ?? 'http://localhost:3002'
// 이행 기간 동안만 함께 전송 — 서버가 로그인 토큰만 받게 되면 제거
const API_SECRET = import.meta.env.VITE_API_SECRET ?? ''

export async function apiFetch(path, options = {}) {
  const { headers, ...rest } = options
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return fetch(`${CANVAS_API}${path}`, {
    ...rest,
    headers: {
      'x-api-secret': API_SECRET,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })
}
