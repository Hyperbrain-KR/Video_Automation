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
    try {
      const obj = JSON.parse(c.text)
      if (obj.job_id) return obj.job_id
      if (obj.id) return obj.id
    } catch {}
    const m = c.text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    if (m) return m[0]
  }
  return null
}

function extractResultUrl(result) {
  const contents = result.content ?? []
  console.log('[extractResultUrl] content types:', contents.map(c => c.type))

  for (const c of contents) {
    // image/video 타입 직접 URL
    if ((c.type === 'image' || c.type === 'video') && c.url) return c.url
    // resource 타입 (URI)
    if (c.type === 'resource' && c.uri) return c.uri
    if (c.type === 'resource' && c.resource?.uri) return c.resource.uri

    if (c.type === 'text') {
      console.log('[extractResultUrl] text preview:', c.text?.slice(0, 300))
      // JSON 파싱 시도
      try {
        const obj = JSON.parse(c.text)
        const url = obj.output_url || obj.url || obj.media_url
          || obj.video_url || obj.image_url
          || obj.outputs?.[0]?.url || obj.result?.url
        if (url) return url
      } catch {}
      // 정규식 폴백: https URL에 미디어 확장자
      const m = c.text?.match(/https?:\/\/[^\s"'<>]+\.(mp4|webm|mov|jpg|jpeg|png|gif|webp)/i)
      if (m) return m[0]
    }
  }
  return null
}

// ── Higgsfield: 이미지 생성 ────────────────────────────────
app.post('/api/higgsfield/image', async (req, res) => {
  const { prompt, model = 'nano_banana_2_shots', quality, aspectRatio, referenceJobId } = req.body
  if (!process.env.HIGGSFIELD_API_KEY) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY 미설정' })
  if (!prompt) return res.status(400).json({ error: 'prompt 필요' })

  // nano_banana_2_lite는 quality 파라미터 사용, 나머지 주요 모델은 resolution 사용
  const noResolution = ['nano_banana_2_lite', 'nano_banana', 'soul_2', 'soul_cinematic', 'seedream_v5_lite'].includes(model)
  const supportsResolution = !noResolution

  const args = {
    params: {
      model,
      prompt,
      ...(aspectRatio && aspectRatio !== 'auto' ? { aspect_ratio: aspectRatio } : {}),
      ...(quality && supportsResolution ? { resolution: quality } : {}),
      ...(referenceJobId ? { medias: [{ value: referenceJobId, role: model === 'nano_banana_2_shots' ? 'image_references' : 'reference' }] } : {}),
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
  const { prompt, model = 'cinematic_studio_3_0', firstFrameJobId } = req.body
  if (!process.env.HIGGSFIELD_API_KEY) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY 미설정' })
  if (!prompt) return res.status(400).json({ error: 'prompt 필요' })

  const args = {
    params: {
      model,
      prompt,
      ...(firstFrameJobId ? { medias: [{ value: firstFrameJobId, role: 'first_frame' }] } : {}),
    },
  }

  try {
    const result = await callHiggsfieldMCP('generate_video', args)
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
