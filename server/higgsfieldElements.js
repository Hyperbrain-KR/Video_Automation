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
    // 같은 이름이 여러 개면 가장 최근에 등록한 것을 쓴다
    const byName = new Map()
    const newestFirst = [...items].sort((a, b) => (b?.created_at ?? 0) - (a?.created_at ?? 0))
    for (const el of newestFirst) {
      const key = el?.name?.toLowerCase()
      if (key && el.id && !byName.has(key)) byName.set(key, el.id)
    }
    return byName
  }

  // "@mm_c_01-style" 처럼 이름 뒤에 하이픈으로 다른 말이 붙은 경우 뒤에서부터 떼어 가며 찾는다
  const matchName = (byName, raw) => {
    for (let name = raw; name; name = name.includes('-') ? name.slice(0, name.lastIndexOf('-')) : '') {
      if (byName.has(name.toLowerCase())) return name
    }
    return null
  }

  // 멘션 이름(name)은 사용자가 입력한 그대로 저장한다. 이름을 안 주면 Higgsfield 가 display_name 으로 지어낸다.
  async function createElement({ name, displayName, category, mediaId }) {
    const handle = name?.trim().replace(/^@/, '').replace(/\s+/g, '_') || null
    const result = await callTool('elements_create', {
      category,
      display_name: handle ?? displayName,
      ...(handle ? { name: handle } : {}),
      medias: [{ id: mediaId, type: 'media_input' }],
    })
    cache = { at: 0, items: null }
    const text = (result?.content ?? []).map(c => c.text ?? '').join('')
    const receipt = result?.structuredContent?.results?.[0]
    if (result?.isError || receipt?.status !== 'ok' || !receipt.element?.id) {
      const detail = JSON.stringify(receipt ?? {}) + text
      if (handle && /409|already (exists|taken)|is taken|conflict/i.test(detail)) {
        throw new Error(`이미 등록된 이름입니다: @${handle}. 다른 이름으로 등록해주세요.`)
      }
      if (receipt?.status === 'uncertain') {
        throw new Error('등록됐는지 확인되지 않았습니다. 다시 등록하기 전에 @ 목록에 이미 있는지 확인해주세요.')
      }
      throw new Error(text || 'element 생성 실패')
    }
    return receipt.element
  }

  async function resolveElementMentions(prompt) {
    const names = [...new Set([...prompt.matchAll(MENTION)].map(m => m[1]))].filter(n => !FRAME_MENTION.test(n))
    if (!names.length) return { prompt, resolved: [], unresolved: [] }

    let byName = indexByName(await loadAllElements())
    // 방금 등록한 엘리먼트일 수 있으니 못 찾은 이름이 있으면 한 번 새로 받아온다
    if (names.some(n => !matchName(byName, n))) byName = indexByName(await loadAllElements({ fresh: true }))

    const resolved = [], unresolved = []
    const out = prompt.replace(MENTION, (whole, name) => {
      if (FRAME_MENTION.test(name)) return whole
      const found = matchName(byName, name)
      if (!found) { if (!unresolved.includes(name)) unresolved.push(name); return whole }
      if (!resolved.includes(found)) resolved.push(found)
      return `<<<${byName.get(found.toLowerCase())}>>>${name.slice(found.length)}`
    })
    return { prompt: out, resolved, unresolved }
  }

  return { loadAllElements, resolveElementMentions, createElement }
}

// 길이 제한으로 자를 때 <<<id>>> 가 중간에서 잘려 깨진 자리표시자가 남지 않게 한다
export function truncateKeepingPlaceholders(text, max) {
  if (text.length <= max) return text
  let cut = text.slice(0, max)
  const open = cut.lastIndexOf('<<<')
  if (open !== -1 && cut.indexOf('>>>', open) === -1) cut = cut.slice(0, open)
  return cut
}
