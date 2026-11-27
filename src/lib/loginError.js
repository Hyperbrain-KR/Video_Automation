// Google·Supabase 로그인이 실패하면 오류가 주소(?error=… 또는 #error=…)에 붙어 돌아온다.
// 예전에는 이걸 표시하지 않아 아무 안내 없이 로그인 화면으로 돌아왔다.
// supabase 가 주소를 정리하기 전에 읽어야 하므로 앱 진입점 맨 위에서 import 한다.

function read() {
  const q = new URLSearchParams(window.location.search)
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const get = k => q.get(k) ?? h.get(k)
  const error = get('error'), code = get('error_code'), description = get('error_description')
  if (!error && !code && !description) return null

  // 오류 표시는 한 번만 — 주소에서 지운다 (?board= 같은 다른 값은 유지)
  for (const k of ['error', 'error_code', 'error_description', 'sb']) q.delete(k)
  const search = q.toString()
  window.history.replaceState({}, '', window.location.pathname + (search ? `?${search}` : ''))

  const text = `${code ?? ''} ${description ?? ''} ${error ?? ''}`.toLowerCase()
  if (code === 'signup_disabled' || text.includes('signups not allowed')) {
    return '등록되지 않은 계정입니다. 관리자에게 계정 등록을 요청해주세요. 다른 Google 계정으로 로그인했다면 등록된 계정으로 다시 시도해주세요.'
  }
  if (error === 'access_denied' && !description) return 'Google 로그인이 취소되었습니다.'
  return `로그인하지 못했습니다: ${description ?? code ?? error}`
}

export const loginError = read()
if (loginError) console.warn('[login]', loginError)
