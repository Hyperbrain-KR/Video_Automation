import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/compressImage'

const BUCKET = 'storyboard-images'

export const STAGES = [
  { key: 'red', label: '빨강' },
  { key: 'yellow', label: '노랑' },
  { key: 'green', label: '초록' },
  { key: 'blue', label: '파랑' },
  { key: 'purple', label: '보라' },
  { key: 'gray', label: '회색' },
]
// 단계 이름은 사용자가 직접 적고, 입력할 때 아래 이름을 추천으로 보여준다
export const STAGE_PRESETS = ['Hook', 'Bridge']
// 맨 왼쪽 시나리오 카드 — list: true 는 한 줄에 하나씩 적는 목록
export const SCENARIO_FIELDS = [
  { key: 'summary', label: '설명', placeholder: '이 주인공은 어떤 사람이고 무엇을 하려는지' },
  { key: 'goals', label: '목표와 니즈', list: true },
  { key: 'pains', label: '고민과 제약', list: true },
  { key: 'context', label: '상황', list: true },
  { key: 'activities', label: '주요 행동과 과제', list: true },
]
export const SCENARIO_COMMENT_ID = 'scenario'
export const FIELDS = [
  { key: 'direction', label: '연출 입력' },
  { key: 'prompt', label: '프롬프트 초안' },
  { key: 'audio', label: '오디오' },
  { key: 'narration', label: '나레이션' },
]

const newId = () => crypto.randomUUID()

export function newFrame(stageLabel = '', stageColor = 'gray') {
  return { id: newId(), image: null, stageLabel, stageColor, direction: '', prompt: '', audio: '', narration: '' }
}

const defaultFrames = () => [
  newFrame('', 'red'),
  newFrame('', 'yellow'),
  newFrame('', 'green'),
  newFrame('', 'green'),
  newFrame('', 'purple'),
]

export const displayName = user => user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '이름 없음'

const must = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}

export async function listBoards() {
  return must(await supabase.from('storyboards')
    .select('id, owner_id, owner_name, title, updated_at, frames')
    .order('updated_at', { ascending: false }))
}

export async function createBoard(user) {
  return must(await supabase.from('storyboards')
    .insert({ owner_name: displayName(user), title: '새 스토리보드', frames: defaultFrames() })
    .select().single())
}

export async function getBoard(id) {
  return must(await supabase.from('storyboards').select('*').eq('id', id).maybeSingle())
}

export async function saveBoard(id, { title, frames, scenario }) {
  must(await supabase.from('storyboards')
    .update({ title, frames, scenario: scenario ?? {}, updated_at: new Date().toISOString() })
    .eq('id', id))
}

export async function deleteBoard(board) {
  const folder = `${board.owner_id}/${board.id}`
  const files = must(await supabase.storage.from(BUCKET).list(folder, { limit: 1000 }))
  if (files.length) must(await supabase.storage.from(BUCKET).remove(files.map(f => `${folder}/${f.name}`)))
  must(await supabase.from('storyboards').delete().eq('id', board.id))
}

const readAsDataUrl = file => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(r.result)
  r.onerror = () => reject(new Error('이미지를 읽지 못했습니다'))
  r.readAsDataURL(file)
})

// 스토리보드 이미지는 화면에서 보기만 하므로 용량을 줄여 저장한다
export async function uploadFrameImage(userId, boardId, frameId, file) {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 올릴 수 있습니다')
  const dataUrl = await compressImage(await readAsDataUrl(file), { maxSide: 1600, quality: 0.85 })
  const blob = await (await fetch(dataUrl)).blob()
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${boardId}/${frameId}-${Date.now()}.${ext}`
  must(await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type }))
  return path
}

export async function removeImage(path) {
  if (path) await supabase.storage.from(BUCKET).remove([path])
}

export async function signedUrls(paths) {
  if (!paths.length) return {}
  const rows = must(await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60))
  return Object.fromEntries(rows.filter(r => r.signedUrl).map(r => [r.path, r.signedUrl]))
}

export async function listComments(boardId) {
  return must(await supabase.from('storyboard_comments')
    .select('*').eq('storyboard_id', boardId).order('created_at'))
}

export async function addComment(boardId, frameId, body, user) {
  return must(await supabase.from('storyboard_comments')
    .insert({ storyboard_id: boardId, frame_id: frameId, body, author_name: displayName(user) })
    .select().single())
}

export async function deleteComment(id) {
  must(await supabase.from('storyboard_comments').delete().eq('id', id))
}
