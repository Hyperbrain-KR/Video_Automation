const DB_NAME = 'canvas-images'
const STORE   = 'node-images'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

export async function saveImage(key, dataUrl) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(dataUrl, key)
    tx.oncomplete = resolve
    tx.onerror    = e => reject(e.target.error)
  })
}

export async function loadImage(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = e => resolve(e.target.result ?? null)
    req.onerror   = e => reject(e.target.error)
  })
}

export async function deleteImage(key) {
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
        .forEach(k => store.delete(k))
    }
    tx.oncomplete = resolve
    tx.onerror    = e => reject(e.target.error)
  })
}
