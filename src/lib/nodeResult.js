const VIDEO_URL = /\.(mp4|webm|mov)(\?|$)/i

// 노드의 resultUrl 에는 앞 노드가 넘겨준 이미지가 섞여 있을 수 있어, 종류가 맞는 것만 이 노드의 결과로 본다
const isOwnKind = (data, url) => !!url && (data.type === 'video') === VIDEO_URL.test(url)

// 이력 기능 이전에 만든 노드는 이력이 비어 있으므로 현재 결과를 이력으로 취급한다
export function ownHistory(data) {
  const history = (data.resultHistory ?? []).filter(u => isOwnKind(data, u))
  if (history.length) return history
  return isOwnKind(data, data.resultUrl) ? [data.resultUrl] : []
}

export function ownResultUrl(data) {
  const history = ownHistory(data)
  if (history.includes(data.resultUrl)) return data.resultUrl
  return history[data.resultIndex] ?? history[history.length - 1] ?? null
}

export function appendResult(data, url) {
  const resultHistory = [...ownHistory(data), url].slice(-5)
  return { resultUrl: url, resultHistory, resultIndex: resultHistory.length - 1 }
}

// 노드의 jobId 는 앞 노드가 결과를 넘겨줄 때 덮어써졌을 수 있어, 이 노드가 직접 제출한 작업 id 를 따로 본다
export function ownJobIdOf(data) {
  return data.ownJobId ?? (data.generatingStartedAt ? data.jobId : null)
}
