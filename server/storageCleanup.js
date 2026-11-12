const BUCKET = 'canvas-images'
const GRACE_MS = 60 * 24 * 60 * 60 * 1000
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000
// 참조 계산이 잘못됐을 때 대량 삭제를 막는 상한
const MAX_ORPHAN_RATIO = 0.3

async function listAll(supabase, prefix) {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset })
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

async function loadReferencedPaths(supabase) {
  const refs = new Set()
  let count = 0
  for (let from = 0; ; from += 50) {
    const { data, error } = await supabase.from('projects')
      .select('id,user_id,nodes,characters').order('id').range(from, from + 49)
    if (error) throw error
    for (const p of data) {
      count++
      // 키 규칙은 src/lib/imageDB.js 의 deleteProjectImages 와 동일해야 함
      for (const n of p.nodes ?? []) {
        if (n.data?.hasDirectionImage) refs.add(`${p.user_id}/direction-${p.id}-${n.id}`)
        if (n.data?.hasLocalImage) refs.add(`${p.user_id}/${n.data.imageKey ?? n.id}`)
      }
      for (const c of p.characters ?? []) {
        if (c.hasLocalImage) refs.add(`${p.user_id}/char-${c.id}`)
      }
    }
    if (data.length < 50) break
  }
  return { refs, count }
}

export async function sweepOrphanImages(supabase, { dryRun = false } = {}) {
  const { refs, count: projectCount } = await loadReferencedPaths(supabase)
  if (projectCount === 0) return { skipped: 'no projects' }

  const cutoff = Date.now() - GRACE_MS
  let total = 0
  const orphans = []
  for (const folder of await listAll(supabase, '')) {
    if (folder.id) continue
    for (const f of await listAll(supabase, folder.name)) {
      if (!f.id) continue
      total++
      const path = `${folder.name}/${f.name}`
      // 제품 이미지 목록은 브라우저 localStorage 에만 있어 서버에서 참조 여부를 알 수 없음
      if (f.name.startsWith('asset-') || refs.has(path)) continue
      if (!f.created_at || new Date(f.created_at).getTime() > cutoff) continue
      orphans.push({ path, size: f.metadata?.size ?? 0 })
    }
  }

  const bytes = orphans.reduce((s, o) => s + o.size, 0)
  if (orphans.length > total * MAX_ORPHAN_RATIO) {
    return { skipped: 'orphan ratio too high', total, orphans: orphans.length, bytes }
  }
  if (!dryRun) {
    for (let i = 0; i < orphans.length; i += 50) {
      const { error } = await supabase.storage.from(BUCKET).remove(orphans.slice(i, i + 50).map(o => o.path))
      if (error) throw error
    }
  }
  return { total, orphans: orphans.length, bytes, dryRun }
}

export function startOrphanSweep(supabase) {
  if (!supabase) return
  const run = () => sweepOrphanImages(supabase)
    .then(r => console.log('[storage-sweep]', JSON.stringify(r)))
    .catch(e => console.error('[storage-sweep] 실패 — 삭제 없이 중단:', e.message))
  setTimeout(run, 60 * 1000)
  setInterval(run, SWEEP_INTERVAL_MS)
}
