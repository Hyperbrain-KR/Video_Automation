const wait = ms => new Promise(r => setTimeout(r, ms))

// 제출된 작업의 결과가 나올 때까지 기다린다. 중단되면 null, 작업이 실패하면 예외.
// 연결 끊김·서버 재시작·로그인 확인 실패는 작업 실패가 아니므로 계속 기다린다.
export async function pollJob({
  fetchStatus, isStopped, onSlow, slowAfterMs = Infinity,
  maxAuthFailures = 12, maxOutages = Infinity, intervalMs = 5000, sleep = wait,
}) {
  const startedAt = Date.now()
  let authFailures = 0
  let outages = 0
  let warnedSlow = false

  while (true) {
    let res, data
    try {
      res = await fetchStatus()
      data = await res.json()
    } catch { /* 연결 끊김·JSON 이 아닌 응답: 아래에서 일시 장애로 처리 */ }
    if (isStopped()) return null

    if (res?.status === 401) {
      if (++authFailures > maxAuthFailures) throw new Error(data?.error || '로그인이 만료됐습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.')
    } else if (!res || !data || res.status >= 500) {
      if (++outages > maxOutages) throw new Error('서버가 응답하지 않아 결과를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } else if (!res.ok) {
      throw new Error(data.error || `상태 조회 오류 ${res.status}`)
    } else {
      authFailures = 0
      outages = 0
      if (data.resultUrl) return data.resultUrl
      if (data.error) throw Object.assign(new Error(data.error), { code: data.code })
      const raw = data.content?.[0]?.text?.slice(0, 200) ?? ''
      if (raw.toLowerCase().includes('something went wrong')) throw new Error(`Higgsfield 오류: ${raw}`)
    }

    if (!warnedSlow && Date.now() - startedAt > slowAfterMs) {
      warnedSlow = true
      onSlow?.()
    }
    await sleep(intervalMs)
    if (isStopped()) return null
  }
}
