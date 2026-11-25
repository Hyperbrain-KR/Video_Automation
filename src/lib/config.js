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

// 서버의 요청 크기 한도(server/index.js express.json 10mb)보다 조금 작게 — 넘으면 서버가 요청을 끊어 원인을 알 수 없는 오류가 된다
const MAX_BODY = 10 * 1024 * 1024 - 100 * 1024

// 로그인 토큰이 만료됐거나 서버가 재시작 직후 거부하면 토큰을 갱신해 한 번 더 시도한다
export async function apiFetch(path, options = {}) {
  const size = typeof options.body === 'string' ? options.body.length : 0
  if (size > MAX_BODY) {
    const mb = (size * 3 / 4 / 1024 / 1024).toFixed(1)
    throw new Error(`이미지 용량이 너무 큽니다 (약 ${mb}MB). 7MB 이하로 줄여 다시 등록해주세요.`)
  }
  const { data } = await supabase.auth.getSession()
  const res = await send(path, options, data?.session?.access_token)
  if (res.status !== 401) return res
  const { data: refreshed } = await supabase.auth.refreshSession()
  const token = refreshed?.session?.access_token
  return token ? send(path, options, token) : res
}
