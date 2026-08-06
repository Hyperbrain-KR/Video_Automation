import { useState, useCallback } from 'react'
import { saveImage as saveImageDB, deleteImage as deleteImageDB, loadImage as loadImageDB } from '../lib/imageDB'

const lsKey = (uid) => `canvas-global-assets-${uid}`

function loadFromLS(uid) {
  try { return JSON.parse(localStorage.getItem(lsKey(uid)) ?? '[]') } catch { return [] }
}

function saveToLS(uid, list) {
  localStorage.setItem(lsKey(uid), JSON.stringify(list))
}

export function useAssets(user) {
  const uid = user?.id ?? null
  const [assets, setAssets] = useState(() => uid ? loadFromLS(uid) : [])

  const saveAsset = useCallback((name, dataUrl) => {
    const id = `${Date.now()}`
    saveImageDB(`asset-${id}`, dataUrl).catch(e => console.warn('제품 이미지 저장 실패:', e))
    setAssets(prev => {
      const next = [...prev, { id, name, hasLocalImage: true }]
      if (uid) saveToLS(uid, next)
      return next
    })
  }, [uid])

  const deleteAsset = useCallback((assetId) => {
    deleteImageDB(`asset-${assetId}`).catch(() => {})
    setAssets(prev => {
      const next = prev.filter(a => a.id !== assetId)
      if (uid) saveToLS(uid, next)
      return next
    })
  }, [uid])

  return { assets, saveAsset, deleteAsset }
}
