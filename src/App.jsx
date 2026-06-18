import { useState, useCallback } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, useReactFlow,
  addEdge, BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'

import ReviewGateNode from './nodes/ReviewGateNode'
import StyleAnchorInputNode from './nodes/StyleAnchorInputNode'
import TextInputNode from './nodes/TextInputNode'
import ClaudeNode from './nodes/ClaudeNode'
import HiggsfieldNode from './nodes/HiggsfieldNode'
import SectionBackgroundNode from './nodes/SectionBackgroundNode'
import ImageNode from './nodes/ImageNode'
import ContextMenu from './components/ContextMenu'

const nodeTypes = {
  reviewGate: ReviewGateNode,
  styleAnchorInput: StyleAnchorInputNode,
  textInput: TextInputNode,
  claudeNode: ClaudeNode,
  higgsfieldNode: HiggsfieldNode,
  sectionBackground: SectionBackgroundNode,
  imageNode: ImageNode,
}

// ── Edge style helpers ─────────────────────────────────────────────
const approveLabel = {
  labelStyle: { fill: '#F4F4F4', fontWeight: 700, fontSize: 11 },
  labelBgStyle: { fill: 'rgba(5,10,25,0.92)' },
  labelBgPadding: [5, 7],
  labelBgBorderRadius: 5,
  style: { stroke: '#29D9D9', strokeWidth: 1.5 },
}

const rejectLabel = {
  labelStyle: { fill: '#F4F4F4', fontWeight: 700, fontSize: 11 },
  labelBgStyle: { fill: 'rgba(5,10,25,0.92)' },
  labelBgPadding: [5, 7],
  labelBgBorderRadius: 5,
}

const dataEdge = {
  style: { stroke: 'rgba(244,244,244,0.22)', strokeDasharray: '5,4', strokeWidth: 1.2 },
  labelStyle: { fill: 'rgba(244,244,244,0.5)', fontSize: 10 },
  labelBgStyle: { fill: 'rgba(5,10,25,0.85)' },
  labelBgPadding: [3, 5],
  labelBgBorderRadius: 4,
}

// ── Node templates for context menu ───────────────────────────────
const nodeTemplates = {
  textInput: {
    type: 'textInput',
    data: { label: '텍스트 입력', placeholder: '내용을 입력하세요...' },
  },
  claudeNode: {
    type: 'claudeNode',
    data: { label: 'Claude', description: '입력 → 프롬프트 생성' },
  },
  higgsfieldImage: {
    type: 'higgsfieldNode',
    data: { label: '이미지 생성', type: 'image' },
  },
  higgsfieldVideo: {
    type: 'higgsfieldNode',
    data: { label: '비디오 생성', type: 'video' },
  },
  reviewGate: {
    type: 'reviewGate',
    data: { label: '리뷰 게이트', prompt: '(내용을 검토하세요)' },
  },
  imageNode: {
    type: 'imageNode',
    data: { label: '이미지', src: null },
  },
  styleAnchorInput: {
    type: 'styleAnchorInput',
    data: {},
  },
}

// ── Layout ─────────────────────────────────────────────────────────
// Section backgrounds: x=350, width=940
// Col B (x=370): 텍스트 입력
// Col C (x=660): Claude / Higgsfield
// Col D (x=980): Review Gate

