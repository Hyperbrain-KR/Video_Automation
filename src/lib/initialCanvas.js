// ── Edge style helpers ─────────────────────────────────────────────
export const approveLabel = {
  labelStyle: { fill: '#F4F4F4', fontWeight: 700, fontSize: 11 },
  labelBgStyle: { fill: 'rgba(5,10,25,0.92)' },
  labelBgPadding: [5, 7],
  labelBgBorderRadius: 5,
  style: { stroke: '#29D9D9', strokeWidth: 1.5 },
}

export const rejectLabel = {
  labelStyle: { fill: '#F4F4F4', fontWeight: 700, fontSize: 11 },
  labelBgStyle: { fill: 'rgba(5,10,25,0.92)' },
  labelBgPadding: [5, 7],
  labelBgBorderRadius: 5,
}

export const dataEdge = {
  style: { stroke: 'rgba(244,244,244,0.22)', strokeDasharray: '5,4', strokeWidth: 1.2 },
  labelStyle: { fill: 'rgba(244,244,244,0.5)', fontSize: 10 },
  labelBgStyle: { fill: 'rgba(5,10,25,0.85)' },
  labelBgPadding: [3, 5],
  labelBgBorderRadius: 4,
  className: 'data-edge',
}

// ── Node templates for context menu ───────────────────────────────
export const nodeTemplates = {
  scriptImport: { type: 'scriptImport', data: {} },
  textInput: { type: 'textInput', data: { label: '텍스트 입력', placeholder: '내용을 입력하세요...' } },
  claudeNode: { type: 'claudeNode', data: { label: 'Claude', description: '입력 → 프롬프트 생성' } },
  higgsfieldImage: { type: 'higgsfieldNode', data: { label: '이미지 생성', type: 'image' } },
  higgsfieldVideo: { type: 'higgsfieldNode', data: { label: '비디오 생성', type: 'video' } },
  reviewGate: { type: 'reviewGate', data: { label: '리뷰 게이트', prompt: '(내용을 검토하세요)' } },
  styleAnchorInput: { type: 'styleAnchorInput', data: {} },
  referenceImage: { type: 'referenceImage', data: {} },
}

