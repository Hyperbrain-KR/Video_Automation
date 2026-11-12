// 긴 변을 maxSide 이하로 줄여 WebP로 재인코딩. 디코딩 실패·WebP 미지원·용량 증가 시 원본을 그대로 반환.
export async function compressImage(dataUrl, { maxSide = 1568, quality = 0.85 } = {}) {
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = dataUrl
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const out = canvas.toDataURL('image/webp', quality)
    if (!out.startsWith('data:image/webp') || out.length >= dataUrl.length) return dataUrl
    return out
  } catch {
    return dataUrl
  }
}