const nodes0 = [
  // ── 섹션 배경 패널 ───────────────────────────────────────
  {
    id: 'bg-s1',
    type: 'sectionBackground',
    position: { x: 350, y: 0 },
    data: {
      width: 945, height: 468,
      step: 'Step 01', label: '캐릭터 생성',
      bg: 'rgba(31,65,176,0.09)',
      border: 'rgba(31,65,176,0.42)',
      accent: 'rgba(100,140,255,0.9)',
    },
    selectable: false, draggable: false, focusable: false,
    zIndex: -1,
  },
  {
    id: 'bg-s2',
    type: 'sectionBackground',
    position: { x: 350, y: 558 },
    data: {
      width: 945, height: 482,
      step: 'Step 02', label: '이미지 생성',
      bg: 'rgba(41,217,217,0.05)',
      border: 'rgba(41,217,217,0.32)',
      accent: '#29D9D9',
    },
    selectable: false, draggable: false, focusable: false,
    zIndex: -1,
  },
  {
    id: 'bg-s3',
    type: 'sectionBackground',
    position: { x: 350, y: 1110 },
    data: {
      width: 945, height: 492,
      step: 'Step 03', label: '비디오 생성',
      bg: 'rgba(100,40,200,0.08)',
      border: 'rgba(130,60,230,0.38)',
      accent: 'rgba(170,110,255,1)',
    },
    selectable: false, draggable: false, focusable: false,
    zIndex: -1,
  },

  // ── 스타일 앵커 ───────────────────────────────────────────
  {
    id: 'styleAnchor',
    type: 'styleAnchorInput',
    position: { x: 40, y: -80 },
    data: {},
  },

  // ════════════════════════════════════════
  // Section 1: 캐릭터 생성
  // ════════════════════════════════════════
  {
    id: 'charDirection',
    type: 'textInput',
    position: { x: 370, y: 20 },
    data: {
      label: '캐릭터 연출 입력',
      placeholder: '원하는 캐릭터를 설명해주세요.\n예) 20대 여성, 짧은 검은 머리...',
    },
  },
  {
    id: 'claudeChar',
    type: 'claudeNode',
    position: { x: 660, y: 20 },
    data: {
      label: '캐릭터 프롬프트 생성',
      description: '이미지 앵커 + 캐릭터 연출 → 캐릭터 생성 프롬프트',
    },
  },
  {
    id: 'reviewCharPrompt',
    type: 'reviewGate',
    position: { x: 980, y: 20 },
    data: {
      label: '캐릭터 프롬프트 리뷰',
      prompt: '(Claude가 생성한 캐릭터 프롬프트)',
    },
  },
  {
    id: 'higgsfieldChar',
    type: 'higgsfieldNode',
    position: { x: 660, y: 270 },
    data: { label: '캐릭터 생성', type: 'image' },
  },
  {
    id: 'reviewCharResult',
    type: 'reviewGate',
    position: { x: 980, y: 270 },
    data: {
      label: '생성된 캐릭터 리뷰',
      prompt: '(Higgsfield가 생성한 캐릭터 이미지 확인)',
    },
  },

  // ════════════════════════════════════════
  // Section 2: 이미지 생성
  // ════════════════════════════════════════
  {
    id: 'claudeImage',
    type: 'claudeNode',
    position: { x: 660, y: 580 },
    data: {
      label: '이미지 프롬프트 생성',
      description: '이미지 앵커 + 캐릭터 참조 → 첫 프레임 이미지 프롬프트',
    },
  },
  {
    id: 'reviewImagePrompt',
    type: 'reviewGate',
    position: { x: 980, y: 580 },
    data: {
      label: '이미지 프롬프트 리뷰',
      prompt: '(Claude가 생성한 이미지 프롬프트)',
    },
  },
  {
    id: 'higgsfieldImage',
    type: 'higgsfieldNode',
    position: { x: 660, y: 840 },
    data: { label: '이미지 생성', type: 'image', hasRef: true },
  },
  {
    id: 'reviewImageResult',
    type: 'reviewGate',
    position: { x: 980, y: 840 },
    data: {
      label: '이미지 리뷰',
      prompt: '(생성된 이미지 확인 후 비디오 단계로)',
    },
  },

  // ════════════════════════════════════════
  // Section 3: 비디오 생성
  // ════════════════════════════════════════
  {
    id: 'vidDirection',
    type: 'textInput',
    position: { x: 370, y: 1130 },
    data: {
      label: '비디오 연출 입력',
      placeholder: '원하는 영상 연출을 설명해주세요.\n예) 카메라가 천천히 줌인하며...',
    },
  },
  {
    id: 'claudeVideo',
    type: 'claudeNode',
    position: { x: 660, y: 1130 },
    data: {
      label: '비디오 프롬프트 생성',
      description: '비디오 앵커 + 연출 입력 → 비디오 생성 프롬프트',
    },
  },
  {
    id: 'reviewVideoPrompt',
    type: 'reviewGate',
    position: { x: 980, y: 1130 },
    data: {
      label: '비디오 프롬프트 리뷰',
      prompt: '(Claude가 생성한 비디오 프롬프트)',
    },
  },
  {
    id: 'higgsfieldVideo',
    type: 'higgsfieldNode',
    position: { x: 660, y: 1400 },
    data: { label: '비디오 생성', type: 'video' },
  },
  {
    id: 'reviewVideoResult',
    type: 'reviewGate',
    position: { x: 980, y: 1400 },
    data: {
      label: '최종 비디오 리뷰',
      prompt: '(최종 비디오 확인 후 다운로드)',
    },
  },
]