// ── 초기 노드 ─────────────────────────────────────────────────────
export const nodes0 = [
  // ── 섹션 배경 패널 ───────────────────────────────────────
  {
    id: 'bg-s1', type: 'sectionBackground', position: { x: 350, y: 0 },
    data: { width: 945, height: 468, step: 'Step 01', label: '캐릭터 생성',
      bg: 'rgba(31,65,176,0.09)', border: 'rgba(31,65,176,0.42)', accent: 'rgba(100,140,255,0.9)' },
    selectable: false, draggable: false, focusable: false, zIndex: -1,
  },
  {
    id: 'bg-s2', type: 'sectionBackground', position: { x: 350, y: 558 },
    data: { width: 945, height: 482, step: 'Step 02 · 씬 1', label: '이미지 생성',
      bg: 'rgba(41,217,217,0.05)', border: 'rgba(41,217,217,0.32)', accent: '#29D9D9' },
    selectable: false, draggable: false, focusable: false, zIndex: -1,
  },
  {
    id: 'bg-s3', type: 'sectionBackground', position: { x: 350, y: 1110 },
    data: { width: 945, height: 492, step: 'Step 03 · 씬 1', label: '비디오 생성',
      bg: 'rgba(100,40,200,0.08)', border: 'rgba(130,60,230,0.38)', accent: 'rgba(170,110,255,1)' },
    selectable: false, draggable: false, focusable: false, zIndex: -1,
  },
  { id: 'scriptImport', type: 'scriptImport', position: { x: -320, y: 200 }, data: {} },
  { id: 'styleAnchor', type: 'styleAnchorInput', position: { x: 40, y: -80 }, data: {} },

  // ── Section 1: 캐릭터 생성 ──────────────────────────────
  {
    id: 'charDirection', type: 'textInput', position: { x: 370, y: 20 },
    data: { label: '캐릭터 연출 입력', placeholder: '원하는 캐릭터를 설명해주세요.\n예) 20대 여성, 짧은 검은 머리...' },
  },
  {
    id: 'claudeChar', type: 'claudeNode', position: { x: 660, y: 20 },
    data: { label: '캐릭터 프롬프트 생성', description: '이미지 앵커 + 캐릭터 연출 → 캐릭터 생성 프롬프트', promptType: 'claudeChar' },
  },
  {
    id: 'reviewCharPrompt', type: 'reviewGate', position: { x: 980, y: 20 },
    data: { label: '캐릭터 프롬프트 리뷰', prompt: '(Claude가 생성한 캐릭터 프롬프트)' },
  },
  { id: 'higgsfieldChar', type: 'higgsfieldNode', position: { x: 660, y: 270 }, data: { label: '캐릭터 생성', type: 'image' } },
  {
    id: 'reviewCharResult', type: 'reviewGate', position: { x: 980, y: 270 },
    data: { label: '생성된 캐릭터 리뷰', prompt: '(Higgsfield가 생성한 캐릭터 이미지 확인)' },
  },

  // ── Section 2: 이미지 생성 ──────────────────────────────
  {
    id: 'imageDirection', type: 'textInput', position: { x: 370, y: 580 },
    data: { label: '이미지 연출 입력', placeholder: '원하는 장면을 설명해주세요.\n예) 캐릭터가 카페 창가에 앉아 커피를 마시는 장면...' },
  },
  {
    id: 'claudeImage', type: 'claudeNode', position: { x: 660, y: 580 },
    data: { label: '이미지 프롬프트 생성', description: '캐릭터 참조 + 이미지 연출 → 첫 프레임 이미지 프롬프트', promptType: 'claudeImage' },
  },
  {
    id: 'reviewImagePrompt', type: 'reviewGate', position: { x: 980, y: 580 },
    data: { label: '이미지 프롬프트 리뷰', prompt: '(Claude가 생성한 이미지 프롬프트)' },
  },
  { id: 'higgsfieldImage', type: 'higgsfieldNode', position: { x: 660, y: 840 }, data: { label: '이미지 생성', type: 'image', hasRef: true, model: 'nano_banana_pro' } },
  {
    id: 'reviewImageResult', type: 'reviewGate', position: { x: 980, y: 840 },
    data: { label: '이미지 리뷰', prompt: '(생성된 이미지 확인 후 비디오 단계로)' },
  },

  // ── Section 3: 비디오 생성 ──────────────────────────────
  {
    id: 'vidDirection', type: 'textInput', position: { x: 370, y: 1130 },
    data: { label: '비디오 연출 입력', placeholder: '원하는 영상 연출을 설명해주세요.\n예) 카메라가 천천히 줌인하며...' },
  },
  {
    id: 'claudeVideo', type: 'claudeNode', position: { x: 660, y: 1130 },
    data: { label: '비디오 프롬프트 생성', description: '비디오 앵커 + 연출 입력 → 비디오 생성 프롬프트', promptType: 'claudeVideo' },
  },
  {
    id: 'reviewVideoPrompt', type: 'reviewGate', position: { x: 980, y: 1130 },
    data: { label: '비디오 프롬프트 리뷰', prompt: '(Claude가 생성한 비디오 프롬프트)', charLimit: 2500 },
  },
  { id: 'higgsfieldVideo', type: 'higgsfieldNode', position: { x: 660, y: 1400 }, data: { label: '비디오 생성', type: 'video' } },
  {
    id: 'reviewVideoResult', type: 'reviewGate', position: { x: 980, y: 1400 },
    data: { label: '최종 비디오 리뷰', prompt: '(최종 비디오 확인 후 다운로드)' },
  },
]

