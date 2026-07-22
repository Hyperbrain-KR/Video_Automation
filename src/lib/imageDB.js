const DB_NAME = 'canvas-images'
const STORE   = 'node-images'

// 같은 세션에서는 IndexedDB 왕복 없이 메모리에서 즉시 반환
const memCache = new Map()

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

export async function saveImage(key, dataUrl) {
  memCache.set(key, dataUrl)
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(dataUrl, key)
    tx.oncomplete = resolve
    tx.onerror    = e => reject(e.target.error)
  })
}

export async function loadImage(key) {
  if (memCache.has(key)) return memCache.get(key)
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = e => resolve(e.target.result ?? null)
    req.onerror   = e => reject(e.target.error)
  })
}

// nodeId만으로 모든 가능한 key 포맷을 시도하여 이미지 로드
export async function loadImageByNodeId(nodeId) {
  // 메모리 캐시에서 nodeId를 포함하는 항목 탐색 (가장 빠름)
  for (const [k, v] of memCache) {
    if (k === nodeId || k.endsWith(`-${nodeId}`)) return v
  }
  const db = await openDB()
  const loadKey = async (key) => new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = e => resolve(e.target.result ?? null)
    req.onerror   = e => reject(e.target.error)
  })
  // nodeId 단독 키 (현재 포맷)
  let result = await loadKey(nodeId)
  if (result) return result
  // 레거시: "default-nodeId" 포맷
  result = await loadKey(`default-${nodeId}`)
  if (result) return result
  // 레거시: IndexedDB의 모든 키 중 nodeId로 끝나는 항목 검색
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAllKeys()
    req.onsuccess = async e => {
      const match = e.target.result.find(k => k === nodeId || k.endsWith(`-${nodeId}`))
      if (!match) { resolve(null); return }
      const req2 = db.transaction(STORE, 'readonly').objectStore(STORE).get(match)
      req2.onsuccess = e2 => resolve(e2.target.result ?? null)
      req2.onerror   = e2 => reject(e2.target.error)
    }
    req.onerror = e => reject(e.target.error)
  })
}

export async function deleteImage(key) {
  memCache.delete(key)
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = resolve
    tx.onerror    = e => reject(e.target.error)
  })
}

export async function deleteProjectImages(projectId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req   = store.getAllKeys()
    req.onsuccess = e => {
      e.target.result
        .filter(k => k.startsWith(`${projectId}-`))
        .forEach(k => { store.delete(k); memCache.delete(k) })
    }
    tx.oncomplete = resolve
    tx.onerror    = e => reject(e.target.error)
  })
}
