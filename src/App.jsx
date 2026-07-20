import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Panel,
  useNodesState, useEdgesState, useReactFlow,
  addEdge, BackgroundVariant,
} from '@xyflow/react'
import { generateHandlerRef } from './lib/generateHandlerRef'
import { higgsfieldHandlerRef } from './lib/higgsfieldHandlerRef'
import '@xyflow/react/dist/style.css'
import './App.css'

import ReviewGateNode from './nodes/ReviewGateNode'
import StyleAnchorInputNode from './nodes/StyleAnchorInputNode'
import TextInputNode from './nodes/TextInputNode'
import ClaudeNode from './nodes/ClaudeNode'
import HiggsfieldNode from './nodes/HiggsfieldNode'
import SectionBackgroundNode from './nodes/SectionBackgroundNode'
import ScriptImportNode from './nodes/ScriptImportNode'
import ReferenceImageNode from './nodes/ReferenceImageNode'
import ContextMenu from './components/ContextMenu'

const nodeTypes = {
  reviewGate: ReviewGateNode,
  styleAnchorInput: StyleAnchorInputNode,
  textInput: TextInputNode,
  claudeNode: ClaudeNode,
  higgsfieldNode: HiggsfieldNode,
  sectionBackground: SectionBackgroundNode,
  scriptImport: ScriptImportNode,
  referenceImage: ReferenceImageNode,
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
  className: 'data-edge',
}

