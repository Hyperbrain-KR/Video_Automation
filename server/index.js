import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'

// ── Health ────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', model: MODEL }))

// ── Claude: 프롬프트 생성 ──────────────────────────────────
app.post('/api/claude/generate', async (req, res) => {
  const { systemPrompt, userMessage, maxTokens = 1500 } = req.body
  if (!systemPrompt || !userMessage) {
    return res.status(400).json({ error: 'systemPrompt와 userMessage가 필요합니다' })
  }
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    const text = message.content[0]?.text ?? ''
    res.json({ text })
  } catch (err) {
    console.error('[claude] 오류:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Higgsfield MCP 헬퍼 ───────────────────────────────────
async function callHiggsfieldMCP(toolName, args) {
  const res = await fetch('https://mcp.higgsfield.ai/mcp', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HIGGSFIELD_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: args },
      id: Date.now(),
    }),
  })

  if (!res.ok) throw new Error(`Higgsfield MCP HTTP ${res.status}: ${toolName}`)

  const text = await res.text()
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    try {
      const data = JSON.parse(line.slice(6))
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error))
      if (data.result) return data.result
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e
    }
  }
  throw new Error('Higgsfield MCP 응답 파싱 실패')
}

function extractJobId(result) {
  for (const c of (result.content ?? [])) {
    if (c.type !== 'text') continue
    let parsed = false
    try {
      const obj = JSON.parse(c.text)
      parsed = true
      if (obj.job_id) return obj.job_id
      if (obj.id) return obj.id
    } catch {}
    // UUID 폴백은 JSON 파싱 실패 시에만 사용 (다른 필드 오매칭 방지)
    if (!parsed) {
      const m = c.text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      if (m) return m[0]
    }
  }
  return null
}

