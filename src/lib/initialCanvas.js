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
  textInput: { type: 'textInput', data: { label: '텍스트 입력', placeholder: '내용을 입력하세요...' } },
  claudeNode: { type: 'claudeNode', data: { label: 'Claude', description: '입력 → 프롬프트 생성' } },
  higgsfieldImage: { type: 'higgsfieldNode', data: { label: '이미지 생성', type: 'image' } },
  higgsfieldVideo: { type: 'higgsfieldNode', data: { label: '비디오 생성', type: 'video' } },
  reviewGate: { type: 'reviewGate', data: { label: '리뷰 게이트', prompt: '(내용을 검토하세요)' } },
  styleAnchorInput: { type: 'styleAnchorInput', data: {} },
  referenceImage: { type: 'referenceImage', data: {} },
}

// ── 레이아웃 상수 ─────────────────────────────────────────────────
// 각 단계(Step)는 가로로 한 줄 배치:
//   [연출입력] → [Claude] → [리뷰] → [Higgsfield]
// 섹션 간격: Step01 y=-30~650, Step02 y=680~1360, Step03 y=1390~2090
const S1_Y = 20    // Step01 노드 y
const S2_Y = 710   // Step02 노드 y
const S3_Y = 1420  // Step03 노드 y

// 가로 x 오프셋 (섹션 기준)
const X_DIR    = 20   // 연출 입력
const X_CLAUDE = 310  // Claude 노드
const X_REVIEW = 630  // 리뷰 게이트
const X_HF     = 1100 // Higgsfield 노드 (가로 끝)

