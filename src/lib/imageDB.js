import { supabase } from './supabase'

const BUCKET = 'canvas-images'
const memCache = new Map()

async function getUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',')
  const mime = meta.split(':')[1].split(';')[0]
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function saveImage(key, dataUrl) {
  memCache.set(key, dataUrl)
  const userId = await getUserId()
  if (!userId) return
  const blob = dataUrlToBlob(dataUrl)
  await supabase.storage.from(BUCKET).upload(`${userId}/${key}`, blob, {
    upsert: true, contentType: blob.type,
  })
}

export async function loadImage(key) {
  if (memCache.has(key)) return memCache.get(key)
  const userId = await getUserId()
  if (!userId) return null
  const { data, error } = await supabase.storage.from(BUCKET).download(`${userId}/${key}`)
  if (error || !data) return null
  const dataUrl = await blobToDataUrl(data)
  memCache.set(key, dataUrl)
  return dataUrl
}

export async function loadImageByNodeId(nodeId) {
  for (const [k, v] of memCache) {
    if (k === nodeId || k.endsWith(`-${nodeId}`)) return v
  }
  return loadImage(nodeId)
}

export async function deleteImage(key) {
  memCache.delete(key)
  const userId = await getUserId()
  if (!userId) return
  await supabase.storage.from(BUCKET).remove([`${userId}/${key}`])
}

export async function deleteProjectImages(projectId) {
  const userId = await getUserId()
  if (!userId) return
  const { data } = await supabase.storage.from(BUCKET).list(userId, { search: projectId })
  if (!data?.length) return
  const paths = data
    .filter(f => f.name.startsWith(`${projectId}-`) || f.name.startsWith(`char-`))
    .map(f => `${userId}/${f.name}`)
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths)
  for (const [k] of memCache) {
    if (k.startsWith(`${projectId}-`)) memCache.delete(k)
  }
}
