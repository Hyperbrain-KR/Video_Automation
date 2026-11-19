// Higgsfield API 경로에서는 프롬프트의 @name 이 인식되지 않고, <<<element_id>>> 자리표시자만
// 엘리먼트 이미지를 첨부한다(show_reference_elements 도구 설명). 그래서 생성 직전에 바꿔 보낸다.

// 프레임 참조(@image1, @start_frame 등)는 엘리먼트가 아니라 medias 로 첨부되므로 그대로 둔다
const FRAME_MENTION = /^(image\d+|start_frame|end_frame)$/i
const MENTION = /@([\w-]+)/g

export function createElementResolver(callTool) {
  let cache = { at: 0, items: null }

  async function loadAllElements({ fresh = false } = {}) {
    if (!fresh && cache.items && Date.now() - cache.at < 60_000) return cache.items
    const items = []
    let cursor
    for (let page = 0; page < 20; page++) {
      const result = await callTool('show_reference_elements',
        { action: 'list', size: 100, ...(cursor != null ? { cursor } : {}) })
      if (result?.isError) throw new Error(result.content?.[0]?.text || '엘리먼트 목록 조회 실패')
      const pageItems = result?.structuredContent?.items ?? []
      items.push(...pageItems)
      cursor = result?.structuredContent?.next_cursor
      if (cursor == null || pageItems.length === 0) break
    }
    cache = { at: Date.now(), items }
    return items
  }

  const indexByName = items => {
    const byName = new Map()
    for (const el of items) if (el?.name && el?.id) byName.set(el.name.toLowerCase(), el.id)
    return byName
  }

  async function resolveElementMentions(prompt) {
    const names = [...new Set([...prompt.matchAll(MENTION)].map(m => m[1]))].filter(n => !FRAME_MENTION.test(n))
    if (!names.length) return { prompt, resolved: [], unresolved: [] }

    let byName = indexByName(await loadAllElements())
    // 방금 등록한 엘리먼트일 수 있으니 못 찾은 이름이 있으면 한 번 새로 받아온다
    if (names.some(n => !byName.has(n.toLowerCase()))) byName = indexByName(await loadAllElements({ fresh: true }))

    const resolved = [], unresolved = []
    const out = prompt.replace(MENTION, (whole, name) => {
      if (FRAME_MENTION.test(name)) return whole
      const id = byName.get(name.toLowerCase())
      if (!id) { if (!unresolved.includes(name)) unresolved.push(name); return whole }
      if (!resolved.includes(name)) resolved.push(name)
      return `<<<${id}>>>`
    })
    return { prompt: out, resolved, unresolved }
  }

  return { loadAllElements, resolveElementMentions }
}

// 길이 제한으로 자를 때 <<<id>>> 가 중간에서 잘려 깨진 자리표시자가 남지 않게 한다
export function truncateKeepingPlaceholders(text, max) {
  if (text.length <= max) return text
  let cut = text.slice(0, max)
  const open = cut.lastIndexOf('<<<')
  if (open !== -1 && cut.indexOf('>>>', open) === -1) cut = cut.slice(0, open)
  return cut
}