function extractResultUrl(result) {
  const contents = result.content ?? []
  console.log('[extractResultUrl] types:', contents.map(c => c.type))

  for (const c of contents) {
    if ((c.type === 'image' || c.type === 'video') && c.url) return c.url
    if (c.type === 'resource' && c.uri) return c.uri
    if (c.type === 'resource' && c.resource?.uri) return c.resource.uri

    if (c.type === 'text') {
      console.log('[extractResultUrl] text:', c.text?.slice(0, 500))
      // JSON 파싱: 가능한 모든 필드명 시도
      try {
        const obj = JSON.parse(c.text)
        const url =
          obj.output_url || obj.url || obj.media_url ||
          obj.video_url || obj.image_url || obj.result_url ||
          obj.asset_url || obj.file_url || obj.link || obj.output ||
          obj.result?.url || obj.result?.output_url || obj.result?.media_url ||
          obj.data?.url || obj.data?.output_url ||
          obj.outputs?.[0]?.url || obj.assets?.[0]?.url
        if (typeof url === 'string' && url.startsWith('http')) return url
      } catch {}
      // 정규식 폴백 1: 미디어 확장자 URL
      const m1 = c.text?.match(/https?:\/\/[^\s"'<>]+\.(mp4|webm|mov|jpg|jpeg|png|gif|webp)(?:[?#][^\s"'<>]*)?/i)
      if (m1) return m1[0]
      // 정규식 폴백 2: 알려진 CDN 도메인 URL (확장자 없어도)
      const m2 = c.text?.match(/https:\/\/(?:cdn\.|storage\.|s3\.|media\.|assets\.|files\.)[^\s"'<>]{15,}/i)
      if (m2) return m2[0]
    }
  }
  return null
}

// ── Higgsfield: 이미지 생성 ────────────────────────────────
app.post('/api/higgsfield/image', async (req, res) => {
  const { prompt, model = 'nano_banana_pro', quality, aspectRatio,
          referenceMediaIds = [], referenceJobIds = [] } = req.body
  if (!process.env.HIGGSFIELD_API_KEY) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY 미설정' })
  if (!prompt) return res.status(400).json({ error: 'prompt 필요' })

  const isGptImage = model === 'gpt_image_2'
  const supportsResolution = ['nano_banana_2', 'nano_banana_pro', 'nano_banana_2_shots', 'cinematic_studio_2_5', 'marketing_studio_image', 'ms_image', 'flux_2'].includes(model)
  const refRole = model === 'nano_banana_2_shots' ? 'image_references' : 'image'
  const useAspect = aspectRatio && aspectRatio !== 'auto'

  const medias = [
    ...referenceMediaIds.map(id => ({ value: id, role: refRole })),
    ...referenceJobIds.map(id => ({ value: id, role: refRole })),
  ]

  const args = {
    params: {
      model,
      prompt,
      ...(useAspect ? { aspect_ratio: aspectRatio } : {}),
      ...(isGptImage && quality ? { quality } : {}),
      ...(quality && supportsResolution ? { resolution: quality } : {}),
      ...(medias.length > 0 ? { medias } : {}),
    },
  }

  try {
    const result = await callHiggsfieldMCP('generate_image', args)
    if (result.isError) {
      const msg = result.content?.[0]?.text || '생성 오류'
      console.error('[higgsfield/image] isError:', msg)
      return res.status(500).json({ error: msg })
    }
    const jobId = extractJobId(result)
    console.log('[higgsfield/image] jobId:', jobId)
    res.json({ jobId, content: result.content })
  } catch (err) {
    console.error('[higgsfield/image]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Higgsfield: 비디오 생성 ────────────────────────────────
app.post('/api/higgsfield/video', async (req, res) => {
  const {
    prompt,
    duration = '5',
    videoMode = 'std',
    sound = 'on',
    videoAspect = '16:9',
    firstFrameJobId,
    firstFrameMediaId,
    endFrameJobId,
    endFrameMediaId,
  } = req.body
  if (!process.env.HIGGSFIELD_API_KEY) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY 미설정' })
  if (!prompt) return res.status(400).json({ error: 'prompt 필요' })

  // medias 배열 구성
  const medias = []
  if (firstFrameMediaId) medias.push({ value: firstFrameMediaId, role: 'start_image' })
  else if (firstFrameJobId) medias.push({ value: firstFrameJobId, role: 'start_image' })
  if (endFrameMediaId) medias.push({ value: endFrameMediaId, role: 'end_image' })
  else if (endFrameJobId) medias.push({ value: endFrameJobId, role: 'end_image' })

  const args = {
    params: {
      model: 'kling3_0',
      prompt,
      duration: Number(duration),
      mode: videoMode,
      sound: sound === 'on',
      aspect_ratio: videoAspect,
      ...(medias.length > 0 ? { medias } : {}),
    },
  }

  console.log('[higgsfield/video] params:', JSON.stringify(args.params, null, 2))

  try {
    const result = await callHiggsfieldMCP('generate_video', args)
    if (result.isError) {
      const errText = result.content?.map(c => c.text).join(' ') ?? 'unknown error'
      console.error('[higgsfield/video] MCP error:', errText)
      return res.status(500).json({ error: errText })
    }
    const jobId = extractJobId(result)
    console.log('[higgsfield/video] jobId:', jobId)
    res.json({ jobId, content: result.content })
  } catch (err) {
    console.error('[higgsfield/video]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Higgsfield: 상태 조회 ──────────────────────────────────
app.get('/api/higgsfield/status/:jobId', async (req, res) => {
  if (!process.env.HIGGSFIELD_API_KEY) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY 미설정' })

  try {
    const result = await callHiggsfieldMCP('job_status', {
      jobId: req.params.jobId,
      sync: true,
    })
    const resultUrl = extractResultUrl(result)
    res.json({ jobId: req.params.jobId, resultUrl, content: result.content })
  } catch (err) {
    console.error('[higgsfield/status]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Higgsfield: 레퍼런스 이미지 업로드/임포트 ──────────────
app.post('/api/higgsfield/upload-reference', async (req, res) => {
  const { url, fileBase64, filename, contentType } = req.body
  if (!process.env.HIGGSFIELD_API_KEY) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY 미설정' })
  if (!url && !fileBase64) return res.status(400).json({ error: 'url 또는 fileBase64 필요' })

  try {
    let mediaId

    if (url) {
      // URL 임포트
      const importResult = await callHiggsfieldMCP('media_import_url', { url, type: 'image' })
      if (importResult.isError) throw new Error(importResult.content?.[0]?.text || 'URL 임포트 실패')
      mediaId = extractMediaId(importResult)
      console.log('[upload-ref] import mediaId:', mediaId)
    } else {
      // presigned URL 업로드
      const uploadResult = await callHiggsfieldMCP('media_upload', {
        filename: filename || 'reference.jpg',
        content_type: contentType || 'image/jpeg',
      })
      if (uploadResult.isError) throw new Error(uploadResult.content?.[0]?.text || 'presigned URL 요청 실패')
      const { presignedUrl, id } = extractPresigned(uploadResult)
      console.log('[upload-ref] presignedUrl:', presignedUrl?.slice(0, 80), 'id:', id)
      if (!presignedUrl || !id) throw new Error('presigned URL 획득 실패')

      // base64 → Buffer → PUT 업로드
      const base64Data = fileBase64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const putRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType || 'image/jpeg' },
        body: buffer,
      })
      console.log('[upload-ref] PUT status:', putRes.status)
      if (!putRes.ok) throw new Error(`S3 업로드 실패: ${putRes.status}`)
      mediaId = id
    }

    if (!mediaId) throw new Error('mediaId 획득 실패')

    // confirm
    const confirmResult = await callHiggsfieldMCP('media_confirm', { type: 'image', media_id: mediaId })
    console.log('[upload-ref] confirm:', confirmResult.content?.[0]?.text?.slice(0, 200))
    if (confirmResult.isError) {
      const errText = confirmResult.content?.map(c => c.text).join(' ') ?? 'confirm 실패'
      throw new Error(`media_confirm 실패: ${errText}`)
    }

    res.json({ mediaId })
  } catch (err) {
    console.error('[upload-ref]', err.message)
    res.status(500).json({ error: err.message })
  }
})

function extractMediaId(result) {
  for (const c of (result.content ?? [])) {
    if (c.type !== 'text') continue
    let parsed = false
    try {
      const obj = JSON.parse(c.text)
      parsed = true
      if (obj.id) return obj.id
      if (obj.media_id) return obj.media_id
    } catch {}
    if (!parsed) {
      const m = c.text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      if (m) return m[0]
    }
  }
  return null
}

function extractPresigned(result) {
  // structuredContent.uploads[0] 우선
  const upload = result.structuredContent?.uploads?.[0]
  if (upload?.upload_url && upload?.media_id) {
    return { presignedUrl: upload.upload_url, id: upload.media_id }
  }
  // fallback: text 파싱
  for (const c of (result.content ?? [])) {
    if (c.type === 'text') {
      try {
        const obj = JSON.parse(c.text)
        const presignedUrl = obj.upload_url || obj.presigned_url || obj.url
        const id = obj.id || obj.media_id
        if (presignedUrl) return { presignedUrl, id }
      } catch {}
    }
  }
  return {}
}

// ── 다운로드 프록시 ───────────────────────────────────────
app.get('/api/download', async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url 필요' })
  try {
    const upstream = await fetch(url)
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const filename = url.split('/').pop().split('?')[0] || 'download'
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', contentType)
    const { Readable } = await import('stream')
    Readable.fromWeb(upstream.body).pipe(res)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`\n🎨 Canvas 서버 시작: http://localhost:${PORT}`)
  console.log(`   Claude 모델: ${MODEL}`)
  console.log(`   API 키: ${process.env.ANTHROPIC_API_KEY ? '✓ 설정됨' : '✗ 미설정 (.env 파일 확인 필요)'}`)
})
