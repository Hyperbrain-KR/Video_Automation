import { useRef, useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/config'

// ── Higgsfield Elements 모듈 레벨 캐시 ──────────────────────────────────────
let _hfElems = null  // null = 아직 미조회

export function invalidateElementsCache() {
  _hfElems = null
}

// ── @mention 스팬 CSS 한 번만 주입 ─────────────────────────────────────────
let _stylesInjected = false
function ensureStyles() {
  if (_stylesInjected || typeof document === 'undefined') return
  _stylesInjected = true
  const s = document.createElement('style')
  s.textContent = `
    .rf-mention {
      color: #C8F135;
      background: rgba(200,241,53,0.12);
      border: 1px solid rgba(200,241,53,0.28);
      border-radius: 3px;
      padding: 0 3px 1px;
      font-weight: 700;
      cursor: default;
      user-select: text;
      display: inline;
      line-height: inherit;
      font-size: inherit;
    }
  `
  document.head.appendChild(s)
}

// ── 텍스트 → innerHTML 변환 (줄바꿈 보존 + @name 하이라이트) ────────────────
function textToHtml(text) {
  if (!text) return ''
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .split('\n')
    .map(line => line.replace(
      /@(\w+)/g,
      '<span class="rf-mention" contenteditable="false">@$1</span>'
    ))
    .join('<br>')
}

// innerText로 순수 텍스트 추출 (줄바꿈 보존, \u00A0 정규화)
function extractText(el) {
  return (el.innerText ?? el.textContent ?? '').replace(/\u00A0/g, ' ')
}

// ── 훅 ────────────────────────────────────────────────────────────────────
export function useMentionEditor({ value, onChange }) {
  const editorRef = useRef(null)
  const _dropActive = useRef(false)  // 드롭다운 내부 클릭(스크롤 포함) 감지용

  const [dropOpen, setDropOpen]       = useState(false)
  const [dropItems, setDropItems]     = useState([])
  const [dropFocused, setDropFocused] = useState(-1)
  const [dropQuery, setDropQuery]     = useState('')

  useEffect(() => { ensureStyles() }, [])

  // 외부 value 변경 → DOM 동기화 (프로젝트 전환, 연출 제안 적용 등)
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const current = extractText(el)
    if (current === (value ?? '')) return
    el.innerHTML = textToHtml(value ?? '')
  }, [value])

  // 커서 직전의 @query 정보 반환
  function getCaretInfo() {
    const sel = window.getSelection()
    if (!sel?.rangeCount) return null
    const range = sel.getRangeAt(0)
    let node   = range.startContainer
    let offset = range.startOffset

    // element-level 커서: 앞 형제 텍스트 노드 확인
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (offset === 0) return null
      const prev = node.childNodes[offset - 1]
      if (!prev || prev.nodeType !== Node.TEXT_NODE) return null
      node = prev; offset = prev.textContent.length
    }
    if (node.nodeType !== Node.TEXT_NODE) return null
    // .rf-mention 스팬 내부는 무시
    if (node.parentElement?.classList.contains('rf-mention')) return null

    const text = node.textContent.slice(0, offset)
    const m = text.match(/@(\w*)$/)
    if (!m) return null
    return { query: m[1], node, atOffset: offset - m[0].length, cursorOffset: offset }
  }

  // 사용자 입력 처리: value 업데이트 + @ 드롭다운 트리거
  const handleInput = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const text = extractText(el)
    onChange(text)

    const info = getCaretInfo()
    if (!info) { setDropOpen(false); return }

    const q = info.query.toLowerCase()
    const applyFilter = (elems) => {
      const filtered = (elems ?? []).filter(e =>
        e.name.slice(1).toLowerCase().includes(q)
      )
      setDropItems(filtered)
      setDropFocused(filtered.length > 0 ? 0 : -1)
      setDropQuery(info.query)
      setDropOpen(true)
    }

    if (_hfElems !== null) {
      // 캐시 있음 → 즉시 필터
      applyFilter(_hfElems)
    } else {
      // 첫 @: 빈 목록으로 드롭다운 열어두고, fetch 완료 후 채움
      _hfElems = []
      applyFilter([])
      apiFetch('/api/higgsfield/elements')
        .then(r => r.json())
        .then(d => {
          _hfElems = d.elements ?? []
          applyFilter(_hfElems)
        })
        .catch(() => { _hfElems = [] })
    }
  }, [onChange])

  // 드롭다운에서 element 선택: @query → <span.rf-mention>@name</span> 교체
  const selectItem = useCallback((idx) => {
    if (idx < 0 || idx >= dropItems.length) return
    const element = dropItems[idx]
    const info = getCaretInfo()
    if (!info) { setDropOpen(false); return }

    const { node, atOffset, cursorOffset } = info
    const parent = node.parentNode

    const textBefore = node.textContent.slice(0, atOffset)
    const textAfter  = node.textContent.slice(cursorOffset)

    const beforeNode = textBefore ? document.createTextNode(textBefore) : null
    const span = document.createElement('span')
    span.className = 'rf-mention'
    span.setAttribute('contenteditable', 'false')
    span.textContent = element.name  // 이미 @ 포함
    const spaceNode = document.createTextNode(' ')
    const afterNode = textAfter ? document.createTextNode(textAfter) : null

    // before → span → space → after 순서로 ref 직전에 삽입
    const ref = node.nextSibling
    node.remove()
    const ins = (n) => { if (n) ref ? parent.insertBefore(n, ref) : parent.appendChild(n) }
    ins(beforeNode); ins(span); ins(spaceNode); ins(afterNode)

    // 커서를 삽입된 멘션 직후로 이동
    const sel = window.getSelection()
    const r = document.createRange()
    r.setStart(spaceNode, 1); r.collapse(true)
    sel.removeAllRanges(); sel.addRange(r)
    editorRef.current?.focus()

    onChange(extractText(editorRef.current))
    setDropOpen(false)
    setDropItems([])
    setDropFocused(-1)
  }, [dropItems, onChange])

  // 드롭다운 키보드 처리 — 처리했으면 true 반환 (노드의 keydown이 추가로 실행되지 않도록)
  const handleMentionKeyDown = useCallback((e) => {
    if (!dropOpen) return false
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDropFocused(f => Math.min(f + 1, dropItems.length - 1))
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDropFocused(f => Math.max(f - 1, 0))
      return true
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && dropFocused >= 0 && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      selectItem(dropFocused)
      return true
    }
    if (e.key === 'Escape') {
      setDropOpen(false)
      return true
    }
    return false
  }, [dropOpen, dropFocused, dropItems.length, selectItem])

  // 드롭다운 컨테이너 mousedown → blur 무시 처리
  const handleDropMouseDown = useCallback(() => {
    _dropActive.current = true
  }, [])

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (_dropActive.current) {
        _dropActive.current = false
        editorRef.current?.focus()
        return
      }
      setDropOpen(false)
    }, 160)
  }, [])

  return {
    editorRef,
    handleInput,
    handleMentionKeyDown,
    handleDropMouseDown,
    handleBlur,
    dropOpen,
    dropItems,
    dropFocused,
    dropQuery,
    selectItem,
  }
}