// ── Node templates for context menu ───────────────────────────────
const nodeTemplates = {
  scriptImport: {
    type: 'scriptImport',
    data: {},
  },
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
  styleAnchorInput: {
    type: 'styleAnchorInput',
    data: {},
  },
  referenceImage: {
    type: 'referenceImage',
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
      step: 'Step 02 · 씬 1', label: '이미지 생성',
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
      step: 'Step 03 · 씬 1', label: '비디오 생성',
      bg: 'rgba(100,40,200,0.08)',
      border: 'rgba(130,60,230,0.38)',
      accent: 'rgba(170,110,255,1)',
    },
    selectable: false, draggable: false, focusable: false,
    zIndex: -1,
  },

  // ── 스크립트 불러오기 (SCRIPT-AUTOMATION 연동) ────────────
  {
    id: 'scriptImport',
    type: 'scriptImport',
    position: { x: -320, y: 200 },
    data: {},
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
      promptType: 'claudeChar',
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
    id: 'imageDirection',
    type: 'textInput',
    position: { x: 370, y: 580 },
    data: {
      label: '이미지 연출 입력',
      placeholder: '원하는 장면을 설명해주세요.\n예) 캐릭터가 카페 창가에 앉아 커피를 마시는 장면...',
    },
  },
  {
    id: 'claudeImage',
    type: 'claudeNode',
    position: { x: 660, y: 580 },
    data: {
      label: '이미지 프롬프트 생성',
      description: '캐릭터 참조 + 이미지 연출 → 첫 프레임 이미지 프롬프트',
      promptType: 'claudeImage',
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
    data: { label: '이미지 생성', type: 'image', hasRef: true, model: 'nano_banana_pro' },
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
      promptType: 'claudeVideo',
    },
  },
  {
    id: 'reviewVideoPrompt',
    type: 'reviewGate',
    position: { x: 980, y: 1130 },
    data: {
      label: '비디오 프롬프트 리뷰',
      prompt: '(Claude가 생성한 비디오 프롬프트)',
      charLimit: 2500,
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
  { id: 'e-rcr-ci', source: 'reviewCharResult', target: 'claudeImage', targetHandle: 'anchor', label: '캐릭터 참조', ...dataEdge },
  { id: 'e-id-ci', source: 'imageDirection', target: 'claudeImage', targetHandle: 'command' },
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

// ── 씬 복제 팩토리 ────────────────────────────────────────────────────
// 씬 1은 nodes0/edges0에 하드코딩. 씬 2부터 이 함수로 동적 생성.
const SCENE_X_STEP = 1000  // 씬 간 X 간격 (섹션 폭 945 + 여백 55)

function buildScene(sceneIdx) {
  const uid = `sc${Date.now()}`
  const x = 350 + (sceneIdx - 1) * SCENE_X_STEP  // 씬 1: x=350, 씬 2: x=1350, ...

  const nodes = [
    // ── 섹션 배경 ──────────────────────────────────────
    {
      id: `bg-s2-${uid}`, type: 'sectionBackground',
      position: { x, y: 558 },
      data: { width: 945, height: 482, step: `Step 02 · 씬 ${sceneIdx}`, label: '이미지 생성',
        bg: 'rgba(41,217,217,0.05)', border: 'rgba(41,217,217,0.32)', accent: '#29D9D9' },
      selectable: false, draggable: false, focusable: false, zIndex: -1,
    },
    {
      id: `bg-s3-${uid}`, type: 'sectionBackground',
      position: { x, y: 1110 },
      data: { width: 945, height: 492, step: `Step 03 · 씬 ${sceneIdx}`, label: '비디오 생성',
        bg: 'rgba(100,40,200,0.08)', border: 'rgba(130,60,230,0.38)', accent: 'rgba(170,110,255,1)' },
      selectable: false, draggable: false, focusable: false, zIndex: -1,
    },
    // ── Step 02: 이미지 생성 ───────────────────────────
    {
      id: `imageDirection-${uid}`, type: 'textInput',
      position: { x: x + 20, y: 580 },
      data: { label: `이미지 연출 · 씬 ${sceneIdx}`, placeholder: '원하는 장면을 설명해주세요...' },
    },
    {
      id: `claudeImage-${uid}`, type: 'claudeNode',
      position: { x: x + 310, y: 580 },
      data: { label: '이미지 프롬프트 생성', description: '캐릭터 참조 + 이미지 연출 → 첫 프레임 이미지 프롬프트', promptType: 'claudeImage' },
    },
    {
      id: `reviewImagePrompt-${uid}`, type: 'reviewGate',
      position: { x: x + 630, y: 580 },
      data: { label: '이미지 프롬프트 리뷰', prompt: '(Claude가 생성한 이미지 프롬프트)' },
    },
    {
      id: `higgsfieldImage-${uid}`, type: 'higgsfieldNode',
      position: { x: x + 310, y: 840 },
      data: { label: '이미지 생성', type: 'image', hasRef: true, model: 'nano_banana_pro' },
    },
    {
      id: `reviewImageResult-${uid}`, type: 'reviewGate',
      position: { x: x + 630, y: 840 },
      data: { label: '이미지 리뷰', prompt: '(생성된 이미지 확인 후 비디오 단계로)' },
    },
    // ── Step 03: 비디오 생성 ───────────────────────────
    {
      id: `vidDirection-${uid}`, type: 'textInput',
      position: { x: x + 20, y: 1130 },
      data: { label: `비디오 연출 · 씬 ${sceneIdx}`, placeholder: '원하는 영상 연출을 설명해주세요...' },
    },
    {
      id: `claudeVideo-${uid}`, type: 'claudeNode',
      position: { x: x + 310, y: 1130 },
      data: { label: '비디오 프롬프트 생성', description: '비디오 앵커 + 연출 입력 → 비디오 생성 프롬프트', promptType: 'claudeVideo' },
    },
    {
      id: `reviewVideoPrompt-${uid}`, type: 'reviewGate',
      position: { x: x + 630, y: 1130 },
      data: { label: '비디오 프롬프트 리뷰', prompt: '(Claude가 생성한 비디오 프롬프트)', charLimit: 2500 },
    },
    {
      id: `higgsfieldVideo-${uid}`, type: 'higgsfieldNode',
      position: { x: x + 310, y: 1400 },
      data: { label: '비디오 생성', type: 'video' },
    },
    {
      id: `reviewVideoResult-${uid}`, type: 'reviewGate',
      position: { x: x + 630, y: 1400 },
      data: { label: '최종 비디오 리뷰', prompt: '(최종 비디오 확인 후 다운로드)' },
    },
  ]

  const u = uid  // 짧은 별칭
  const edges = [
    // 스타일 앵커 (공유)
    { id: `e-sa-ci-${u}`, source: 'styleAnchor', sourceHandle: 'image', target: `claudeImage-${u}`, targetHandle: 'anchor', label: '이미지 앵커', ...dataEdge },
    { id: `e-sa-cv-${u}`, source: 'styleAnchor', sourceHandle: 'video', target: `claudeVideo-${u}`, targetHandle: 'anchor', label: '비디오 앵커', ...dataEdge },
    // 캐릭터 참조 (Step 01 출력 공유)
    { id: `e-rcr-ci-${u}`, source: 'reviewCharResult', target: `claudeImage-${u}`, targetHandle: 'anchor', label: '캐릭터 참조', ...dataEdge },
    { id: `e-rcr-hi-${u}`, source: 'reviewCharResult', target: `higgsfieldImage-${u}`, targetHandle: 'ref', label: '캐릭터 참조', ...dataEdge },
    // Step 02 흐름
    { id: `e-id-ci-${u}`, source: `imageDirection-${u}`, target: `claudeImage-${u}`, targetHandle: 'command' },
    { id: `e-ci-rip-${u}`, source: `claudeImage-${u}`, target: `reviewImagePrompt-${u}`, targetHandle: 'left' },
    { id: `e-rip-hi-${u}`, source: `reviewImagePrompt-${u}`, target: `higgsfieldImage-${u}`, targetHandle: 'prompt', label: '승인', ...approveLabel },
    { id: `e-rip-ci-${u}`, source: `reviewImagePrompt-${u}`, target: `claudeImage-${u}`, label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
    { id: `e-hi-rir-${u}`, source: `higgsfieldImage-${u}`, target: `reviewImageResult-${u}`, targetHandle: 'left' },
    { id: `e-rir-rip-${u}`, source: `reviewImageResult-${u}`, target: `reviewImagePrompt-${u}`, targetHandle: 'top', label: '프롬프트 수정', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
    // Step 02 → 03 첫 프레임
    { id: `e-rir-hv-${u}`, source: `reviewImageResult-${u}`, target: `higgsfieldVideo-${u}`, targetHandle: 'image', label: '첫 프레임', ...dataEdge },
    // Step 03 흐름
    { id: `e-vd-cv-${u}`, source: `vidDirection-${u}`, target: `claudeVideo-${u}`, targetHandle: 'command' },
    { id: `e-cv-rvp-${u}`, source: `claudeVideo-${u}`, target: `reviewVideoPrompt-${u}`, targetHandle: 'left' },
    { id: `e-rvp-hv-${u}`, source: `reviewVideoPrompt-${u}`, target: `higgsfieldVideo-${u}`, targetHandle: 'prompt', label: '승인', ...approveLabel },
    { id: `e-rvp-cv-${u}`, source: `reviewVideoPrompt-${u}`, target: `claudeVideo-${u}`, label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
    { id: `e-hv-rvr-${u}`, source: `higgsfieldVideo-${u}`, target: `reviewVideoResult-${u}`, targetHandle: 'left' },
    { id: `e-rvr-rvp-${u}`, source: `reviewVideoResult-${u}`, target: `reviewVideoPrompt-${u}`, targetHandle: 'top', label: '프롬프트 수정', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
  ]

  return { nodes, edges }
}

// ── FlowCanvas (uses useReactFlow — must be inside ReactFlowProvider) ──
const CANVAS_API = 'http://localhost:3002'

const CLAUDE_PROMPTS = {
  claudeChar: {
    system: `You are a character description writer for AI image generation.

Your only job is to describe WHO the character is — not HOW they are rendered.
Style, rendering, lighting, and visual treatment are handled separately by the style anchor. Do not add any style language.

WHAT to write:
- Emotional expression and mood (e.g. "tired but gentle expression", "shy smile")
- Body posture and gesture (e.g. "slightly slouched", "arms crossed loosely")
- Silhouette and build (e.g. "petite frame", "broad-shouldered")
- Hair: color, length, and loose shape only (e.g. "loose shoulder-length dark hair")
- Clothing: fabric feel and color tone only (e.g. "muted oversized knit sweater", "simple linen dress")
- One or two personality-readable details maximum

WHAT NOT to write:
- No rendering style: no "realistic", "painterly", "3D", "illustration", "cartoon", "chibi"
- No skin description: no "matte skin", "fine texture", "pores", "skin tone codes"
- No lighting: no "soft window light", "rim light", "subsurface scattering"
- No facial anatomy: no "oval face", "defined cheekbones", "almond eyes"
- No camera or composition: no "three-quarter portrait", "close-up", "depth of field"
- No quality filler: no "masterpiece", "best quality", "highly detailed"

The style anchor prepended above this prompt already defines the visual style. Your output must not conflict with it.

Output rules:
- One short paragraph, plain English
- No code blocks, no Korean, no explanations`,
    user: (anchor, command) => `Style anchor (already defines visual style — do not repeat or contradict):\n${anchor || '(none)'}\n\nCharacter direction:\n${command || '(no input)'}`,
  },
  claudeImage: {
    system: `You are a scene description writer for AI image generation.

The style anchor prepended to this prompt already defines the complete visual style. Do not introduce any new style language.

A reference character image MAY or MAY NOT be provided to the AI model. Read the scene direction carefully:

IF the scene includes a character:
- Do not re-describe the character's appearance (it is covered by the reference image)
- Use phrasing like "keeping the referenced character unchanged", "with the attached character"
- Focus on: what the character is doing, where they are, the mood of the scene

IF the scene has no character (object, environment, abstract, etc.):
- Describe the subject or scene fully: what it is, its key visual qualities, its placement
- Describe mood, atmosphere, composition, and framing
- Do not reference any character or person

In both cases, write only:
- Subject or action (what is in the scene)
- Mood and atmosphere
- Composition and framing

Do NOT write:
- Rendering or art style (already in the anchor)
- Skin texture, lighting model, or material descriptions
- Quality filler like "masterpiece", "best quality"

Do not ask follow-up questions.

Output rules:
- Output the English prompt only
- No code blocks, no Korean, no explanations`,
    user: (anchor, command) => `Image style anchor:\n${anchor || '(none)'}\n\nScene direction:\n${command || '(no input)'}`,
  },
  claudeVideo: {
    system: `You are a video prompt generator for Kling 3.0 via higgsfield.ai.

Your job is to convert the user's video direction into a strong English video-generation prompt. A reference image (first frame) will be provided to the AI model.

Follow the Main Principle:
- If the reference image is provided and will be used during generation, do not redundantly restate visible appearance details that are already clearly shown in the image
- Use the prompt mainly to describe: what happens, what changes, what moves, how the camera behaves, what mood develops

Always write the prompt in this order:
1. Motion header — camera behavior and movement intensity (e.g. "Head Tracking (70) + Dolly In (40)")
2. Main subject state
3. Main action or event
4. Character reaction
5. Camera behavior
6. Atmosphere and lighting
7. Secondary motion details
8. Final visual quality or style note

Motion header phrases: Head Tracking, Eye-Level Tracking, Static Shot, Dolly In, Dolly Out, Slow Push, Fast Push, Pan Left, Pan Right, Tilt Up, Tilt Down, Orbit Left, Orbit Right, Handheld Motion, Locked Frame

Kling 3.0 Style Rules:
- Write as a flowing sequence, not keyword stacking
- Describe the scene as it unfolds over time
- Prioritize: motion > action > reaction > atmosphere > detail
- Avoid filler like "masterpiece" or "best quality"
- Use phrasing like "keeping the referenced character unchanged", "based on the attached reference frame"

Do not ask follow-up questions.

Output rules:
- Output the English prompt only
- No code blocks, no Korean translation, no explanations
- Maximum 2500 characters total — cut secondary details if needed to stay within this limit`,
    user: (anchor, command) => `Video style anchor:\n${anchor || '(none)'}\n\nVideo direction:\n${command || '(no input)'}`,
  },
}

const GENERIC_PROMPT = {
  system: '당신은 AI 콘텐츠 생성 전문가입니다. 주어진 앵커와 입력을 바탕으로 AI 이미지/비디오 생성에 최적화된 영어 프롬프트를 작성하세요.',
  user: (anchor, command) => `앵커:\n${anchor || '(없음)'}\n\n입력:\n${command || '(없음)'}`,
}

function FlowCanvas() {
  const { screenToFlowPosition, getNodes, getEdges, updateNodeData } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState(nodes0)
  const [edges, setEdges, onEdgesChange] = useEdgesState(edges0)
  const sceneCountRef = useRef(1)
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


  // ── 씬 추가 ──────────────────────────────────────────────────
  const addScene = useCallback(() => {
    sceneCountRef.current += 1
    const { nodes: newNodes, edges: newEdges } = buildScene(sceneCountRef.current)
    setNodes(nds => [...nds, ...newNodes])
    setEdges(eds => [...eds, ...newEdges])
  }, [setNodes, setEdges])

  // ── Claude 프롬프트 생성 실행 엔진 ───────────────────────────
  const handleGenerate = useCallback(async (nodeId) => {
    const currentNodes = getNodes()
    const currentEdges = getEdges()

    // 연결된 소스 노드에서 입력값 읽기
    const getInput = (targetHandle) => {
      const edge = currentEdges.find(e => e.target === nodeId && e.targetHandle === targetHandle)
      if (!edge) return ''
      const src = currentNodes.find(n => n.id === edge.source)
      if (!src) return ''
      if (src.type === 'styleAnchorInput')
        return edge.sourceHandle === 'video' ? (src.data.videoAnchor || '') : (src.data.imageAnchor || '')
      if (src.type === 'scriptImport')
        return edge.sourceHandle === 'videoAnchor' ? (src.data.videoAnchor || '') : (src.data.imageAnchor || '')
      if (src.type === 'textInput') return src.data.value || ''
      if (src.type === 'reviewGate') return src.data.prompt || ''
      return ''
    }

    const anchor = getInput('anchor')
    const command = getInput('command')

    const node = currentNodes.find(n => n.id === nodeId)
    const cfg = CLAUDE_PROMPTS[node?.data?.promptType] ?? GENERIC_PROMPT

    updateNodeData(nodeId, { status: 'loading', error: undefined })

    try {
      const res = await fetch(`${CANVAS_API}/api/claude/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: cfg.system,
          userMessage: cfg.user(anchor, command),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `서버 오류 ${res.status}`)
      }
      const { text } = await res.json()
      // 비디오 프롬프트는 앵커를 Claude 컨텍스트로만 사용하고 출력에는 붙이지 않음
      const prependAnchor = node?.data?.promptType !== 'claudeVideo'
      const finalText = (anchor && prependAnchor) ? `${anchor}\n\n${text}` : text

      updateNodeData(nodeId, { status: 'done', result: finalText })

      // 연결된 ReviewGate 노드에 결과 주입 (재생성 루프 엣지 제외)
      getEdges().filter(e => e.source === nodeId && e.target !== nodeId)
        .forEach(e => updateNodeData(e.target, { prompt: finalText }))
    } catch (err) {
      updateNodeData(nodeId, { status: 'error', error: err.message })
    }
  }, [getNodes, getEdges, updateNodeData])

  // generateHandlerRef에 등록
  useEffect(() => {
    generateHandlerRef.current = handleGenerate
  }, [handleGenerate])

  // ── Higgsfield 생성 실행 엔진 ────────────────────────────
  const handleHiggsfieldGenerate = useCallback(async (nodeId) => {
    const currentNodes = getNodes()
    const currentEdges = getEdges()

    const node = currentNodes.find(n => n.id === nodeId)
    const isVideo = node?.data?.type === 'video'

    // 프롬프트 입력 수집
    const promptEdge = currentEdges.find(e => e.target === nodeId && e.targetHandle === 'prompt')
    const promptSrc = promptEdge ? currentNodes.find(n => n.id === promptEdge.source) : null
    const prompt = promptSrc?.data?.prompt || promptSrc?.data?.value || ''

    // 헬퍼: ReferenceImageNode 업로드 (파일/URL → mediaId)
    const uploadRefImage = async (srcNode) => {
      const { imageDataUrl, imageUrl, filename, contentType } = srcNode.data ?? {}
      if (!imageDataUrl && !imageUrl) return null
      const uploadRes = await fetch(`${CANVAS_API}/api/higgsfield/upload-reference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl || null, fileBase64: imageDataUrl || null, filename, contentType }),
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.mediaId) throw new Error(uploadData.error || '이미지 업로드 실패')
      return uploadData.mediaId
    }

    // 헬퍼: 이전 생성 결과 URL → Higgsfield mediaId (media_import_url 경유)
    const importRefUrl = async (url) => {
      const res = await fetch(`${CANVAS_API}/api/higgsfield/upload-reference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok || !data.mediaId) throw new Error(data.error || 'URL 임포트 실패')
      return data.mediaId
    }

    // ref/image 핸들에 연결된 소스 노드 전체 수집
    const mediaEdges = currentEdges.filter(e => e.target === nodeId &&
      (e.targetHandle === 'ref' || e.targetHandle === 'image'))
    const mediaSources = mediaEdges
      .map(e => currentNodes.find(n => n.id === e.source))
      .filter(Boolean)

    const t0 = Date.now()
    const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`
    console.log(`[생성 시작] nodeId: ${nodeId}, type: ${isVideo ? '비디오' : '이미지'}, prompt: "${prompt.slice(0, 60)}..."`)

    updateNodeData(nodeId, { status: 'loading', error: undefined })

    // 이미지: 연결된 모든 참조를 mediaId로 변환 (병렬)
    let referenceMediaIds = []

    if (!isVideo) {
      try {
        const results = await Promise.all(mediaSources.map(src => {
          if (src.type === 'referenceImage') return uploadRefImage(src)
          if (src.data?.resultUrl) return importRefUrl(src.data.resultUrl)
          return Promise.resolve(null)
        }))
        results.forEach(id => { if (id) referenceMediaIds.push(id) })
      } catch (err) {
        updateNodeData(nodeId, { status: 'error', error: err.message })
        return
      }
    }

    // 비디오: 첫 프레임(단일) + 끝 프레임(단일) → mediaId
    let firstFrameMediaId = null
    let endFrameMediaId = null

    if (isVideo) {
      const refImgEdge = mediaEdges.find(e => currentNodes.find(n => n.id === e.source)?.type === 'referenceImage')
      const mediaEdge = refImgEdge ?? mediaEdges[0]
      const mediaSrc = mediaEdge ? currentNodes.find(n => n.id === mediaEdge.source) : null

      const endEdges = currentEdges.filter(e => e.target === nodeId && e.targetHandle === 'end_image')
      const endRefImgEdge = endEdges.find(e => currentNodes.find(n => n.id === e.source)?.type === 'referenceImage')
      const endEdge = endRefImgEdge ?? endEdges[0]
      const endSrc = endEdge ? currentNodes.find(n => n.id === endEdge.source) : null

      console.log(`[미디어 임포트] 첫프레임: ${mediaSrc?.type ?? '없음'}, 끝프레임: ${endSrc?.type ?? '없음'}`)
      try {
        const [fId, eId] = await Promise.all([
          mediaSrc?.type === 'referenceImage' ? uploadRefImage(mediaSrc)
            : mediaSrc?.data?.resultUrl ? importRefUrl(mediaSrc.data.resultUrl)
            : Promise.resolve(null),
          endSrc?.type === 'referenceImage' ? uploadRefImage(endSrc)
            : endSrc?.data?.resultUrl ? importRefUrl(endSrc.data.resultUrl)
            : Promise.resolve(null),
        ])
        if (fId) firstFrameMediaId = fId
        if (eId) endFrameMediaId = eId
        console.log(`[미디어 임포트 완료] firstFrameMediaId: ${firstFrameMediaId}, endFrameMediaId: ${endFrameMediaId} (${ts()})`)
      } catch (err) {
        console.error(`[미디어 임포트 실패] ${err.message} (${ts()})`)
        updateNodeData(nodeId, { status: 'error', error: err.message })
        return
      }
    }

    try {
      const endpoint = isVideo ? 'video' : 'image'
      const body = isVideo
        ? {
            prompt,
            duration: node?.data?.duration ?? '5',
            videoMode: node?.data?.videoMode ?? 'pro',
            sound: node?.data?.sound ?? 'off',
            videoAspect: node?.data?.videoAspect ?? '16:9',
            ...(firstFrameMediaId ? { firstFrameMediaId } : {}),
            ...(endFrameMediaId ? { endFrameMediaId } : {}),
          }
        : {
            prompt,
            model: node?.data?.model ?? 'nano_banana_pro',
            quality: node?.data?.quality ?? '1k',
            aspectRatio: node?.data?.aspectRatio ?? 'auto',
            referenceMediaIds,
          }

      console.log(`[생성 요청] /api/higgsfield/${endpoint} 호출 중...`, body)
      const genRes = await fetch(`${CANVAS_API}/api/higgsfield/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}))
        if (genRes.status === 401) {
          updateNodeData(nodeId, { status: 'auth_error', error: err.error })
          return
        }
        throw new Error(err.error || `서버 오류 ${genRes.status}`)
      }
      const genResData = await genRes.json()
      const { jobId } = genResData
      console.log(`[생성 응답 원문] content:`, genResData.content?.[0]?.text)
      if (!jobId) throw new Error('jobId를 받지 못했습니다')
      console.log(`[생성 요청 완료] jobId: ${jobId} (${ts()})`)

      updateNodeData(nodeId, { status: 'generating', jobId })

      // 결과 폴링 (이미지: 최대 5분, 비디오: 최대 10분)
      const deadlineMs = Date.now() + (isVideo ? 10 * 60 * 1000 : 5 * 60 * 1000)
      let resultUrl = null
      let pollCount = 0
      while (Date.now() < deadlineMs) {
        pollCount++
        const statusRes = await fetch(`${CANVAS_API}/api/higgsfield/status/${jobId}`)
        const statusData = await statusRes.json()
        const rawStatus = statusData.content?.[0]?.text?.slice(0, 200) ?? '(응답 없음)'
        console.log(`[폴링 #${pollCount}] (${ts()})`, statusData.resultUrl ? `✅ URL: ${statusData.resultUrl.slice(0, 60)}` : `⏳ 대기 중`, statusData.error ? `❌ ${statusData.error}` : '', '\n  Higgsfield 응답:', rawStatus)
        if (!statusRes.ok) throw new Error(statusData.error || `상태 조회 오류 ${statusRes.status}`)
        if (statusData.resultUrl) { resultUrl = statusData.resultUrl; break }
        if (statusData.error) throw new Error(statusData.error)
        if (rawStatus.toLowerCase().includes('something went wrong')) throw new Error(`Higgsfield 오류: ${rawStatus}`)
        if (Date.now() + 5000 < deadlineMs) await new Promise(r => setTimeout(r, 5000))
        else break
      }

      if (!resultUrl) throw new Error('결과 URL을 받지 못했습니다')
      console.log(`[생성 완료] resultUrl: ${resultUrl.slice(0, 80)} (${ts()})`)

      updateNodeData(nodeId, { status: 'done', resultUrl, jobId })

      // 연결된 ReviewGate 노드에 결과 주입
      getEdges().filter(e => e.source === nodeId && e.target !== nodeId)
        .forEach(e => updateNodeData(e.target, { resultUrl, jobId }))

    } catch (err) {
      console.error(`[생성 실패] (${ts()})`, err.message)
      updateNodeData(nodeId, { status: 'error', error: err.message })
    }
  }, [getNodes, getEdges, updateNodeData])

  useEffect(() => {
    higgsfieldHandlerRef.current = handleHiggsfieldGenerate
  }, [handleHiggsfieldGenerate])

  // 노드 연결
  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({ ...params, type: 'smoothstep' }, eds))
  }, [setEdges])

  // ── Higgsfield 인증 오류 감지 ────────────────────────────
  const hasHiggsfieldAuthError = useMemo(
    () => nodes.some(n => n.data?.status === 'auth_error'),
    [nodes]
  )

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

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <button
        onClick={() => window.open('http://localhost:3002/auth/higgsfield/start', '_blank')}
        title="Higgsfield 재연결"
        style={{
          position: 'fixed', bottom: 244, left: 12, zIndex: 10,
          height: 32, paddingInline: 10, borderRadius: 7,
          border: `1px solid ${hasHiggsfieldAuthError ? 'rgba(245,158,11,0.55)' : 'var(--controls-border)'}`,
          background: hasHiggsfieldAuthError ? 'rgba(245,158,11,0.14)' : 'var(--controls-bg)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 700,
          color: hasHiggsfieldAuthError ? '#F59E0B' : 'var(--t4)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          transition: 'all 0.2s',
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: hasHiggsfieldAuthError ? '#F59E0B' : '#22c55e',
          boxShadow: hasHiggsfieldAuthError ? '0 0 6px #F59E0B' : '0 0 6px #22c55e',
        }} />
        {hasHiggsfieldAuthError ? '재연결 필요' : 'HF 연결됨'}
      </button>
      <button
        onClick={addScene}
        title="씬 추가"
        style={{
          position: 'fixed', bottom: 200, left: 12, zIndex: 10,
          height: 32, paddingInline: 10, borderRadius: 7,
          border: '1px solid rgba(41,217,217,0.35)',
          background: 'rgba(41,217,217,0.10)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
          color: '#29D9D9',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> 씬 추가
      </button>
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
        style={{
          position: 'fixed', bottom: 160, left: 12, zIndex: 10,
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
      <ReactFlow
        nodes={nodes}
        edges={activeEdges}
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
