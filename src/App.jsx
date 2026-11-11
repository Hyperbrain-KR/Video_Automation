import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from './lib/AuthContext'
import LoginPage from './components/LoginPage'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, useReactFlow,
  addEdge, BackgroundVariant,
} from '@xyflow/react'
import { CANVAS_API, apiFetch } from './lib/config'
import { CharactersContext } from './lib/CharactersContext'
import { AssetsContext } from './lib/AssetsContext'
import { ProjectContext } from './lib/ProjectContext'
import { deleteProjectImages, saveImage as saveImageDB, deleteImage as deleteImageDB, loadImage as loadImageDB } from './lib/imageDB'
import { invalidateElementsCache } from './hooks/useMentionEditor'
import { useProjects, getActiveProjectId } from './hooks/useProjects'
import { useAssets } from './hooks/useAssets'
import { nodes0, edges0, buildScene, buildCharSection, nodeTemplates, resetInProgressNodes, dataEdge, SCENE_Y_STEP, CHAR_Y_STEP, BG_Y } from './lib/initialCanvas'
import { addCharSectionRef, deleteCharSectionRef } from './lib/charSectionHandlerRef'
import { useClaudeGenerate } from './hooks/useClaudeGenerate'
import { useHiggsfieldGenerate } from './hooks/useHiggsfieldGenerate'
import { useVersionCheck } from './hooks/useVersionCheck'
import '@xyflow/react/dist/style.css'
import './App.css'

import ReviewGateNode from './nodes/ReviewGateNode'
import StyleAnchorInputNode from './nodes/StyleAnchorInputNode'
import TextInputNode from './nodes/TextInputNode'
import VideoDirectionNode from './nodes/VideoDirectionNode'
import ClaudeNode from './nodes/ClaudeNode'
import HiggsfieldNode from './nodes/HiggsfieldNode'
import SectionBackgroundNode from './nodes/SectionBackgroundNode'
import ReferenceImageNode from './nodes/ReferenceImageNode'
import ContextMenu from './components/ContextMenu'
import SceneNavBar from './components/SceneNavBar'

function SlotDigit({ char }) {
  if (!/\d/.test(char)) {
    return <span style={{ display: 'inline-flex', alignItems: 'center', height: '1em' }}>{char}</span>
  }
  const n = parseInt(char, 10)
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', height: '1em', lineHeight: '1em' }}>
      <span style={{
        display: 'flex', flexDirection: 'column',
        transform: `translateY(${-n}em)`,
        transition: 'transform 0.45s cubic-bezier(0.22,1,0.36,1)',
        willChange: 'transform',
      }}>
        {[0,1,2,3,4,5,6,7,8,9].map(d => (
          <span key={d} style={{ display: 'block', height: '1em', lineHeight: '1em', textAlign: 'center' }}>{d}</span>
        ))}
      </span>
    </span>
  )
}

function SlotCounter({ value }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {String(value).split('').map((ch, i) => <SlotDigit key={i} char={ch} />)}
    </span>
  )
}

const DEFAULT_PROJ_DEFAULTS = {
  image: { model: 'nano_banana_pro', quality: '1k', aspectRatio: 'auto' },
  video: { videoModel: 'kling3_0', videoMode: 'pro', videoAspect: '9:16', sound: 'off', duration: 5 },
}

const nodeTypes = {
  reviewGate: ReviewGateNode,
  styleAnchorInput: StyleAnchorInputNode,
  textInput: TextInputNode,
  videoDirectionInput: VideoDirectionNode,
  claudeNode: ClaudeNode,
  higgsfieldNode: HiggsfieldNode,
  sectionBackground: SectionBackgroundNode,

  referenceImage: ReferenceImageNode,
}

function AssetPanelThumb({ asset, onDelete }) {
  const [src, setSrc] = useState(() => asset.hasLocalImage ? null : (asset.resultUrl ?? null))
  const [hovered, setHovered] = useState(false)
  useEffect(() => {
    if (!asset.hasLocalImage) return
    loadImageDB(`asset-${asset.id}`).then(url => setSrc(url ?? null)).catch(() => {})
  }, [asset.id, asset.hasLocalImage])
  return (
    <div title={asset.name}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', aspectRatio: '1',
        background: 'var(--node-bg)', border: '1px solid var(--sep)' }}
    >
      {src
        ? <img src={src} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📦</div>
      }
      {hovered && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
          <div style={{ position: 'absolute', bottom: 2, left: 2, right: 2,
            fontSize: 8, color: '#fff', textAlign: 'center',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
          <button onClick={onDelete}
            style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, padding: 0,
              background: 'rgba(227,64,84,0.85)', border: 'none', borderRadius: '50%',
              fontSize: 8, color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </>
      )}
    </div>
  )
}

function ElemImgCell({ item, selected, onSelect }) {
  const [src, setSrc] = useState(item.url ?? null)
  useEffect(() => {
    if (!item.dbKey) return
    loadImageDB(item.dbKey).then(url => setSrc(url ?? null)).catch(() => {})
  }, [item.dbKey])
  return (
    <div
      onClick={() => onSelect(item)}
      title={item.label}
      style={{
        position: 'relative', borderRadius: 8, overflow: 'hidden',
        aspectRatio: '1', cursor: 'pointer',
        border: selected ? '2.5px solid var(--drop-accent)' : '2px solid transparent',
        background: 'rgba(255,255,255,0.04)',
        transition: 'border-color 0.15s',
        boxShadow: selected ? '0 0 0 1px var(--drop-accent)' : 'none',
      }}
    >
      {src
        ? <img src={src} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🖼</div>
      }
      {/* 선택 시 반투명 오버레이 */}
      {selected && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'var(--drop-selected-overlay)',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{
        position: 'absolute', top: 4, left: 4,
        fontSize: 8, fontWeight: 800, letterSpacing: '0.04em',
        padding: '2px 6px', borderRadius: 10,
        background: item.tag === '캐릭터' ? 'rgba(200,241,53,0.85)' : 'rgba(100,160,255,0.85)',
        color: '#000',
      }}>{item.tag}</div>
      {selected && (
        <div style={{
          position: 'absolute', bottom: 5, right: 5,
          width: 22, height: 22, borderRadius: '50%',
          background: 'var(--drop-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: '#000', fontWeight: 900,
          boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }}>✓</div>
      )}
    </div>
  )
}

