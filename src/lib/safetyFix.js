import { apiFetch } from './config'

const SYSTEM = `You help a Korean ad studio revise an AI image/video prompt that a generation service refused under its content policy.
Make the prompt genuinely compliant by changing what is depicted, so the resulting picture itself is clearly acceptable. Examples: dress or wrap the subject and move the moment to before or after a bath; replace a wound with a light stumble and a worried look; replace a copyrighted character with an original design that nobody would mistake for it (different species, colors and features); replace a brand or named place with a generic one that does not imitate its look.
Never keep the same picture and only reword it. Do not disguise, misspell, encode or euphemize; do not describe a copyrighted character by its recognizable features; do not add disclaimers or negations such as "not a real child", "no nudity", "fictional" or "safe".

The service gives no reason, so identify the most likely causes yourself. Pay particular attention to: minors together with bathing, bare skin or distress; nudity or bare skin; sexualized wording; gore, injury or weapons; medical or body-part close-ups; named people, brands and copyrighted characters.

Return edits, not a rewritten prompt. Output ONLY this JSON, nothing else:
{"edits":[{"find":"exact text copied from the prompt","replace":"replacement in English","reason":"한국어로 짧은 한 줄 이유"}]}

Rules:
- "find" must be copied character for character from the prompt (same case, punctuation, line breaks) and be as short as possible while unambiguous.
- Change only what is needed. Keep the story, composition, camera, style and tone. Edits must not overlap.
- Edit every occurrence of the same problem.
- Keep every @token exactly where it is: do not write any @token in "replace" unless the same @token is in that "find", and never drop one. Never alter dialogue lines or quoted Korean text.
- Keep the total length about the same or shorter.
- "reason" is Korean, under 30 characters, describing why that phrase may be refused.
- If nothing in the prompt plausibly caused a refusal, return {"edits":[]}.`

const mentions = t => (t.match(/@[\w-]+/g) ?? []).sort().join('\n')
const dialogue = t => [
  ...(t.match(/^.*\bDialogue:.*$/gim) ?? []),
  ...(t.match(/["“][^"”\n]*["”]/g) ?? []).filter(q => /[가-힣]/.test(q)),
].join('\n')

export function parseEdits(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end < start) throw new Error('수정 결과를 읽지 못했습니다')
  let edits
  try { edits = JSON.parse(text.slice(start, end + 1)).edits } catch { throw new Error('수정 결과를 읽지 못했습니다') }
  if (!Array.isArray(edits)) throw new Error('수정 결과를 읽지 못했습니다')
  return edits
    .filter(e => e && typeof e.find === 'string' && e.find && typeof e.replace === 'string' && e.find !== e.replace)
    // 원래 없던 @멘션을 새로 넣으면 다른 이미지가 첨부되므로 일반 표현으로 바꾼다
    .map(e => ({ ...e, replace: e.replace.replace(/@[\w-]+/g, t => (e.find.includes(t) ? t : 'the character')) }))
}

// 원문에 편집을 직접 적용한다. segments 를 이어 붙이면 항상 원문/수정문 전체가 되므로 표시되지 않는 변경이 있을 수 없다.
export function applyEdits(prompt, edits) {
  const ranges = []
  const notFound = []
  for (const e of edits) {
    let at = prompt.indexOf(e.find)
    if (at === -1) { notFound.push(e.find); continue }
    for (; at !== -1; at = prompt.indexOf(e.find, at + e.find.length)) {
      const to = at + e.find.length
      if (!ranges.some(r => at < r.to && to > r.from)) ranges.push({ from: at, to, add: e.replace, reason: e.reason ?? '' })
    }
  }
  ranges.sort((a, b) => a.from - b.from)

  const segments = []
  let pos = 0
  for (const r of ranges) {
    if (r.from > pos) segments.push({ same: prompt.slice(pos, r.from) })
    segments.push({ del: prompt.slice(r.from, r.to), add: r.add, reason: r.reason })
    pos = r.to
  }
  if (pos < prompt.length) segments.push({ same: prompt.slice(pos) })
  return { segments, after: segments.map(g => g.same ?? g.add).join(''), notFound }
}

export function checkFix(before, after, limit) {
  if (mentions(before) !== mentions(after)) return '@멘션이 바뀌었습니다'
  if (dialogue(before) !== dialogue(after)) return '대사가 바뀌었습니다'
  if (limit && after.length > Math.max(limit, before.length)) return `글자 수 제한(${limit.toLocaleString()}자)을 넘었습니다`
  return null
}

// 바뀐 문구 안에서 실제로 달라진 단어만 강조하기 위한 단어 단위 비교
export function wordDiff(a, b) {
  const x = a.match(/\s+|[^\s]+/g) ?? []
  const y = b.match(/\s+|[^\s]+/g) ?? []
  const L = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0))
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const out = []
  const push = (type, text) => {
    const last = out[out.length - 1]
    if (last?.type === type) last.text += text
    else out.push({ type, text })
  }
  let i = 0, j = 0
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) { push('same', x[i]); i++; j++ }
    else if (j >= y.length || (i < x.length && L[i + 1][j] >= L[i][j + 1])) push('del', x[i++])
    else push('add', y[j++])
  }
  return out
}

const MAX_ATTEMPTS = 3

export async function requestSafetyFix({ prompt, code, isVideo, limit, projectId }) {
  let problem = ''
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const last = attempt === MAX_ATTEMPTS - 1
    const res = await apiFetch('/api/claude/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: SYSTEM,
        userMessage: [
          `Type: ${isVideo ? 'video' : 'image'} prompt`,
          `Refused for: ${code === 'IP' ? 'detected copyrighted or trademarked subject. Each replacement character must differ from the original in BOTH species and main color, with none of its signature features; brands and places must lose their signature colors and look too' : 'safety / content policy'}`,
          problem && `Your previous answer was rejected: ${problem}. Fix this.`,
          `Prompt:\n<prompt>\n${prompt}\n</prompt>`,
        ].filter(Boolean).join('\n\n'),
        maxTokens: 4000,
        projectId: projectId ?? undefined,
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || `서버 오류 ${res.status}`)
    window.dispatchEvent(new CustomEvent('claude-generate-done'))

    let edits
    try { edits = parseEdits(body.text ?? '') } catch { problem = 'the output was not the required JSON'; continue }
    if (edits.length === 0) return { before: prompt, after: prompt, segments: [{ same: prompt }], count: 0 }

    const breaksMention = e => mentions(e.find) !== mentions(e.replace)
    if (!last && edits.some(breaksMention)) {
      problem = `these edits drop or duplicate an @token from "find": ${JSON.stringify(edits.filter(breaksMention).map(e => e.find))}. Choose a shorter "find" without the @token, and keep fixing ALL the problems you found`
      continue
    }
    edits = edits.filter(e => !breaksMention(e))

    const { segments, after, notFound } = applyEdits(prompt, edits)
    const bad = checkFix(prompt, after, limit)
    if (bad) { problem = `dialogue, @tokens or the length limit${limit ? ` (${limit} characters)` : ''} was violated (${bad})`; continue }
    if (after === prompt || (notFound.length && !last)) {
      problem = `these "find" texts do not exist in the prompt: ${JSON.stringify(notFound)}`
      continue
    }
    return { before: prompt, after, segments, count: segments.filter(g => g.same === undefined).length }
  }
  throw new Error('프롬프트를 안전하게 고치지 못했습니다. 다시 시도하거나 리뷰 노드에서 직접 수정해주세요.')
}
