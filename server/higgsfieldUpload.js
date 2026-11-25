const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

// data URL(또는 순수 base64)을 바이트와 형식으로 나눈다. 형식은 data URL 에 적힌 것을 우선한다.
export function decodeImage(fileBase64, contentType) {
  const m = fileBase64.match(/^data:([^;,]+)[^,]*,/)
  return {
    buffer: Buffer.from(m ? fileBase64.slice(m[0].length) : fileBase64, 'base64'),
    contentType: m?.[1] || contentType || 'image/jpeg',
  }
}

// 이미지 바이트를 Higgsfield 에 올리고 media id 를 돌려준다 (media_confirm 은 호출자가 한다)
export async function uploadImage(callTool, buffer, contentType) {
  // Higgsfield 는 파일 확장자로 형식을 정해 업로드 주소에 서명한다 — 확장자가 실제 형식과 다르면 403 이 난다
  const result = await callTool('media_upload', {
    filename: `reference.${EXT[contentType] ?? 'jpg'}`, content_type: contentType,
  })
  if (result.isError) throw new Error(result.content?.[0]?.text || '업로드 주소 요청 실패')
  const { presignedUrl, id, signedType } = extractPresigned(result)
  if (!presignedUrl || !id) throw new Error('업로드 주소를 받지 못했습니다')

  const signedHeaders = new URL(presignedUrl).searchParams.get('X-Amz-SignedHeaders') || ''
  const headers = signedHeaders.includes('content-type') ? { 'Content-Type': signedType || contentType } : {}
  const res = await fetch(presignedUrl, { method: 'PUT', headers, body: buffer })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[higgsfield-upload] 업로드 거부:', res.status, body.slice(0, 500))
    throw new Error(`Higgsfield에 이미지를 올리지 못했습니다 (${res.status}). 잠시 후 다시 시도해주세요.`)
  }
  return id
}

function extractPresigned(result) {
  const upload = result.structuredContent?.uploads?.[0]
  if (upload?.upload_url && upload?.media_id) {
    return { presignedUrl: upload.upload_url, id: upload.media_id, signedType: upload.content_type }
  }
  for (const c of (result.content ?? [])) {
    if (c.type !== 'text') continue
    try {
      const obj = JSON.parse(c.text)
      const presignedUrl = obj.upload_url || obj.presigned_url || obj.url
      if (presignedUrl) return { presignedUrl, id: obj.id || obj.media_id, signedType: obj.content_type }
    } catch { /* JSON 이 아닌 안내 문구 */ }
  }
  return {}
}