function FlowCanvas() {
  const { screenToFlowPosition, getNodes, getEdges, fitView } = useReactFlow()
  const { user } = useAuth()

  const [nodes, setNodes, onNodesChange] = useNodesState(nodes0)
  const [edges, setEdges, onEdgesChange] = useEdgesState(edges0)
  const [characters, setCharacters] = useState([])
  const [isDataReady, setIsDataReady] = useState(false)
  const [canvasKey, setCanvasKey] = useState('initial')

  // ── 프로젝트 관리 ──────────────────────────────────────────────────────
  const {
    projects, activeId, activeProject, loading,
    loadProject, saveProject, saveProjectDefaults, createProject, setActiveProjectId, switchProject, deleteProject, renameProject,
  } = useProjects(user)

  const [projectDefaults, setProjectDefaults] = useState(DEFAULT_PROJ_DEFAULTS)
  const [showDefaultsModal, setShowDefaultsModal] = useState(false)
  const [showAssetsPanel, setShowAssetsPanel] = useState(false)

  // ── Element 등록 모달 ───────────────────────────────────────────────────
  const [showElemRegModal, setShowElemRegModal] = useState(false)
  const [elemRegActiveTab, setElemRegActiveTab] = useState('file')
  const [elemRegFile, setElemRegFile] = useState(null)
  const [elemRegPreview, setElemRegPreview] = useState(null)
  const [elemRegName, setElemRegName] = useState('')
  const [elemRegCategory, setElemRegCategory] = useState('auto')
  const [elemRegSelectedImg, setElemRegSelectedImg] = useState(null)
  const [elemRegLoading, setElemRegLoading] = useState(false)
  const [elemRegSuccess, setElemRegSuccess] = useState(null)
  const [elemRegSuccessName, setElemRegSuccessName] = useState('')
  const elemRegFileInputRef = useRef(null)
  const [showEdges, setShowEdges] = useState(true)
  const [draftDefaults, setDraftDefaults] = useState(DEFAULT_PROJ_DEFAULTS)

  const [saveState, setSaveState] = useState('idle') // 'idle' | 'pending' | 'saved'
  const [savedAt, setSavedAt]     = useState(null)
  const saveTimerRef = useRef(null)
  const isMountedRef = useRef(false)
  const initialLoadDoneRef = useRef(false)
  const pollingNodeIds = useRef(new Set())
  const generationEpochRef = useRef(0)
  const isSwitchingRef = useRef(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [pendingProjectId, setPendingProjectId] = useState(null)

  // ── Undo history ─────────────────────────────────────────────────────
  const historyRef = useRef([])
  const historyIdxRef = useRef(-1)
  const isUndoRedoRef = useRef(false)

  // ── Element 등록 핸들러 ─────────────────────────────────────────────────
  function openElemRegModal() {
    setElemRegActiveTab('file')
    setElemRegFile(null); setElemRegPreview(null)
    setElemRegName(''); setElemRegCategory('auto')
    setElemRegSelectedImg(null)
    setElemRegLoading(false); setElemRegSuccess(null); setElemRegSuccessName('')
    setShowElemRegModal(true)
  }

  function handleElemRegFileChange(file) {
    if (!file) return
    setElemRegFile(file)
    setElemRegSelectedImg(null)
    const reader = new FileReader()
    reader.onload = e => setElemRegPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  async function handleElemRegister() {
    if (!elemRegFile && !elemRegSelectedImg) return
    setElemRegLoading(true)
    try {
      let body
      if (elemRegFile) {
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader()
          r.onload = e => res(e.target.result.split(',')[1])
          r.onerror = rej
          r.readAsDataURL(elemRegFile)
        })
        body = { fileBase64: b64, filename: elemRegFile.name, contentType: elemRegFile.type || 'image/jpeg', name: elemRegName || undefined, category: elemRegCategory }
      } else {
        body = { imageUrl: elemRegSelectedImg.url, name: elemRegName || elemRegSelectedImg.label || undefined, category: elemRegCategory }
      }
      const res = await apiFetch('/api/higgsfield/register-element', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const resData = await res.json()
      if (!res.ok) throw new Error(resData?.error || 'Error')
      invalidateElementsCache()
      setElemRegSuccessName(resData.name || elemRegName || '(이름 없음)')
      setElemRegSuccess('done')
    } catch (err) {
      alert('등록 실패: ' + err.message)
    } finally {
      setElemRegLoading(false)
    }
  }
  const pushHistory = useCallback(() => {
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1)
    historyRef.current.push({ nodes, edges })
    historyIdxRef.current = historyRef.current.length - 1
    if (historyRef.current.length > 50) {
      historyRef.current.shift()
      historyIdxRef.current--
    }
  }, [nodes, edges])

  const pushHistoryRef = useRef(null)
  useEffect(() => { pushHistoryRef.current = pushHistory }, [pushHistory])

  // ── 키보드 삭제 확인 ─────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pendingDeleteRef = useRef(null)

  const onNodesChangeWithHistory = useCallback((changes) => {
    if (changes.some(c => c.type === 'remove')) pushHistory()
    onNodesChange(changes)
  }, [onNodesChange, pushHistory])

  const onEdgesChangeWithHistory = useCallback((changes) => {
    if (changes.some(c => c.type === 'remove')) pushHistory()
    onEdgesChange(changes)
  }, [onEdgesChange, pushHistory])

  const normalizeSectionNodes = useCallback((nds) =>
    nds.map(n => {
      if (n.type !== 'sectionBackground') return n
      // 마이그레이션: 헤더가 노드 내부에 포함되지 않은 기존 저장 데이터 처리
      if (!n.data?.headerIncluded) {
        return {
          ...n,
          draggable: true, dragHandle: '.section-drag-handle', zIndex: 0,
          position: { x: n.position.x, y: n.position.y - 30 },
          data: { ...n.data, height: (n.data.height ?? 470) + 30, headerIncluded: true, isDragging: false },
        }
      }
      return { ...n, draggable: true, dragHandle: '.section-drag-handle', zIndex: 0, data: { ...n.data, isDragging: false } }
    }), [])

  // 기존 저장 프로젝트의 비디오 연출 노드(textInput)를 videoDirectionInput으로 마이그레이션
  // reviewImageResult / reviewVideoResult 제거 + 승인 상태 higgsfieldImage/Video로 이전
  // normalizeSectionNodes와 체이닝해서 한 번에 처리
  const normalizeNodes = useCallback((nds) => {
    const afterSection = normalizeSectionNodes(nds)
    // approved 상태 수집 (reviewImageResult → higgsfieldImage, reviewVideoResult → higgsfieldVideo)
    const approvedMap = {}
    afterSection.forEach(n => {
      if (n.type === 'reviewGate' && n.data?.approved) {
        if (n.id === 'reviewImageResult' || n.id.startsWith('reviewImageResult-')) {
          const uid = n.id === 'reviewImageResult' ? null : n.id.replace('reviewImageResult-', '')
          approvedMap[uid ? `higgsfieldImage-${uid}` : 'higgsfieldImage'] = true
        } else if (n.id === 'reviewVideoResult' || n.id.startsWith('reviewVideoResult-')) {
          const uid = n.id === 'reviewVideoResult' ? null : n.id.replace('reviewVideoResult-', '')
          approvedMap[uid ? `higgsfieldVideo-${uid}` : 'higgsfieldVideo'] = true
        }
      }
    })
    return afterSection
      .filter(n => n.type !== 'scriptImport' &&
                   n.id !== 'reviewImageResult' && n.id !== 'reviewVideoResult' &&
                   !n.id.startsWith('reviewImageResult-') && !n.id.startsWith('reviewVideoResult-') &&
                   n.id !== 'reviewCharResult' && !n.id.startsWith('reviewCharResult-'))
      .map(n => {
        if (n.type === 'textInput' && n.data?.label?.includes('비디오 연출'))
          return { ...n, type: 'videoDirectionInput' }
        if (approvedMap[n.id])
          return { ...n, data: { ...n.data, approved: true } }
        // higgsfieldChar → higgsfieldImage ref 전파 버그로 오염된 resultUrl 제거
        // generatedAt 없이 resultUrl만 있으면 캐릭터 전파에 의한 오염
        if ((n.id === 'higgsfieldImage' || n.id.startsWith('higgsfieldImage-')) &&
            n.data?.resultUrl && !n.data?.generatedAt) {
          return { ...n, data: { ...n.data, resultUrl: null, jobId: null } }
        }
        return n
      })
  }, [normalizeSectionNodes])

  // 기존 저장 프로젝트의 reviewImageResult/reviewVideoResult 관련 엣지 제거 + 첫프레임 엣지 추가
  const normalizeEdges = useCallback((edgs, normalizedNodes) => {
    const filtered = edgs.filter(e =>
      !e.source?.includes('reviewImageResult') && !e.target?.includes('reviewImageResult') &&
      !e.source?.includes('reviewVideoResult') && !e.target?.includes('reviewVideoResult')
    )
    const toAdd = []
    normalizedNodes.forEach(n => {
      if (n.id !== 'higgsfieldImage' && !n.id.startsWith('higgsfieldImage-')) return
      const uid = n.id === 'higgsfieldImage' ? null : n.id.replace('higgsfieldImage-', '')
      const targetId = uid ? `higgsfieldVideo-${uid}` : 'higgsfieldVideo'
      const edgeId = uid ? `e-hi-hv-${uid}` : 'e-hi-hv'
      const exists = filtered.some(e => e.id === edgeId || (e.source === n.id && e.target === targetId && e.targetHandle === 'image'))
      if (!exists) toAdd.push({ id: edgeId, source: n.id, target: targetId, targetHandle: 'image', label: '첫 프레임', ...dataEdge })
    })
    // 구 캔버스에 e-hc-hi 없으면 추가 (higgsfieldChar → higgsfieldImage 참조 엣지)
    const hcHiExists = filtered.some(e => e.id === 'e-hc-hi' || (e.source === 'higgsfieldChar' && e.target === 'higgsfieldImage' && e.targetHandle === 'ref'))
    const hasChar = normalizedNodes.some(n => n.id === 'higgsfieldChar')
    const hasImg  = normalizedNodes.some(n => n.id === 'higgsfieldImage')
    if (!hcHiExists && hasChar && hasImg) {
      toAdd.push({ id: 'e-hc-hi', source: 'higgsfieldChar', target: 'higgsfieldImage', targetHandle: 'ref', label: '캐릭터 참조', ...dataEdge })
    }
    return [...filtered, ...toAdd]
  }, [])

  const sectionDragRef = useRef(null)

  const onSectionDragStart = useCallback((_, node) => {
    if (node.type !== 'sectionBackground') return
    const { x: sx, y: sy } = node.position
    const w = node.data.width ?? 940
    const h = node.data.height ?? 500
    const captiveIds = getNodes()
      .filter(n => n.type !== 'sectionBackground')
      .filter(n => n.position.x >= sx && n.position.x <= sx + w && n.position.y >= sy && n.position.y <= sy + h)
      .map(n => n.id)
    sectionDragRef.current = { captiveIds, lastPos: { ...node.position } }
    setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isDragging: true } } : n))
  }, [getNodes, setNodes])

  const onSectionDrag = useCallback((_, node) => {
    if (node.type !== 'sectionBackground' || !sectionDragRef.current) return
    const { lastPos, captiveIds } = sectionDragRef.current
    const dx = node.position.x - lastPos.x
    const dy = node.position.y - lastPos.y
    sectionDragRef.current.lastPos = { ...node.position }
    if (!captiveIds.length) return
    setNodes(nds => nds.map(n =>
      captiveIds.includes(n.id)
        ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
        : n
    ))
  }, [setNodes])

  const onSectionDragStop = useCallback((_, node) => {
    if (node.type !== 'sectionBackground') return
    sectionDragRef.current = null
    setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isDragging: false } } : n))
  }, [setNodes])

  useClaudeGenerate(activeId)
  const { assets, saveAsset, deleteAsset } = useAssets(user)
  const resumePolling = useHiggsfieldGenerate(characters, assets, generationEpochRef)

  const resumeInProgressPolling = useCallback((loadedNodes) => {
    loadedNodes
      .filter(n => (n.data?.status === 'generating' || n.data?.status === 'slow') && n.data?.jobId)
      .forEach(n => {
        if (pollingNodeIds.current.has(n.id)) return
        pollingNodeIds.current.add(n.id)
        resumePolling(n.id, n.data.jobId, n.data.type === 'video')
          .finally(() => pollingNodeIds.current.delete(n.id))
      })
  }, [resumePolling])

  // base64 imageDataUrl은 용량 한도 초과 방지를 위해 저장에서 제외
  const stripLargeData = (nodes) => nodes.map(n => {
    if (!n.data?.imageDataUrl) return n
    return { ...n, data: { ...n.data, imageDataUrl: null } }
  })

  // Supabase에서 최초 프로젝트 데이터 로드
  useEffect(() => {
    if (loading || initialLoadDoneRef.current) return
    initialLoadDoneRef.current = true
    const doLoad = async () => {
      isSwitchingRef.current = true
      try {
        if (activeId) {
          const capturedId = activeId
          const data = await loadProject(capturedId)
          if (getActiveProjectId() !== capturedId) return
          if (data) {
            isMountedRef.current = false  // 로드 후 auto-save skip
            const loadedNodes = normalizeNodes(data.nodes ?? nodes0)
            setNodes(resetInProgressNodes(loadedNodes))
            setEdges(normalizeEdges(data.edges ?? edges0, loadedNodes))
            setCharacters(data.characters ?? [])
            if (data.defaults) { setProjectDefaults(data.defaults); setDraftDefaults(data.defaults) }
            resumeInProgressPolling(loadedNodes)
          }
        }
      } catch (e) {
        console.error('[초기 로드 실패]', e)
      } finally {
        isSwitchingRef.current = false
        setIsDataReady(true)
      }
    }
    doLoad()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // 노드/엣지 변경 시 auto-save (마운트 직후 첫 렌더는 skip, undo/redo 중은 skip)
  useEffect(() => {
    clearTimeout(saveTimerRef.current)
    if (!isMountedRef.current) { isMountedRef.current = true; return }
    if (isUndoRedoRef.current) { isUndoRedoRef.current = false; return }
    setSaveState('pending')
    const snapNodes = stripLargeData(nodes)
    const snapEdges = edges
    const snapChars = characters
    const snapActiveId = activeId
    saveTimerRef.current = setTimeout(async () => {
      try {
        const dirtyNodes = snapNodes.filter(n => n.data?.resultUrl)
        console.log(`[auto-save] → projectId: ${snapActiveId}, resultUrl 있는 노드:`, dirtyNodes.map(n => `${n.id}(${n.data?.resultUrl?.slice(0,40)})`))
        if (snapActiveId) {
          await saveProject(snapActiveId, snapNodes, snapEdges, snapChars)
        } else {
          // 타이머 발동 시점에 이미 다른 경로(handleCreateProject 등)에서
          // 프로젝트가 생성됐을 수 있으므로, localStorage를 직접 확인하여 충돌 방지
          if (getActiveProjectId()) return
          const newTimerId = await createProject('내 프로젝트', snapNodes, snapEdges, snapChars)
          if (!newTimerId) return
          // createProject 대기 중 handleCreateProject가 먼저 완료되었을 수 있음 → 재확인
          if (!getActiveProjectId()) setActiveProjectId(newTimerId)
        }
        setSaveState('saved')
        setSavedAt(new Date())
      } catch (e) {
        console.warn('캔버스 저장 실패:', e)
        setSaveState('idle')
      }
    }, 1500)
    return () => clearTimeout(saveTimerRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, characters])

  const handleSwitchProject = useCallback(async (id) => {
    if (isSwitchingRef.current) return
    isSwitchingRef.current = true
    setIsSwitching(true)
    setPendingProjectId(id)
    try {
      generationEpochRef.current++
      clearTimeout(saveTimerRef.current)
      isMountedRef.current = false
      if (activeId) await saveProject(activeId, stripLargeData(getNodes()), getEdges(), characters)
      const data = await switchProject(id)
      if (data) {
        const loadedNodes = normalizeNodes(data.nodes ?? nodes0)
        const dirtyLoaded = loadedNodes.filter(n => n.data?.resultUrl)
        console.log(`[switchProject] 로드된 projectId: ${id}, resultUrl 있는 노드:`, dirtyLoaded.map(n => `${n.id}(${n.data?.resultUrl?.slice(0,40)})`))
        setNodes(resetInProgressNodes(loadedNodes))
        setEdges(normalizeEdges(data.edges ?? edges0, loadedNodes))
        setCharacters(data.characters ?? [])
        const d = data.defaults ?? DEFAULT_PROJ_DEFAULTS
        setProjectDefaults(d); setDraftDefaults(d)
        setCanvasKey(id)
        resumeInProgressPolling(loadedNodes)
      }
      setSaveState('idle')
      setSavedAt(null)
      isMountedRef.current = false
    } finally {
      isSwitchingRef.current = false
      setIsSwitching(false)
      setPendingProjectId(null)
    }
  }, [activeId, characters, getNodes, getEdges, saveProject, switchProject, setNodes, setEdges, setCharacters, setCanvasKey, resumeInProgressPolling, normalizeNodes, normalizeEdges])

  const handleDeleteProject = useCallback(async (id) => {
    if (isSwitchingRef.current) return
    isSwitchingRef.current = true
    setIsSwitching(true)
    clearTimeout(saveTimerRef.current)
    isMountedRef.current = false
    try {
      // 삭제할 프로젝트의 노드/캐릭터 데이터로 이미지 키 수집
      if (id === activeId) {
        deleteProjectImages(getNodes(), characters, id).catch(() => {})
      } else {
        loadProject(id).then(data => {
          if (data) deleteProjectImages(data.nodes, data.characters, id).catch(() => {})
        })
      }
      const remaining = await deleteProject(id)
      if (id === activeId) {
        if (remaining.length > 0) {
          const data = await switchProject(remaining[0].id)
          if (data) {
            isMountedRef.current = false
            const loadedNodes = normalizeNodes(data.nodes ?? nodes0)
            setNodes(resetInProgressNodes(loadedNodes))
            setEdges(normalizeEdges(data.edges ?? edges0, loadedNodes))
            setCharacters(data.characters ?? [])
          }
        } else {
          setNodes(nodes0)
          setEdges(edges0)
          setCharacters([])
        }
        setSaveState('idle')
        setSavedAt(null)
        isMountedRef.current = false
      }
    } finally {
      isSwitchingRef.current = false
      setIsSwitching(false)
    }
  }, [activeId, characters, getNodes, loadProject, deleteProject, switchProject, setNodes, setEdges, setCharacters, normalizeNodes, normalizeEdges])

  const handleCreateProject = useCallback(async (name) => {
    if (isSwitchingRef.current) return
    isSwitchingRef.current = true
    setIsSwitching(true)
    try {
      generationEpochRef.current++
      clearTimeout(saveTimerRef.current)
      isMountedRef.current = false
      if (activeId) await saveProject(activeId, stripLargeData(getNodes()), getEdges(), characters)
      const freshNodes = JSON.parse(JSON.stringify(nodes0))
      const freshEdges = JSON.parse(JSON.stringify(edges0))
      const newId = await createProject(name, freshNodes, freshEdges, [])
      setActiveProjectId(newId)
      setNodes(freshNodes)
      setEdges(freshEdges)
      setCharacters([])
      setCanvasKey(newId ?? `new-${Date.now()}`)
      setSaveState('idle')
      setSavedAt(null)
      isMountedRef.current = false  // handleSwitchProject와 동일하게: 첫 렌더에서 auto-save 차단
    } finally {
      isSwitchingRef.current = false
      setIsSwitching(false)
    }
  }, [activeId, characters, getNodes, getEdges, saveProject, createProject, setActiveProjectId, setNodes, setEdges, setCharacters, setCanvasKey])

  const handleResetProject = useCallback(() => {
    const DROP = ['resultUrl', 'resultHistory', 'resultIndex', 'status', 'jobId', 'creditsUsed', 'approved',
                  'error', 'generatingStartedAt', 'generatedAt', 'sheetGenerating', 'sheetError']
    setNodes(nds => nds.map(n => {
      if (n.type !== 'higgsfieldNode') return n
      const clean = { ...n.data }
      DROP.forEach(k => delete clean[k])
      clean.status = 'idle'
      return { ...n, data: clean }
    }))
  }, [setNodes])

  // ── 캐릭터 저장소 (프로젝트별 — auto-save와 함께 저장됨) ────────────────
  const saveCharacter = useCallback((name, resultUrl) => {
    const id = `char-${Date.now()}`
    if (resultUrl?.startsWith('data:')) {
      saveImageDB(`char-${id}`, resultUrl).catch(e => console.warn('캐릭터 이미지 저장 실패:', e))
      setCharacters(prev => [...prev, { id, name, hasLocalImage: true }])
    } else {
      setCharacters(prev => [...prev, { id, name, resultUrl }])
    }
  }, [])
  const deleteCharacter = useCallback((charId) => {
    setCharacters(prev => prev.filter(c => c.id !== charId))
    deleteImageDB(`char-${charId}`).catch(() => {})
  }, [])
  const [contextMenu, setContextMenu] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('canvas-theme') ?? 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('canvas-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    document.documentElement.classList.add('theme-transitioning')
    setTheme(t => t === 'dark' ? 'light' : 'dark')
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 350)
  }


  // ── 캐릭터 섹션 추가/삭제 ────────────────────────────────────
  const addCharSection = useCallback(() => {
    pushHistory()
    const bg1Nodes = getNodes().filter(n => n.id === 'bg-s1' || n.id.startsWith('bg-s1-'))
    const maxBgY = bg1Nodes.length ? Math.max(...bg1Nodes.map(n => n.position.y)) : BG_Y - CHAR_Y_STEP
    const nextCharIdx = Math.ceil((maxBgY - BG_Y) / CHAR_Y_STEP) + 2
    const { nodes: newNodes, edges: newEdges } = buildCharSection(nextCharIdx)
    setNodes(nds => [...nds, ...newNodes])
    setEdges(eds => [...eds, ...newEdges])
  }, [pushHistory, getNodes, setNodes, setEdges])

  const deleteCharSection = useCallback((uid) => {
    if (!uid) return
    pushHistory()
    setNodes(nds => nds.filter(n => !n.id.endsWith(`-${uid}`)))
    setEdges(eds => eds.filter(e => !e.id.endsWith(`-${uid}`)))
  }, [pushHistory, setNodes, setEdges])

  useEffect(() => { addCharSectionRef.current = addCharSection }, [addCharSection])
  useEffect(() => { deleteCharSectionRef.current = deleteCharSection }, [deleteCharSection])

  // ── 씬 삭제 ──────────────────────────────────────────────────
  const deleteScene = useCallback((uid) => {
    if (!uid) return  // 씬 1 보호
    pushHistory()
    setNodes(nds => nds.filter(n => !n.id.endsWith(`-${uid}`)))
    setEdges(eds => eds.filter(e => !e.id.endsWith(`-${uid}`)))
  }, [pushHistory, setNodes, setEdges])

  // ── 씬 추가 ──────────────────────────────────────────────────
  const addScene = useCallback(() => {
    const bg2Nodes = getNodes().filter(n => n.id === 'bg-s2' || n.id.startsWith('bg-s2-'))
    const maxBgY = bg2Nodes.length ? Math.max(...bg2Nodes.map(n => n.position.y)) : BG_Y - SCENE_Y_STEP
    // 삭제로 생긴 갭을 건너뛰기 위해 max y 기준으로 다음 위치 계산
    const nextSceneIdx = Math.ceil((maxBgY - BG_Y) / SCENE_Y_STEP) + 2
    const { nodes: newNodes, edges: newEdges } = buildScene(nextSceneIdx, projectDefaults.image, projectDefaults.video)
    setNodes(nds => [...nds, ...newNodes])
    setEdges(eds => [...eds, ...newEdges])
  }, [getNodes, setNodes, setEdges, projectDefaults])

  const applyDefaultsToAll = useCallback((defaults) => {
    const d = defaults ?? projectDefaults
    const targetPromptType = d.video?.videoModel === 'seedance_2_0' ? 'claudeSeedance' : 'claudeVideo'
    setNodes(nds => nds.map(n => {
      if (n.type === 'claudeNode' && ['claudeVideo', 'claudeSeedance'].includes(n.data?.promptType))
        return { ...n, data: { ...n.data, promptType: targetPromptType } }
      if (n.type !== 'higgsfieldNode') return n
      if (n.data.type === 'image' && n.data.label !== '캐릭터 생성')
        return { ...n, data: { ...n.data, ...d.image } }
      if (n.data.type === 'video')
        return { ...n, data: { ...n.data, ...d.video } }
      return n
    }))
  }, [setNodes, projectDefaults])

  // 노드 연결
  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({ ...params, type: 'smoothstep' }, eds))
  }, [setEdges])

  // ── Higgsfield 크레딧 조회 ───────────────────────────────
  const [hfCredits, setHfCredits] = useState(null)
  const [hfCreditsRaw, setHfCreditsRaw] = useState(null)
  const fetchHfCredits = useCallback(() => {
    apiFetch('/api/higgsfield/credits')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setHfCredits('error'); return }
        setHfCredits(d.credits)
        setHfCreditsRaw(d.raw ?? null)
      })
      .catch(() => setHfCredits('error'))
  }, [])

  // ── 업데이트 알림 ─────────────────────────────────────────
  const { hasUpdate, changelog } = useVersionCheck()
  const [showChangelog, setShowChangelog] = useState(false)
  const [showTagLegend, setShowTagLegend] = useState(false)
  const [openMonths, setOpenMonths] = useState(new Set())
  const [openDates, setOpenDates] = useState(new Set())
  const [changelogSeen, setChangelogSeen] = useState(() => {
    try { return localStorage.getItem('changelog-seen-v3') ?? '' } catch { return '' }
  })
  const changelogNewKey = useMemo(() => {
    if (!changelog.length) return ''
    const first = changelog[0]
    const newCount = first.items?.filter(i => i.startsWith('[NEW]')).length ?? 0
    return `${first.date}-${newCount}`
  }, [changelog])
  const openChangelogModal = useCallback(() => {
    if (changelog.length) {
      const first = changelog[0]
      const [y, m] = first.date.split('-')
      setOpenMonths(new Set([`${y}-${m}`]))
      setOpenDates(new Set([first.date]))
    }
    setShowChangelog(true)
  }, [changelog])
  const closeChangelog = useCallback(() => {
    try { localStorage.setItem('changelog-seen-v3', changelogNewKey) } catch (e) { void e }
    setChangelogSeen(changelogNewKey)
    setShowChangelog(false)
    setShowTagLegend(false)
  }, [changelogNewKey])

  // ── Higgsfield 인증 오류 감지 ────────────────────────────
  const hasHiggsfieldAuthError = useMemo(
    () => nodes.some(n => n.data?.status === 'auth_error') || hfCredits === 'error',
    [nodes, hfCredits]
  )
  useEffect(() => {
    fetchHfCredits()
    const interval = setInterval(fetchHfCredits, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchHfCredits])
  useEffect(() => {
    const handler = () => { if (!document.hidden) fetchHfCredits() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [fetchHfCredits])
  useEffect(() => {
    const handler = () => setTimeout(fetchHfCredits, 3000)
    window.addEventListener('higgsfield-generate-done', handler)
    return () => window.removeEventListener('higgsfield-generate-done', handler)
  }, [fetchHfCredits])

  // ── Claude 사용량 조회 ───────────────────────────────────
  const [claudeCost, setClaudeCost] = useState(null)
  const fetchClaudeCost = useCallback(() => {
    if (!activeId) return
    apiFetch(`/api/usage/claude?projectId=${encodeURIComponent(activeId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setClaudeCost('error'); return }
        setClaudeCost(d.cost ?? 0)
      })
      .catch(() => setClaudeCost('error'))
  }, [activeId])
  useEffect(() => { fetchClaudeCost() }, [fetchClaudeCost])
  useEffect(() => {
    const handler = () => fetchClaudeCost()
    window.addEventListener('claude-generate-done', handler)
    return () => window.removeEventListener('claude-generate-done', handler)
  }, [fetchClaudeCost])

  // ── 활성 노드 엣지 강조 ──────────────────────────────────
  const activeEdges = useMemo(() => {
    const activeIds = new Set(
      nodes
        .filter(n => n.data?.status === 'loading' || n.data?.status === 'generating')
        .map(n => n.id)
    )
    if (activeIds.size === 0) return edges
    return edges.map(edge => {
      if (!activeIds.has(edge.source) && !activeIds.has(edge.target)) return edge
      return {
        ...edge,
        animated: true,
        style: { ...edge.style, stroke: '#22c55e', strokeWidth: 2 },
        className: (edge.className ?? '') + ' edge-active',
      }
    })
  }, [edges, nodes])

  // ── 우클릭: 빈 캔버스 ────────────────────────────────────
  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault()
    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setContextMenu({ x: event.clientX, y: event.clientY, flowPos, mode: 'pane' })
  }, [screenToFlowPosition])

  // ── 우클릭: 노드 ─────────────────────────────────────────
  const onNodeContextMenu = useCallback((event, node) => {
    if (node.selectable === false) return
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, mode: 'node', nodeId: node.id })
  }, [])

  // ── 우클릭: 엣지 ─────────────────────────────────────────
  const onEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, mode: 'edge', edgeId: edge.id })
  }, [])

  const onPaneClick = useCallback(() => setContextMenu(null), [])

  // ── 노드 추가 ─────────────────────────────────────────────
  const handleAddNode = useCallback((nodeKey) => {
    const tmpl = nodeTemplates[nodeKey]
    if (!tmpl || !contextMenu) return
    setNodes(nds => [
      ...nds,
      {
        id: `${nodeKey}-${Date.now()}`,
        position: contextMenu.flowPos,
        ...tmpl,
      },
    ])
  }, [contextMenu, setNodes])

  // ── 노드 삭제 / 복제 ─────────────────────────────────────
  const handleNodeAction = useCallback((action) => {
    if (!contextMenu?.nodeId) return
    const id = contextMenu.nodeId
    if (action === 'delete') {
      pushHistory()
      setNodes(nds => nds.filter(n => n.id !== id))
      setEdges(eds => eds.filter(e => e.source !== id && e.target !== id))
    } else if (action === 'duplicate') {
      const node = nodes.find(n => n.id === id)
      if (!node) return
      setNodes(nds => [
        ...nds,
        { ...node, id: `${node.type}-${Date.now()}`, position: { x: node.position.x + 30, y: node.position.y + 30 }, selected: false },
      ])
    }
  }, [contextMenu, nodes, pushHistory, setNodes, setEdges])

  // ── 엣지 삭제 ─────────────────────────────────────────────
  const handleEdgeAction = useCallback((action) => {
    if (!contextMenu?.edgeId) return
    if (action === 'delete') {
      pushHistory()
      setEdges(eds => eds.filter(e => e.id !== contextMenu.edgeId))
    }
  }, [contextMenu, pushHistory, setEdges])

  useEffect(() => {
    const blockCut = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
        const el = document.activeElement
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', blockCut, true)
    return () => window.removeEventListener('keydown', blockCut, true)
  }, [])

  useEffect(() => {
    const handleUndoRedo = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'z') return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      if (e.shiftKey) {
        // Redo: idx를 앞으로
        if (historyIdxRef.current >= historyRef.current.length - 1) return
        historyIdxRef.current++
        const snap = historyRef.current[historyIdxRef.current]
        isUndoRedoRef.current = true
        setNodes(snap.nodes)
        setEdges(snap.edges)
      } else {
        // Undo: 현재 상태를 history에 push한 뒤 idx를 뒤로
        if (historyIdxRef.current < 0) return
        const snap = historyRef.current[historyIdxRef.current]
        historyIdxRef.current--
        isUndoRedoRef.current = true
        setNodes(snap.nodes)
        setEdges(snap.edges)
      }
    }
    window.addEventListener('keydown', handleUndoRedo)
    return () => window.removeEventListener('keydown', handleUndoRedo)
  }, [setNodes, setEdges])

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const selNodes = getNodes().filter(n => n.selected)
      const selEdges = getEdges().filter(eg => eg.selected)
      if (selNodes.length === 0 && selEdges.length === 0) return
      e.preventDefault()
      pendingDeleteRef.current = {
        nodeIds: selNodes.map(n => n.id),
        edgeIds: selEdges.map(eg => eg.id),
      }
      setConfirmDelete(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [getNodes, getEdges])

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDeleteRef.current) return
    const { nodeIds, edgeIds } = pendingDeleteRef.current
    pushHistoryRef.current?.()
    if (nodeIds.length > 0) {
      const idSet = new Set(nodeIds)
      setNodes(nds => nds.filter(n => !idSet.has(n.id)))
      setEdges(eds => eds.filter(e => !idSet.has(e.source) && !idSet.has(e.target)))
    }
    if (edgeIds.length > 0) {
      const edgeIdSet = new Set(edgeIds)
      setEdges(eds => eds.filter(e => !edgeIdSet.has(e.id)))
    }
    pendingDeleteRef.current = null
    setConfirmDelete(false)
  }, [setNodes, setEdges])

  useEffect(() => {
    if (!confirmDelete) return
    const handler = (e) => {
      if (e.key === 'Escape') { pendingDeleteRef.current = null; setConfirmDelete(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [confirmDelete])

  useEffect(() => {
    const handler = (e) => {
      if (e.shiftKey && e.code === 'Space') {
        const el = document.activeElement
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
        e.preventDefault()
        fitView({ padding: 0.1, duration: 400 })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fitView])

  const handleContextMenuSelect = useCallback((key) => {
    if (contextMenu?.mode === 'node') handleNodeAction(key)
    else if (contextMenu?.mode === 'edge') handleEdgeAction(key)
    else handleAddNode(key)
  }, [contextMenu, handleNodeAction, handleEdgeAction, handleAddNode])

  // 이미지 드롭 → image 노드 생성

  return (
    <AssetsContext.Provider value={{ assets, saveAsset, deleteAsset }}>
    <CharactersContext.Provider value={{ characters, saveCharacter, deleteCharacter }}>
    <ProjectContext.Provider value={activeId}>
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      <SceneNavBar
        nodes={nodes}
        onAddScene={addScene}
        onDeleteScene={deleteScene}
        projects={projects}
        activeProject={activeProject}
        saveState={saveState}
        savedAt={savedAt}
        isSwitching={isSwitching}
        pendingProjectId={pendingProjectId}
        onSwitchProject={handleSwitchProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={renameProject}
        onResetProject={handleResetProject}
      />
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      {!isDataReady && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 9999,
          background: 'var(--bg, #0A0A0F)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1, #F4F4F4)' }}>Canvas</div>
          <div style={{ fontSize: 12, color: 'rgba(244,244,244,0.4)' }}>불러오는 중...</div>
        </div>
      )}
      {/* 좌하단 버튼 그룹 */}
      <div style={{
        position: 'fixed', bottom: 129, left: 12, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* 프로젝트 기본값 설정 버튼 */}
        <button
          onClick={() => { setDraftDefaults(projectDefaults); setShowDefaultsModal(true) }}
          title="생성 기본값 설정"
          style={{
            height: 32, paddingInline: 10, borderRadius: 7,
            border: '1px solid var(--controls-border)',
            background: 'var(--controls-bg)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 700, color: 'var(--t4)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >⚙ 생성 기본값</button>

        {/* Element 등록 버튼 */}
        <button
          onClick={openElemRegModal}
          title="Element 등록"
          style={{
            height: 32, paddingInline: 10, borderRadius: 7,
            border: '1px solid var(--controls-border)',
            background: 'var(--controls-bg)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 700, color: 'var(--drop-accent)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >✦ Element 등록</button>

      {/* 기본값 설정 모달 */}
      {showDefaultsModal && (
        <div
          onClick={() => setShowDefaultsModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--node-bg, #12131f)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: 24, width: 300,
              backdropFilter: 'blur(20px)', boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)' }}>⚙ 생성 기본값 설정</div>

            {/* 이미지 */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#29D9D9', marginBottom: 8, letterSpacing: '0.06em' }}>이미지</div>
              {[
                { label: '모델', key: 'model', opts: [['nano_banana_pro','나노바나나 Pro'],['gpt_image_2','GPT 이미지 2']] },
                { label: '퀄리티', key: 'quality', opts: draftDefaults.image.model === 'gpt_image_2'
                    ? [['low','Low'],['medium','Medium'],['high','High']]
                    : [['720','720p'],['1k','1K'],['2k','2K'],['4k','4K']] },
                { label: '비율', key: 'aspectRatio', opts: [['auto','Auto'],['1:1','1:1'],['3:4','3:4'],['4:3','4:3'],['9:16','9:16'],['16:9','16:9']] },
              ].map(({ label, key, opts }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--t4)', width: 44, flexShrink: 0 }}>{label}</span>
                  <select
                    value={draftDefaults.image[key]}
                    onChange={e => setDraftDefaults(d => ({ ...d, image: { ...d.image, [key]: e.target.value,
                      ...(key === 'model' ? { quality: e.target.value === 'gpt_image_2' ? 'high' : '1k' } : {}) } }))}
                    style={{ flex: 1, background: 'var(--node-input,#1a1b2e)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 5, color: 'var(--t2)', padding: '4px 6px', fontSize: 10, fontFamily: 'inherit' }}
                  >
                    {opts.map(([v, l]) => <option key={v} value={v} style={{ background: '#0d1020' }}>{l}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* 비디오 */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(170,110,255,1)', marginBottom: 8, letterSpacing: '0.06em' }}>비디오</div>
              {(() => {
                const isSeedance = draftDefaults.video.videoModel === 'seedance_2_0'
                const rows = [
                  { label: '모델', key: 'videoModel', opts: [['kling3_0','Kling 3.0'],['seedance_2_0','Seedance 2.0']] },
                  ...(!isSeedance ? [{ label: '모드', key: 'videoMode', opts: [['std','Standard'],['pro','Pro'],['4k','4K']] }] : []),
                  { label: '비율', key: 'videoAspect', opts: [['16:9','16:9'],['9:16','9:16'],['1:1','1:1']] },
                  { label: '오디오', key: 'sound', opts: [['off','Off'],['on','On']] },
                ]
                return rows.map(({ label, key, opts }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--t4)', width: 44, flexShrink: 0 }}>{label}</span>
                    <select
                      value={draftDefaults.video[key]}
                      onChange={e => setDraftDefaults(d => ({ ...d, video: { ...d.video, [key]: e.target.value } }))}
                      style={{ flex: 1, background: 'var(--node-input,#1a1b2e)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 5, color: 'var(--t2)', padding: '4px 6px', fontSize: 10, fontFamily: 'inherit' }}
                    >
                      {opts.map(([v, l]) => <option key={v} value={v} style={{ background: '#0d1020' }}>{l}</option>)}
                    </select>
                  </div>
                ))
              })()}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--t4)', width: 44, flexShrink: 0 }}>길이</span>
                <input
                  type="range" min={3} max={15} step={1}
                  value={draftDefaults.video.duration}
                  onChange={e => setDraftDefaults(d => ({ ...d, video: { ...d.video, duration: Number(e.target.value) } }))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 10, color: 'var(--t2)', width: 24 }}>{draftDefaults.video.duration}s</span>
              </div>
            </div>

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setProjectDefaults(draftDefaults)
                  saveProjectDefaults(activeId, draftDefaults)
                  setShowDefaultsModal(false)
                }}
                style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: 'none',
                  background: '#29D9D9', color: '#0a0a0f', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >저장</button>
              <button
                onClick={() => {
                  setProjectDefaults(draftDefaults)
                  saveProjectDefaults(activeId, draftDefaults)
                  applyDefaultsToAll(draftDefaults)
                  setShowDefaultsModal(false)
                }}
                style={{ flex: 1, padding: '7px 0', borderRadius: 7,
                  border: '1px solid rgba(170,110,255,0.5)',
                  background: 'rgba(170,110,255,0.1)', color: 'rgba(170,110,255,1)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >저장 + 전체 적용</button>
            </div>
          </div>
        </div>
      )}

        <button
          disabled={!hasHiggsfieldAuthError}
          onClick={() => {
            const isLocal = CANVAS_API === 'http://localhost:3002'
            const url = isLocal
              ? 'http://localhost:3002/auth/higgsfield/start'
              : `http://localhost:3002/auth/higgsfield/start?relay=${encodeURIComponent(CANVAS_API)}`
            window.open(url, '_blank')
          }}
          title={hasHiggsfieldAuthError ? 'Higgsfield 재연결' : 'Higgsfield 연결됨'}
          style={{
            height: 32, paddingInline: 10, borderRadius: 7,
            border: `1px solid ${hasHiggsfieldAuthError ? 'rgba(245,158,11,0.55)' : 'var(--controls-border)'}`,
            background: hasHiggsfieldAuthError ? 'rgba(245,158,11,0.14)' : 'var(--controls-bg)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            cursor: hasHiggsfieldAuthError ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 700,
            color: hasHiggsfieldAuthError ? '#F59E0B' : 'var(--t4)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            transition: 'all 0.2s',
            opacity: hasHiggsfieldAuthError ? 1 : 0.5,
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: hasHiggsfieldAuthError ? '#F59E0B' : '#22c55e',
            boxShadow: hasHiggsfieldAuthError ? '0 0 6px #F59E0B' : '0 0 6px #22c55e',
          }} />
          {hasHiggsfieldAuthError ? '재연결 필요' : 'HF 연결됨'}
        </button>
      {/* 크레딧 / 사용량 카드 */}
      <div style={{ position: 'fixed', top: 82, right: 16, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          {
            label: hfCredits === 'error' ? '🔐 HF 세션 상태' : '💎 HF 크레딧',
            value: hfCredits === 'error' ? '세션 만료' : hfCredits === null ? '——' : String(hfCredits),
            isError: hfCredits === 'error',
            onClick: fetchHfCredits,
            title: hfCredits === 'error' ? '재연결 버튼을 눌러 재인증하세요' : (hfCreditsRaw ?? '클릭하여 새로고침'),
          },
          {
            label: '🤖 Claude API usage',
            value: claudeCost === 'error' ? 'Error' : claudeCost === null ? '——' : `$ ${claudeCost.toFixed(4)}`,
            isError: claudeCost === 'error',
            onClick: fetchClaudeCost,
            title: '이 프로젝트의 Claude API 누적 비용',
          },
        ].map(({ label, value, isError, onClick, title }) => (
          <button key={label} onClick={onClick} title={title} style={{
            width: 164, padding: '9px 13px', borderRadius: 11, textAlign: 'left',
            border: '1px solid var(--controls-border)',
            background: 'var(--controls-bg)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--t1)', opacity: 0.45, marginBottom: 5, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
              {label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color: isError ? '#E34054' : 'var(--t1)', letterSpacing: '-0.02em' }}>
              <SlotCounter value={value} />
            </div>
          </button>
        ))}
      </div>
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
          style={{
            width: 32, height: 32, borderRadius: 7,
            border: '1px solid var(--controls-border)',
            background: 'var(--controls-bg)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme === 'dark' ? '#a0b0d0' : '#5a6a90',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {theme === 'dark'
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          }
        </button>

        {/* 연결선 표시/숨김 버튼 */}
        <button
          onClick={() => setShowEdges(v => !v)}
          title={showEdges ? '연결선 숨기기' : '연결선 보이기'}
          style={{
            width: 32, height: 32, borderRadius: 7,
            border: `1px solid ${!showEdges ? 'rgba(41,217,217,0.5)' : 'var(--controls-border)'}`,
            background: !showEdges ? 'rgba(41,217,217,0.1)' : 'var(--controls-bg)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={!showEdges ? '#29D9D9' : 'var(--controls-fill)'} strokeWidth="2" strokeLinecap="round">
            {showEdges
              ? <><path d="M5 12h14"/><path d="M5 6h14"/><path d="M5 18h14"/></>
              : <><path d="M5 12h14" strokeDasharray="4 2"/><path d="M5 6h14" strokeDasharray="4 2"/><path d="M5 18h14" strokeDasharray="4 2"/></>
            }
          </svg>
        </button>

        {/* 제품 이미지 관리 버튼 */}
        <button
          onClick={() => setShowAssetsPanel(v => !v)}
          title="제품 이미지 관리"
          style={{
            width: 32, height: 32, borderRadius: 7,
            border: `1px solid ${showAssetsPanel ? 'rgba(41,217,217,0.5)' : 'var(--controls-border)'}`,
            background: showAssetsPanel ? 'rgba(41,217,217,0.1)' : 'var(--controls-bg)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >📦</button>

        {/* 제품 이미지 패널 */}
        {showAssetsPanel && (
          <div style={{
            position: 'fixed', bottom: 90, left: 52, zIndex: 200,
            background: 'var(--controls-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--controls-border)', borderRadius: 12,
            padding: '14px 14px 12px', width: 220,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--t1)' }}>📦 제품 이미지</span>
              <label style={{ cursor: 'pointer' }} title="이미지 추가">
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = ev => saveAsset(file.name.replace(/\.[^.]+$/, ''), ev.target.result)
                    reader.readAsDataURL(file)
                    e.target.value = ''
                  }}
                />
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: 5, fontSize: 14, fontWeight: 700,
                  border: '1px solid var(--controls-border)', background: 'var(--node-bg)',
                  color: 'var(--t3)', cursor: 'pointer',
                }}>+</span>
              </label>
            </div>
            {assets.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--t5)', textAlign: 'center', padding: '12px 0' }}>
                + 버튼으로 제품 이미지 추가<br/>
                <span style={{ fontSize: 10, opacity: 0.6 }}>모든 프로젝트에서 공유됩니다</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {assets.map(a => (
                  <AssetPanelThumb key={a.id} asset={a} onDelete={() => deleteAsset(a.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 업데이트 내역 버튼 */}
        <button
          onClick={() => openChangelogModal()}
          title="업데이트 내역"
          style={{
            width: 32, height: 32, borderRadius: 7,
            border: '1px solid var(--controls-border)',
            background: 'var(--controls-bg)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', position: 'relative',
          }}
        >
          🚀
          {hasUpdate && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 7, height: 7, borderRadius: '50%',
              background: '#ef4444', boxShadow: '0 0 4px rgba(239,68,68,0.8)',
            }} />
          )}
        </button>
      </div>

      <ReactFlow
        key={canvasKey}
        className={showEdges ? '' : 'edges-hidden'}
        nodes={nodes}
        edges={activeEdges}
        onNodesChange={onNodesChangeWithHistory}
        onEdgesChange={onEdgesChangeWithHistory}
        onConnect={onConnect}
        onNodeDragStart={onSectionDragStart}
        onNodeDrag={onSectionDrag}
        onNodeDragStop={onSectionDragStop}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        panOnScroll
        panOnDrag={[1, 2]}
        zoomOnScroll={false}
        selectionOnDrag={false}
        minZoom={0.08}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        deleteKeyCode={null}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.09)'}
        />
        <Controls style={{ background: 'var(--controls-bg)', border: '1px solid var(--controls-border)', borderRadius: 8 }} />
        <MiniMap
          style={{ background: 'var(--minimap-bg)', border: '1px solid var(--controls-border)', borderRadius: 8 }}
          nodeColor="rgba(41,217,217,0.35)"
          maskColor="var(--minimap-mask)"
        />
      </ReactFlow>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          mode={contextMenu.mode ?? 'pane'}
          onSelect={handleContextMenuSelect}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 업데이트 알림 배너 */}
      {hasUpdate && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(30,40,60,0.96)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(99,179,237,0.4)',
          borderRadius: 12, padding: '10px 16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          color: '#e2e8f0', fontSize: 13, fontWeight: 500,
        }}>
          <span style={{ fontSize: 16 }}>🚀</span>
          <span>새 버전이 배포됐습니다</span>
          <button
            onClick={() => openChangelogModal()}
            style={{ background: 'none', border: 'none', color: '#63b3ed', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}
          >업데이트 내역</button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#3b82f6', border: 'none', color: '#fff',
              borderRadius: 7, padding: '4px 12px', fontSize: 13,
              fontWeight: 700, cursor: 'pointer',
            }}
          >새로고침</button>
        </div>
      )}

      {/* 업데이트 내역 모달 */}
      {showChangelog && (
        <div
          onClick={closeChangelog}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--controls-bg)', backdropFilter: 'blur(20px)',
              border: '1px solid var(--controls-border)',
              borderRadius: 16, padding: '28px 32px', minWidth: 360, maxWidth: 480,
              maxHeight: '80vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showTagLegend ? 12 : 20 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)' }}>🚀 업데이트 내역</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setShowTagLegend(v => !v)}
                  title="태그 설명 보기"
                  style={{
                    width: 20, height: 20, borderRadius: '50%', border: `1px solid ${showTagLegend ? 'rgba(100,140,255,0.6)' : 'var(--sep2)'}`,
                    background: showTagLegend ? 'rgba(100,140,255,0.15)' : 'transparent',
                    color: showTagLegend ? 'rgba(100,140,255,0.9)' : 'var(--t4)',
                    cursor: 'pointer', fontSize: 11, fontWeight: 700, lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >?</button>
                <button
                  onClick={closeChangelog}
                  style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                >✕</button>
              </div>
            </div>
            {showTagLegend && (
              <div style={{
                marginBottom: 16, padding: '10px 12px', borderRadius: 8,
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--sep2)',
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px',
              }}>
                {[
                  { tag: 'FEAT', label: '새로운 기능 추가', style: { background: 'rgba(41,217,100,0.12)', color: '#29D964', border: '1px solid rgba(41,217,100,0.25)' } },
                  { tag: 'UPD',  label: '기존 기능 개선·변경', style: { background: 'rgba(100,140,255,0.12)', color: 'rgba(100,140,255,0.9)', border: '1px solid rgba(100,140,255,0.25)' } },
                  { tag: 'ADD',  label: '버튼·단축키 등 소규모 추가', style: { background: 'rgba(41,197,217,0.12)', color: '#29C9D9', border: '1px solid rgba(41,197,217,0.25)' } },
                  { tag: 'FIX',  label: '버그 수정', style: { background: 'rgba(227,100,84,0.12)', color: '#E36454', border: '1px solid rgba(227,100,84,0.25)' } },
                ].map(({ tag, label, style }) => (
                  <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ ...style, padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', flexShrink: 0 }}>{tag}</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ overflowY: 'auto', flex: 1, marginBottom: 16 }}>
            {(() => {
              const monthGroups = {}
              const monthOrder = []
              changelog.forEach(entry => {
                const [y, m] = entry.date.split('-')
                const key = `${y}-${m}`
                if (!monthGroups[key]) { monthGroups[key] = []; monthOrder.push(key) }
                monthGroups[key].push(entry)
              })
              const toggleMonth = (key) => setOpenMonths(prev => {
                const next = new Set(prev)
                next.has(key) ? next.delete(key) : next.add(key)
                return next
              })
              const toggleDate = (date) => setOpenDates(prev => {
                const next = new Set(prev)
                next.has(date) ? next.delete(date) : next.add(date)
                return next
              })
              const showNewBadge = changelogNewKey !== changelogSeen && changelogNewKey !== ''
              return monthOrder.map(mKey => {
                const [y, m] = mKey.split('-')
                const label = `${y}년 ${parseInt(m)}월`
                const isMonthOpen = openMonths.has(mKey)
                return (
                  <div key={mKey} style={{ marginBottom: 6 }}>
                    <button
                      onClick={() => toggleMonth(mKey)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(255,255,255,0.05)', border: 'none',
                        borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                        color: 'var(--t1)', fontSize: 13, fontWeight: 700,
                        textAlign: 'left',
                      }}
                    >
                      <span>{label}</span>
                      <span style={{ fontSize: 10, opacity: 0.5 }}>{isMonthOpen ? '▾' : '▸'}</span>
                    </button>
                    {isMonthOpen && (
                      <div style={{ paddingLeft: 8, marginTop: 4 }}>
                        {monthGroups[mKey].map(entry => {
                          const [, em, ed] = entry.date.split('-')
                          const dateLabel = `${parseInt(em)}월 ${parseInt(ed)}일`
                          const isDateOpen = openDates.has(entry.date)
                          return (
                            <div key={entry.date} style={{ marginBottom: 3 }}>
                              <button
                                onClick={() => toggleDate(entry.date)}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: 'none', border: 'none',
                                  borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                                  color: 'var(--t3)', fontSize: 11, fontWeight: 600,
                                  textAlign: 'left', letterSpacing: '0.04em',
                                }}
                              >
                                <span>{dateLabel}</span>
                                <span style={{ fontSize: 9, opacity: 0.5 }}>{isDateOpen ? '▾' : '▸'}</span>
                              </button>
                              {isDateOpen && (
                                <div style={{ margin: '2px 0 6px', paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {(() => {
                                    const lastNewIdx = showNewBadge
                                      ? entry.items.reduce((acc, it, i) => it.startsWith('[NEW]') ? i : acc, -1)
                                      : -1
                                    return entry.items.map((item, j) => {
                                      const hasNewTag = item.startsWith('[NEW]')
                                      const stripped = hasNewTag ? item.slice(5) : item
                                      const match = stripped.match(/^\[(FIX|ADD|UPD|FEAT)\]\s*/)
                                      const tag = match?.[1] ?? null
                                      const text = match ? stripped.slice(match[0].length) : stripped
                                      const tagStyle = tag === 'FIX'
                                        ? { background: 'rgba(227,64,84,0.15)', color: '#E34054', border: '1px solid rgba(227,64,84,0.28)' }
                                        : tag === 'ADD'
                                        ? { background: 'rgba(41,217,217,0.12)', color: '#29D9D9', border: '1px solid rgba(41,217,217,0.25)' }
                                        : tag === 'FEAT'
                                        ? { background: 'rgba(41,217,100,0.12)', color: '#29D964', border: '1px solid rgba(41,217,100,0.25)' }
                                        : { background: 'rgba(100,136,255,0.13)', color: '#6488ff', border: '1px solid rgba(100,136,255,0.28)' }
                                      const isNew = hasNewTag
                                    return (
                                        <div key={j}>
                                          {j === lastNewIdx + 1 && lastNewIdx >= 0 && (
                                            <div style={{
                                              display: 'flex', alignItems: 'center', gap: 8,
                                              margin: '8px 0',
                                            }}>
                                              <div style={{ flex: 1, height: 1, background: 'rgba(139,92,246,0.35)' }} />
                                              <span style={{
                                                fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                                                padding: '2px 8px', borderRadius: 10,
                                                color: '#a78bfa', border: '1px solid rgba(139,92,246,0.4)',
                                                background: 'rgba(139,92,246,0.08)',
                                              }}>이전 업데이트</span>
                                              <div style={{ flex: 1, height: 1, background: 'rgba(139,92,246,0.35)' }} />
                                            </div>
                                          )}
                                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                            {tag
                                              ? <span style={{ ...tagStyle, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', padding: '2px 5px', borderRadius: 3, flexShrink: 0, marginTop: 1 }}>{tag}</span>
                                              : <span style={{ color: 'var(--t4)', fontSize: 10, flexShrink: 0, marginTop: 1 }}>•</span>
                                            }
                                            <span style={{ fontSize: 12, color: isNew ? 'var(--t1)' : 'var(--t3)', fontWeight: isNew ? 600 : 400, lineHeight: 1.55 }}>{text}</span>
                                          </div>
                                        </div>
                                      )
                                    })
                                  })()}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            })()}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%', padding: '10px 0', flexShrink: 0,
                background: '#3b82f6', border: 'none', borderRadius: 9,
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >새로고침하여 적용</button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          onClick={() => { pendingDeleteRef.current = null; setConfirmDelete(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10001,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--node-bg, #12131f)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, padding: '24px 28px',
              display: 'flex', flexDirection: 'column', gap: 16,
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              minWidth: 260,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>선택한 항목을 삭제할까요?</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { pendingDeleteRef.current = null; setConfirmDelete(false) }}
                style={{
                  padding: '7px 16px', borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: 'var(--t2)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >취소</button>
              <button
                onClick={handleConfirmDelete}
                autoFocus
                style={{
                  padding: '7px 16px', borderRadius: 7, border: 'none',
                  background: '#E34054', color: '#fff',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700,
                }}
              >삭제</button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
    </ProjectContext.Provider>
    </CharactersContext.Provider>
    {/* Element 등록 모달 (포털) */}
    {showElemRegModal && createPortal(
      <div
        onClick={() => !elemRegLoading && setShowElemRegModal(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <style>{`
          @keyframes elem-shimmer {
            from { background-position: -400px 0; }
            to   { background-position:  400px 0; }
          }
        `}</style>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: 480, maxHeight: '90vh', borderRadius: 16, overflow: 'hidden',
            background: 'var(--drop-bg)', border: '1px solid var(--drop-border)',
            boxShadow: 'var(--drop-shadow)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {elemRegSuccess === 'done' ? (
            /* ── 성공 뷰 ── */
            <div style={{ padding: '36px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--drop-accent)' }}>{elemRegSuccessName}</div>
              <div style={{ fontSize: 12, color: 'var(--drop-fg3)' }}>Element 등록 완료</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => setShowElemRegModal(false)}
                  style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--drop-sep)', background: 'var(--drop-btn-bg)', color: 'var(--drop-fg2)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >닫기</button>
                <button
                  onClick={() => { setElemRegFile(null); setElemRegPreview(null); setElemRegName(''); setElemRegCategory('auto'); setElemRegSelectedImg(null); setElemRegSuccess(null); setElemRegSuccessName('') }}
                  style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--drop-accent)', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                >하나 더 추가</button>
              </div>
            </div>
          ) : (
            /* ── 등록 폼 뷰 ── */
            <>
              {/* 헤더 */}
              <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>✦ Element 등록</span>
                <button onClick={() => setShowElemRegModal(false)} style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
              </div>

              {/* 소스 탭 */}
              <div style={{ padding: '12px 24px 0', display: 'flex', gap: 4 }}>
                {[['file','📁 파일 업로드'],['project','🖼 프로젝트 이미지']].map(([k, l]) => (
                  <button key={k} onClick={() => setElemRegActiveTab(k)} style={{
                    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: elemRegActiveTab === k ? 700 : 500,
                    background: elemRegActiveTab === k ? 'var(--drop-accent)' : 'var(--drop-btn-bg)',
                    color: elemRegActiveTab === k ? '#000' : 'var(--drop-fg3)',
                    transition: 'all 0.15s',
                  }}>{l}</button>
                ))}
              </div>

              {/* 소스 패널 */}
              <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {elemRegActiveTab === 'file' ? (
                  <div
                    onClick={() => elemRegFileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleElemRegFileChange(f) }}
                    style={{
                      border: `2px dashed ${elemRegPreview ? 'var(--drop-accent)' : 'var(--drop-dashed)'}`,
                      borderRadius: 12, padding: '32px 16px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                      cursor: 'pointer', transition: 'border-color 0.2s',
                      background: elemRegPreview ? 'var(--drop-accent-focused)' : 'var(--drop-zone-bg)',
                    }}
                  >
                    <input ref={elemRegFileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleElemRegFileChange(e.target.files[0])} />
                    {elemRegPreview
                      ? <img src={elemRegPreview} alt="" style={{ maxHeight: 140, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} />
                      : <><div style={{ fontSize: 36 }}>📁</div><div style={{ fontSize: 12, color: 'var(--drop-fg3)' }}>클릭하거나 드래그하여 이미지 업로드</div></>
                    }
                    {elemRegFile && <div style={{ fontSize: 10, color: 'var(--drop-accent)', fontWeight: 600 }}>{elemRegFile.name}</div>}
                  </div>
                ) : (
                  (() => {
                    const charUrls = new Set(characters.filter(c => c.resultUrl).map(c => c.resultUrl))
                    const sceneImgs = nodes
                      .filter(n => n.type === 'higgsfieldNode' && n.data?.resultUrl && n.data?.type !== 'video' && !charUrls.has(n.data.resultUrl))
                      .map(n => ({ url: n.data.resultUrl, label: n.data.label || '씬', tag: '씬', _key: `scene:${n.id}` }))
                    const charImgs = characters
                      .filter(c => c.resultUrl || c.hasLocalImage)
                      .map(c => ({ url: c.resultUrl || null, dbKey: c.hasLocalImage ? `char-${c.id}` : null, label: c.name || '캐릭터', tag: '캐릭터', _key: `char:${c.id}` }))
                    const projectImgs = [...charImgs, ...sceneImgs]
                    return projectImgs.length === 0
                      ? <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 12, color: 'var(--drop-fg3)' }}>씬 생성 결과 또는 캐릭터 이미지가 없습니다</div>
                      : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                          {projectImgs.map((item, i) => (
                            <ElemImgCell key={i} item={item} selected={elemRegSelectedImg?._key === item._key} onSelect={img => { setElemRegSelectedImg(img); setElemRegFile(null); setElemRegPreview(null) }} />
                          ))}
                        </div>
                  })()
                )}

                {/* 선택된 이미지 미리보기 (프로젝트 탭) */}
                {elemRegActiveTab === 'project' && elemRegSelectedImg && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--drop-btn-bg)', border: '1px solid var(--drop-sep)' }}>
                    <span style={{ fontSize: 12, color: 'var(--drop-fg2)' }}>{elemRegSelectedImg.tag === '캐릭터' ? '🧑 캐릭터 레퍼런스' : '🎬 씬 생성 이미지'}</span>
                    <span style={{ fontSize: 11, color: 'var(--drop-accent)', fontWeight: 700 }}>{elemRegSelectedImg.label}</span>
                  </div>
                )}

                {/* 이름 입력 */}
                <input
                  value={elemRegName}
                  onChange={e => setElemRegName(e.target.value)}
                  placeholder="Element 이름 (선택)"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 9,
                    border: '1px solid var(--drop-sep)',
                    background: 'var(--drop-input-bg)',
                    color: 'var(--drop-fg)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />

                {/* 카테고리 */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--drop-fg4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>카테고리</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[['auto','✨ Auto'], ['character','🧑 Character'], ['environment','🌍 Environment'], ['prop','📦 Prop']].map(([v, l]) => (
                      <button key={v} onClick={() => setElemRegCategory(v)} style={{
                        padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: elemRegCategory === v ? 700 : 500,
                        border: elemRegCategory === v ? '1px solid var(--drop-border)' : '1px solid var(--drop-sep)',
                        background: elemRegCategory === v ? 'var(--drop-accent-focused)' : 'var(--drop-btn-bg)',
                        color: elemRegCategory === v ? 'var(--drop-accent)' : 'var(--drop-fg3)',
                      }}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 푸터 */}
              <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {elemRegLoading && (
                  <div style={{ height: 3, borderRadius: 3, overflow: 'hidden', background: 'var(--drop-sep)' }}>
                    <div style={{ height: '100%', backgroundImage: 'linear-gradient(90deg,transparent 0%,var(--drop-accent) 50%,transparent 100%)', backgroundSize: '400px 100%', animation: 'elem-shimmer 1.2s infinite linear' }} />
                  </div>
                )}
                <button
                  onClick={handleElemRegister}
                  disabled={(!elemRegFile && !elemRegSelectedImg) || elemRegLoading}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
                    background: (!elemRegFile && !elemRegSelectedImg) || elemRegLoading ? 'var(--drop-sep)' : 'var(--drop-accent)',
                    color: (!elemRegFile && !elemRegSelectedImg) || elemRegLoading ? 'var(--drop-fg4)' : '#000',
                    fontSize: 14, fontWeight: 800, cursor: (!elemRegFile && !elemRegSelectedImg) || elemRegLoading ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >{elemRegLoading ? '등록 중...' : '✦ Element 등록'}</button>
              </div>
            </>
          )}
        </div>
      </div>,
      document.body
    )}
    </AssetsContext.Provider>
  )
}

export default function App() {
  const { user } = useAuth()

  if (user === undefined) return null  // 로딩중
  if (user === null) return <LoginPage />

  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