const edges0 = [
  // ── 스타일 앵커 ──────────────────────────────────────────
  { id: 'e-sa-cc', source: 'styleAnchor', sourceHandle: 'image', target: 'claudeChar', targetHandle: 'anchor', label: '이미지 앵커', ...dataEdge },
  { id: 'e-sa-ci', source: 'styleAnchor', sourceHandle: 'image', target: 'claudeImage', targetHandle: 'anchor', label: '이미지 앵커', ...dataEdge },
  { id: 'e-sa-cv', source: 'styleAnchor', sourceHandle: 'video', target: 'claudeVideo', targetHandle: 'anchor', label: '비디오 앵커', ...dataEdge },

  // ── 사용자 입력 ──────────────────────────────────────────
  { id: 'e-cd-cc', source: 'charDirection', target: 'claudeChar', targetHandle: 'command' },
  { id: 'e-vd-cv', source: 'vidDirection', target: 'claudeVideo', targetHandle: 'command' },

  // ── Section 1: 캐릭터 ────────────────────────────────────
  { id: 'e-cc-rcp', source: 'claudeChar', target: 'reviewCharPrompt', targetHandle: 'left' },
  { id: 'e-rcp-hc', source: 'reviewCharPrompt', target: 'higgsfieldChar', targetHandle: 'prompt', label: '승인', ...approveLabel },
  { id: 'e-rcp-cc', source: 'reviewCharPrompt', target: 'claudeChar', label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
  { id: 'e-hc-rcr', source: 'higgsfieldChar', target: 'reviewCharResult', targetHandle: 'left' },
  { id: 'e-rcr-rcp', source: 'reviewCharResult', target: 'reviewCharPrompt', targetHandle: 'top', label: '프롬프트 수정', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },

  // ── Section 1 → 2: 캐릭터 참조 ──────────────────────────
  { id: 'e-rcr-ci', source: 'reviewCharResult', target: 'claudeImage', targetHandle: 'command', label: '캐릭터 참조', ...dataEdge },
  { id: 'e-rcr-hi', source: 'reviewCharResult', target: 'higgsfieldImage', targetHandle: 'ref', label: '캐릭터 참조', ...dataEdge },

  // ── Section 2: 이미지 ────────────────────────────────────
  { id: 'e-ci-rip', source: 'claudeImage', target: 'reviewImagePrompt', targetHandle: 'left' },
  { id: 'e-rip-hi', source: 'reviewImagePrompt', target: 'higgsfieldImage', targetHandle: 'prompt', label: '승인', ...approveLabel },
  { id: 'e-rip-ci', source: 'reviewImagePrompt', target: 'claudeImage', label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
  { id: 'e-hi-rir', source: 'higgsfieldImage', target: 'reviewImageResult', targetHandle: 'left' },
  { id: 'e-rir-rip', source: 'reviewImageResult', target: 'reviewImagePrompt', targetHandle: 'top', label: '프롬프트 수정', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },

  // ── Section 2 → 3: 첫 프레임 ────────────────────────────
  { id: 'e-rir-hv', source: 'reviewImageResult', target: 'higgsfieldVideo', targetHandle: 'image', label: '첫 프레임', ...dataEdge },

  // ── Section 3: 비디오 ────────────────────────────────────
  { id: 'e-cv-rvp', source: 'claudeVideo', target: 'reviewVideoPrompt', targetHandle: 'left' },
  { id: 'e-rvp-hv', source: 'reviewVideoPrompt', target: 'higgsfieldVideo', targetHandle: 'prompt', label: '승인', ...approveLabel },
  { id: 'e-rvp-cv', source: 'reviewVideoPrompt', target: 'claudeVideo', label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
  { id: 'e-hv-rvr', source: 'higgsfieldVideo', target: 'reviewVideoResult', targetHandle: 'left' },
  { id: 'e-rvr-rvp', source: 'reviewVideoResult', target: 'reviewVideoPrompt', targetHandle: 'top', label: '프롬프트 수정', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
]

// ── FlowCanvas (uses useReactFlow — must be inside ReactFlowProvider) ──
function FlowCanvas() {
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState(nodes0)
  const [edges, setEdges, onEdgesChange] = useEdgesState(edges0)
  const [contextMenu, setContextMenu] = useState(null)

  // 노드 연결
  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({ ...params, type: 'smoothstep' }, eds))
  }, [setEdges])

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
  }, [contextMenu, nodes, setNodes, setEdges])

  // ── 엣지 삭제 ─────────────────────────────────────────────
  const handleEdgeAction = useCallback((action) => {
    if (!contextMenu?.edgeId) return
    if (action === 'delete') {
      setEdges(eds => eds.filter(e => e.id !== contextMenu.edgeId))
    }
  }, [contextMenu, setEdges])

  const handleContextMenuSelect = useCallback((key) => {
    if (contextMenu?.mode === 'node') handleNodeAction(key)
    else if (contextMenu?.mode === 'edge') handleEdgeAction(key)
    else handleAddNode(key)
  }, [contextMenu, handleNodeAction, handleEdgeAction, handleAddNode])

  // 이미지 드롭 → image 노드 생성
  const onDrop = useCallback((event) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (!files.length) return

    const file = files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setNodes(nds => [
        ...nds,
        {
          id: `imgdrop-${Date.now()}`,
          type: 'imageNode',
          position,
          data: { src: e.target.result, label: file.name },
        },
      ])
    }
    reader.readAsDataURL(file)
  }, [screenToFlowPosition, setNodes])

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh' }} onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(255,255,255,0.06)"
        />
        <Controls
          style={{
            background: 'rgba(15,18,30,0.85)',
            border: '1px solid rgba(41,217,217,0.15)',
            borderRadius: 8,
          }}
        />
        <MiniMap
          style={{
            background: 'rgba(10,10,20,0.9)',
            border: '1px solid rgba(41,217,217,0.15)',
            borderRadius: 8,
          }}
          nodeColor="rgba(41,217,217,0.35)"
          maskColor="rgba(0,0,0,0.55)"
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
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