// ── 초기 엣지 ─────────────────────────────────────────────────────
export const edges0 = [
  { id: 'e-sa-cc', source: 'styleAnchor', sourceHandle: 'image', target: 'claudeChar', targetHandle: 'anchor', label: '이미지 앵커', ...dataEdge },
  { id: 'e-sa-ci', source: 'styleAnchor', sourceHandle: 'image', target: 'claudeImage', targetHandle: 'anchor', label: '이미지 앵커', ...dataEdge },
  { id: 'e-sa-cv', source: 'styleAnchor', sourceHandle: 'video', target: 'claudeVideo', targetHandle: 'anchor', label: '비디오 앵커', ...dataEdge },
  { id: 'e-cd-cc', source: 'charDirection', target: 'claudeChar', targetHandle: 'command' },
  { id: 'e-vd-cv', source: 'vidDirection', target: 'claudeVideo', targetHandle: 'command' },
  { id: 'e-cc-rcp', source: 'claudeChar', target: 'reviewCharPrompt', targetHandle: 'left' },
  { id: 'e-rcp-hc', source: 'reviewCharPrompt', target: 'higgsfieldChar', targetHandle: 'prompt', label: '승인', ...approveLabel },
  { id: 'e-rcp-cc', source: 'reviewCharPrompt', target: 'claudeChar', label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
  { id: 'e-hc-rcr', source: 'higgsfieldChar', target: 'reviewCharResult', targetHandle: 'left' },
  { id: 'e-rcr-rcp', source: 'reviewCharResult', target: 'reviewCharPrompt', targetHandle: 'top', label: '프롬프트 수정', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
  { id: 'e-rcr-ci', source: 'reviewCharResult', target: 'claudeImage', targetHandle: 'anchor', label: '캐릭터 참조', ...dataEdge },
  { id: 'e-id-ci', source: 'imageDirection', target: 'claudeImage', targetHandle: 'command' },
  { id: 'e-rcr-hi', source: 'reviewCharResult', target: 'higgsfieldImage', targetHandle: 'ref', label: '캐릭터 참조', ...dataEdge },
  { id: 'e-ci-rip', source: 'claudeImage', target: 'reviewImagePrompt', targetHandle: 'left' },
  { id: 'e-rip-hi', source: 'reviewImagePrompt', target: 'higgsfieldImage', targetHandle: 'prompt', label: '승인', ...approveLabel },
  { id: 'e-rip-ci', source: 'reviewImagePrompt', target: 'claudeImage', label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
  { id: 'e-hi-rir', source: 'higgsfieldImage', target: 'reviewImageResult', targetHandle: 'left' },
  { id: 'e-rir-rip', source: 'reviewImageResult', target: 'reviewImagePrompt', targetHandle: 'top', label: '프롬프트 수정', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
  { id: 'e-rir-hv', source: 'reviewImageResult', target: 'higgsfieldVideo', targetHandle: 'image', label: '첫 프레임', ...dataEdge },
  { id: 'e-cv-rvp', source: 'claudeVideo', target: 'reviewVideoPrompt', targetHandle: 'left' },
  { id: 'e-rvp-hv', source: 'reviewVideoPrompt', target: 'higgsfieldVideo', targetHandle: 'prompt', label: '승인', ...approveLabel },
  { id: 'e-rvp-cv', source: 'reviewVideoPrompt', target: 'claudeVideo', label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
  { id: 'e-hv-rvr', source: 'higgsfieldVideo', target: 'reviewVideoResult', targetHandle: 'left' },
  { id: 'e-rvr-rvp', source: 'reviewVideoResult', target: 'reviewVideoPrompt', targetHandle: 'top', label: '프롬프트 수정', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
]

// ── 씬 복제 팩토리 ────────────────────────────────────────────────
export const SCENE_X_STEP = 1000

export function buildScene(sceneIdx) {
  const uid = `sc${Date.now()}`
  const x = 350 + (sceneIdx - 1) * SCENE_X_STEP
  const u = uid

  const nodes = [
    { id: `bg-s2-${u}`, type: 'sectionBackground', position: { x, y: 558 },
      data: { width: 945, height: 482, step: `Step 02 · 씬 ${sceneIdx}`, label: '이미지 생성',
        bg: 'rgba(41,217,217,0.05)', border: 'rgba(41,217,217,0.32)', accent: '#29D9D9' },
      selectable: false, draggable: false, focusable: false, zIndex: -1 },
    { id: `bg-s3-${u}`, type: 'sectionBackground', position: { x, y: 1110 },
      data: { width: 945, height: 492, step: `Step 03 · 씬 ${sceneIdx}`, label: '비디오 생성',
        bg: 'rgba(100,40,200,0.08)', border: 'rgba(130,60,230,0.38)', accent: 'rgba(170,110,255,1)' },
      selectable: false, draggable: false, focusable: false, zIndex: -1 },
    { id: `imageDirection-${u}`, type: 'textInput', position: { x: x + 20, y: 580 },
      data: { label: `이미지 연출 · 씬 ${sceneIdx}`, placeholder: '원하는 장면을 설명해주세요...' } },
    { id: `claudeImage-${u}`, type: 'claudeNode', position: { x: x + 310, y: 580 },
      data: { label: '이미지 프롬프트 생성', description: '캐릭터 참조 + 이미지 연출 → 첫 프레임 이미지 프롬프트', promptType: 'claudeImage' } },
    { id: `reviewImagePrompt-${u}`, type: 'reviewGate', position: { x: x + 630, y: 580 },
      data: { label: '이미지 프롬프트 리뷰', prompt: '(Claude가 생성한 이미지 프롬프트)' } },
    { id: `higgsfieldImage-${u}`, type: 'higgsfieldNode', position: { x: x + 310, y: 840 },
      data: { label: '이미지 생성', type: 'image', hasRef: true, model: 'nano_banana_pro' } },
    { id: `reviewImageResult-${u}`, type: 'reviewGate', position: { x: x + 630, y: 840 },
      data: { label: '이미지 리뷰', prompt: '(생성된 이미지 확인 후 비디오 단계로)' } },
    { id: `vidDirection-${u}`, type: 'textInput', position: { x: x + 20, y: 1130 },
      data: { label: `비디오 연출 · 씬 ${sceneIdx}`, placeholder: '원하는 영상 연출을 설명해주세요...' } },
    { id: `claudeVideo-${u}`, type: 'claudeNode', position: { x: x + 310, y: 1130 },
      data: { label: '비디오 프롬프트 생성', description: '비디오 앵커 + 연출 입력 → 비디오 생성 프롬프트', promptType: 'claudeVideo' } },
    { id: `reviewVideoPrompt-${u}`, type: 'reviewGate', position: { x: x + 630, y: 1130 },
      data: { label: '비디오 프롬프트 리뷰', prompt: '(Claude가 생성한 비디오 프롬프트)', charLimit: 2500 } },
    { id: `higgsfieldVideo-${u}`, type: 'higgsfieldNode', position: { x: x + 310, y: 1400 },
      data: { label: '비디오 생성', type: 'video' } },
    { id: `reviewVideoResult-${u}`, type: 'reviewGate', position: { x: x + 630, y: 1400 },
      data: { label: '최종 비디오 리뷰', prompt: '(최종 비디오 확인 후 다운로드)' } },
  ]

  const edges = [
    { id: `e-sa-ci-${u}`, source: 'styleAnchor', sourceHandle: 'image', target: `claudeImage-${u}`, targetHandle: 'anchor', label: '이미지 앵커', ...dataEdge },
    { id: `e-sa-cv-${u}`, source: 'styleAnchor', sourceHandle: 'video', target: `claudeVideo-${u}`, targetHandle: 'anchor', label: '비디오 앵커', ...dataEdge },
    { id: `e-id-ci-${u}`, source: `imageDirection-${u}`, target: `claudeImage-${u}`, targetHandle: 'command' },
    { id: `e-ci-rip-${u}`, source: `claudeImage-${u}`, target: `reviewImagePrompt-${u}`, targetHandle: 'left' },
    { id: `e-rip-hi-${u}`, source: `reviewImagePrompt-${u}`, target: `higgsfieldImage-${u}`, targetHandle: 'prompt', label: '승인', ...approveLabel },
    { id: `e-rip-ci-${u}`, source: `reviewImagePrompt-${u}`, target: `claudeImage-${u}`, label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
    { id: `e-hi-rir-${u}`, source: `higgsfieldImage-${u}`, target: `reviewImageResult-${u}`, targetHandle: 'left' },
    { id: `e-rir-rip-${u}`, source: `reviewImageResult-${u}`, target: `reviewImagePrompt-${u}`, targetHandle: 'top', label: '프롬프트 수정', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
    { id: `e-rir-hv-${u}`, source: `reviewImageResult-${u}`, target: `higgsfieldVideo-${u}`, targetHandle: 'image', label: '첫 프레임', ...dataEdge },
    { id: `e-vd-cv-${u}`, source: `vidDirection-${u}`, target: `claudeVideo-${u}`, targetHandle: 'command' },
    { id: `e-cv-rvp-${u}`, source: `claudeVideo-${u}`, target: `reviewVideoPrompt-${u}`, targetHandle: 'left' },
    { id: `e-rvp-hv-${u}`, source: `reviewVideoPrompt-${u}`, target: `higgsfieldVideo-${u}`, targetHandle: 'prompt', label: '승인', ...approveLabel },
    { id: `e-rvp-cv-${u}`, source: `reviewVideoPrompt-${u}`, target: `claudeVideo-${u}`, label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
    { id: `e-hv-rvr-${u}`, source: `higgsfieldVideo-${u}`, target: `reviewVideoResult-${u}`, targetHandle: 'left' },
    { id: `e-rvr-rvp-${u}`, source: `reviewVideoResult-${u}`, target: `reviewVideoPrompt-${u}`, targetHandle: 'top', label: '프롬프트 수정', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
  ]

  return { nodes, edges }
}

// ── 저장된 노드 로드 시 진행 중 상태 초기화 ──────────────────────
export function resetInProgressNodes(nodes) {
  return nodes.map(n => {
    if (n.data?.status === 'loading' || n.data?.status === 'generating') {
      return { ...n, data: { ...n.data, status: 'idle', error: undefined } }
    }
    return n
  })
}