// ── 초기 노드 ─────────────────────────────────────────────────────
export const nodes0 = [
  // ── 섹션 배경 패널 ───────────────────────────────────────
  {
    id: 'bg-s1', type: 'sectionBackground', position: { x: 350, y: -30 },
    data: { width: 1420, height: 680, step: 'Step 01', label: '캐릭터 생성',
      bg: 'rgba(31,65,176,0.09)', border: 'rgba(31,65,176,0.42)', accent: 'rgba(100,140,255,0.9)', headerIncluded: true },
    selectable: false, draggable: true, dragHandle: '.section-drag-handle', focusable: false, zIndex: 0,
  },
  {
    id: 'bg-s2', type: 'sectionBackground', position: { x: 350, y: 680 },
    data: { width: 1420, height: 680, step: 'Step 02 · 씬 1', label: '이미지 생성',
      bg: 'rgba(41,217,217,0.05)', border: 'rgba(41,217,217,0.32)', accent: '#29D9D9', headerIncluded: true },
    selectable: false, draggable: true, dragHandle: '.section-drag-handle', focusable: false, zIndex: 0,
  },
  {
    id: 'bg-s3', type: 'sectionBackground', position: { x: 350, y: 1390 },
    data: { width: 1420, height: 700, step: 'Step 03 · 씬 1', label: '비디오 생성',
      bg: 'rgba(100,40,200,0.08)', border: 'rgba(130,60,230,0.38)', accent: 'rgba(170,110,255,1)', headerIncluded: true },
    selectable: false, draggable: true, dragHandle: '.section-drag-handle', focusable: false, zIndex: 0,
  },
  { id: 'styleAnchor', type: 'styleAnchorInput', position: { x: 40, y: -80 }, data: {} },

  // ── Step 01: 캐릭터 생성 (가로 한 줄) ────────────────────
  {
    id: 'charDirection', type: 'textInput', position: { x: 350 + X_DIR, y: S1_Y },
    data: { label: '캐릭터 연출 입력', placeholder: '원하는 캐릭터를 설명해주세요.\n예) 20대 여성, 짧은 검은 머리...' },
  },
  {
    id: 'claudeChar', type: 'claudeNode', position: { x: 350 + X_CLAUDE, y: S1_Y },
    data: { label: '캐릭터 프롬프트 생성', description: '이미지 앵커 + 캐릭터 연출 → 캐릭터 생성 프롬프트', promptType: 'claudeChar' },
  },
  {
    id: 'reviewCharPrompt', type: 'reviewGate', position: { x: 350 + X_REVIEW, y: S1_Y },
    data: { label: '캐릭터 프롬프트 리뷰', prompt: '(Claude가 생성한 캐릭터 프롬프트)' },
  },
  {
    id: 'higgsfieldChar', type: 'higgsfieldNode', position: { x: 350 + X_HF, y: S1_Y },
    data: { label: '캐릭터 생성', type: 'image', model: 'gpt_image_2', quality: 'high', aspectRatio: '9:16' },
  },

  // ── Step 02: 이미지 생성 (가로 한 줄) ────────────────────
  {
    id: 'imageDirection', type: 'textInput', position: { x: 350 + X_DIR, y: S2_Y },
    data: { label: '이미지 연출 입력', placeholder: '원하는 장면을 설명해주세요.\n예) 캐릭터가 카페 창가에 앉아 커피를 마시는 장면...' },
  },
  {
    id: 'claudeImage', type: 'claudeNode', position: { x: 350 + X_CLAUDE, y: S2_Y },
    data: { label: '이미지 프롬프트 생성', description: '캐릭터 참조 + 이미지 연출 → 첫 프레임 이미지 프롬프트', promptType: 'claudeImage' },
  },
  {
    id: 'reviewImagePrompt', type: 'reviewGate', position: { x: 350 + X_REVIEW, y: S2_Y },
    data: { label: '이미지 프롬프트 리뷰', prompt: '(Claude가 생성한 이미지 프롬프트)' },
  },
  {
    id: 'higgsfieldImage', type: 'higgsfieldNode', position: { x: 350 + X_HF, y: S2_Y },
    data: { label: '이미지 생성', type: 'image', hasRef: true, model: 'nano_banana_pro' },
  },

  // ── Step 03: 비디오 생성 (가로 한 줄) ────────────────────
  {
    id: 'vidDirection', type: 'videoDirectionInput', position: { x: 350 + X_DIR, y: S3_Y },
    data: { label: '비디오 연출 입력', placeholder: '원하는 영상 연출을 설명해주세요.\n예) 카메라가 천천히 줌인하며...' },
  },
  {
    id: 'claudeVideo', type: 'claudeNode', position: { x: 350 + X_CLAUDE, y: S3_Y },
    data: { label: '비디오 프롬프트 생성', description: '비디오 앵커 + 연출 입력 → 비디오 생성 프롬프트', promptType: 'claudeVideo' },
  },
  {
    id: 'reviewVideoPrompt', type: 'reviewGate', position: { x: 350 + X_REVIEW, y: S3_Y },
    data: { label: '비디오 프롬프트 리뷰', prompt: '(Claude가 생성한 비디오 프롬프트)', charLimit: 2500 },
  },
  {
    id: 'higgsfieldVideo', type: 'higgsfieldNode', position: { x: 350 + X_HF, y: S3_Y },
    data: { label: '비디오 생성', type: 'video' },
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
  { id: 'e-hc-hi', source: 'higgsfieldChar', target: 'higgsfieldImage', targetHandle: 'ref', label: '캐릭터 참조', ...dataEdge },
  { id: 'e-id-ci', source: 'imageDirection', target: 'claudeImage', targetHandle: 'command' },
  { id: 'e-ci-rip', source: 'claudeImage', target: 'reviewImagePrompt', targetHandle: 'left' },
  { id: 'e-rip-hi', source: 'reviewImagePrompt', target: 'higgsfieldImage', targetHandle: 'prompt', label: '승인', ...approveLabel },
  { id: 'e-rip-ci', source: 'reviewImagePrompt', target: 'claudeImage', label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
  { id: 'e-hi-hv', source: 'higgsfieldImage', target: 'higgsfieldVideo', targetHandle: 'image', label: '첫 프레임', ...dataEdge },
  { id: 'e-cv-rvp', source: 'claudeVideo', target: 'reviewVideoPrompt', targetHandle: 'left' },
  { id: 'e-rvp-hv', source: 'reviewVideoPrompt', target: 'higgsfieldVideo', targetHandle: 'prompt', label: '승인', ...approveLabel },
  { id: 'e-rvp-cv', source: 'reviewVideoPrompt', target: 'claudeVideo', label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
]

// ── 캐릭터 섹션 복제 팩토리 ──────────────────────────────────────
export const CHAR_X_STEP = 1500

export function buildCharSection(charIdx) {
  const uid = `ch${Date.now()}`
  const x = 350 + (charIdx - 1) * CHAR_X_STEP
  const u = uid

  const nodes = [
    { id: `bg-s1-${u}`, type: 'sectionBackground', position: { x, y: -30 },
      data: { width: 1420, height: 680, step: `Step 01 · 캐릭터 ${charIdx}`, label: '캐릭터 생성',
        bg: 'rgba(31,65,176,0.09)', border: 'rgba(31,65,176,0.42)', accent: 'rgba(100,140,255,0.9)', headerIncluded: true },
      selectable: false, draggable: true, dragHandle: '.section-drag-handle', focusable: false, zIndex: 0 },
    { id: `charDirection-${u}`, type: 'textInput', position: { x: x + X_DIR, y: S1_Y },
      data: { label: `캐릭터 연출 · ${charIdx}`, placeholder: '원하는 캐릭터를 설명해주세요.\n예) 20대 여성, 짧은 검은 머리...' } },
    { id: `claudeChar-${u}`, type: 'claudeNode', position: { x: x + X_CLAUDE, y: S1_Y },
      data: { label: '캐릭터 프롬프트 생성', description: '이미지 앵커 + 캐릭터 연출 → 캐릭터 생성 프롬프트', promptType: 'claudeChar' } },
    { id: `reviewCharPrompt-${u}`, type: 'reviewGate', position: { x: x + X_REVIEW, y: S1_Y },
      data: { label: '캐릭터 프롬프트 리뷰', prompt: '(Claude가 생성한 캐릭터 프롬프트)' } },
    { id: `higgsfieldChar-${u}`, type: 'higgsfieldNode', position: { x: x + X_HF, y: S1_Y },
      data: { label: '캐릭터 생성', type: 'image', model: 'gpt_image_2', quality: 'high', aspectRatio: '9:16' } },
  ]

  const edges = [
    { id: `e-sa-cc-${u}`, source: 'styleAnchor', sourceHandle: 'image', target: `claudeChar-${u}`, targetHandle: 'anchor', label: '이미지 앵커', ...dataEdge },
    { id: `e-cd-cc-${u}`, source: `charDirection-${u}`, target: `claudeChar-${u}`, targetHandle: 'command' },
    { id: `e-cc-rcp-${u}`, source: `claudeChar-${u}`, target: `reviewCharPrompt-${u}`, targetHandle: 'left' },
    { id: `e-rcp-hc-${u}`, source: `reviewCharPrompt-${u}`, target: `higgsfieldChar-${u}`, targetHandle: 'prompt', label: '승인', ...approveLabel },
    { id: `e-rcp-cc-${u}`, source: `reviewCharPrompt-${u}`, target: `claudeChar-${u}`, label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
  ]

  return { nodes, edges, uid }
}

// ── 씬 복제 팩토리 ────────────────────────────────────────────────
export const SCENE_Y_STEP = 1500   // 씬은 아래로 쌓임

export function buildScene(sceneIdx, imgDef = {}, vidDef = {}) {
  const uid = `sc${Date.now()}`
  const y_off = (sceneIdx - 1) * SCENE_Y_STEP  // 씬 번호에 따라 아래로 이동
  const x = 350                                  // 모든 씬 동일한 x
  const u = uid

  const nodes = [
    { id: `bg-s2-${u}`, type: 'sectionBackground', position: { x, y: 680 + y_off },
      data: { width: 1420, height: 680, step: `Step 02 · 씬 ${sceneIdx}`, label: '이미지 생성',
        bg: 'rgba(41,217,217,0.05)', border: 'rgba(41,217,217,0.32)', accent: '#29D9D9', headerIncluded: true },
      selectable: false, draggable: true, dragHandle: '.section-drag-handle', focusable: false, zIndex: 0 },
    { id: `bg-s3-${u}`, type: 'sectionBackground', position: { x, y: 1390 + y_off },
      data: { width: 1420, height: 700, step: `Step 03 · 씬 ${sceneIdx}`, label: '비디오 생성',
        bg: 'rgba(100,40,200,0.08)', border: 'rgba(130,60,230,0.38)', accent: 'rgba(170,110,255,1)', headerIncluded: true },
      selectable: false, draggable: true, dragHandle: '.section-drag-handle', focusable: false, zIndex: 0 },
    { id: `imageDirection-${u}`, type: 'textInput', position: { x: x + X_DIR, y: S2_Y + y_off },
      data: { label: `이미지 연출 · 씬 ${sceneIdx}`, placeholder: '원하는 장면을 설명해주세요...' } },
    { id: `claudeImage-${u}`, type: 'claudeNode', position: { x: x + X_CLAUDE, y: S2_Y + y_off },
      data: { label: '이미지 프롬프트 생성', description: '캐릭터 참조 + 이미지 연출 → 첫 프레임 이미지 프롬프트', promptType: 'claudeImage' } },
    { id: `reviewImagePrompt-${u}`, type: 'reviewGate', position: { x: x + X_REVIEW, y: S2_Y + y_off },
      data: { label: '이미지 프롬프트 리뷰', prompt: '(Claude가 생성한 이미지 프롬프트)' } },
    { id: `higgsfieldImage-${u}`, type: 'higgsfieldNode', position: { x: x + X_HF, y: S2_Y + y_off },
      data: { label: '이미지 생성', type: 'image', hasRef: true,
        model: imgDef.model ?? 'nano_banana_pro',
        quality: imgDef.quality ?? '1k',
        aspectRatio: imgDef.aspectRatio ?? 'auto',
      } },
    { id: `vidDirection-${u}`, type: 'videoDirectionInput', position: { x: x + X_DIR, y: S3_Y + y_off },
      data: { label: `비디오 연출 · 씬 ${sceneIdx}`, placeholder: '원하는 영상 연출을 설명해주세요...' } },
    { id: `claudeVideo-${u}`, type: 'claudeNode', position: { x: x + X_CLAUDE, y: S3_Y + y_off },
      data: { label: '비디오 프롬프트 생성', description: '비디오 앵커 + 연출 입력 → 비디오 생성 프롬프트',
        promptType: vidDef.videoModel === 'seedance_2_0' ? 'claudeSeedance' : 'claudeVideo' } },
    { id: `reviewVideoPrompt-${u}`, type: 'reviewGate', position: { x: x + X_REVIEW, y: S3_Y + y_off },
      data: { label: '비디오 프롬프트 리뷰', prompt: '(Claude가 생성한 비디오 프롬프트)', charLimit: 2500 } },
    { id: `higgsfieldVideo-${u}`, type: 'higgsfieldNode', position: { x: x + X_HF, y: S3_Y + y_off },
      data: { label: '비디오 생성', type: 'video',
        videoModel: vidDef.videoModel ?? 'kling3_0',
        videoMode: vidDef.videoMode ?? 'pro',
        videoAspect: vidDef.videoAspect ?? '9:16',
        sound: vidDef.sound ?? 'off',
        duration: vidDef.duration ?? 5,
      } },
  ]

  const edges = [
    { id: `e-sa-ci-${u}`, source: 'styleAnchor', sourceHandle: 'image', target: `claudeImage-${u}`, targetHandle: 'anchor', label: '이미지 앵커', ...dataEdge },
    { id: `e-sa-cv-${u}`, source: 'styleAnchor', sourceHandle: 'video', target: `claudeVideo-${u}`, targetHandle: 'anchor', label: '비디오 앵커', ...dataEdge },
    { id: `e-id-ci-${u}`, source: `imageDirection-${u}`, target: `claudeImage-${u}`, targetHandle: 'command' },
    { id: `e-ci-rip-${u}`, source: `claudeImage-${u}`, target: `reviewImagePrompt-${u}`, targetHandle: 'left' },
    { id: `e-rip-hi-${u}`, source: `reviewImagePrompt-${u}`, target: `higgsfieldImage-${u}`, targetHandle: 'prompt', label: '승인', ...approveLabel },
    { id: `e-rip-ci-${u}`, source: `reviewImagePrompt-${u}`, target: `claudeImage-${u}`, label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
    { id: `e-hi-hv-${u}`, source: `higgsfieldImage-${u}`, target: `higgsfieldVideo-${u}`, targetHandle: 'image', label: '첫 프레임', ...dataEdge },
    { id: `e-vd-cv-${u}`, source: `vidDirection-${u}`, target: `claudeVideo-${u}`, targetHandle: 'command' },
    { id: `e-cv-rvp-${u}`, source: `claudeVideo-${u}`, target: `reviewVideoPrompt-${u}`, targetHandle: 'left' },
    { id: `e-rvp-hv-${u}`, source: `reviewVideoPrompt-${u}`, target: `higgsfieldVideo-${u}`, targetHandle: 'prompt', label: '승인', ...approveLabel },
    { id: `e-rvp-cv-${u}`, source: `reviewVideoPrompt-${u}`, target: `claudeVideo-${u}`, label: '재생성', style: { stroke: '#E34054', strokeWidth: 1.5 }, animated: true, ...rejectLabel },
  ]

  return { nodes, edges }
}

// ── 저장된 노드 로드 시 진행 중 상태 초기화 ──────────────────────
export function resetInProgressNodes(nodes) {
  return nodes.map(n => {
    const s = n.data?.status
    // jobId가 있는 generating/slow 노드는 폴링 재개 대상이므로 유지
    if ((s === 'generating' || s === 'slow') && n.data?.jobId) return n
    if (s === 'loading' || s === 'generating' || s === 'slow') {
      return { ...n, data: { ...n.data, status: 'idle', error: undefined } }
    }
    return n
  })
}
