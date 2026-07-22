import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_PATH = path.join(__dirname, '.env')

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const anthropic = new Anthropic({ apiKey: globalThis.process?.env?.ANTHROPIC_API_KEY })
const MODEL = globalThis.process?.env?.CLAUDE_MODEL || 'claude-sonnet-4-6'

// ── Supabase (service role — RLS 우회) ───────────────────
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null

async function dbGetConfig(key) {
  if (!supabase) return null
  const { data } = await supabase.from('app_config').select('value').eq('key', key).single()
  return data?.value ?? null
}

async function dbSetConfig(key, value) {
  if (!supabase) return
  await supabase.from('app_config').upsert({ key, value, updated_at: new Date().toISOString() })
}

// ── Higgsfield OAuth ──────────────────────────────────────
const OAUTH_CLIENT_ID = 'HLFkiErFzYPuRQxm'
const OAUTH_REDIRECT = process.env.SERVER_URL
  ? `${process.env.SERVER_URL}/auth/callback`
  : 'http://localhost:3002/auth/callback'
let _oauthPending = {}

function updateEnvKey(key, value) {
  // 로컬 .env 파일 업데이트 (개발 환경)
  if (fs.existsSync(ENV_PATH)) {
    let content = fs.readFileSync(ENV_PATH, 'utf8')
    const re = new RegExp(`^${key}=.*$`, 'm')
    if (re.test(content)) content = content.replace(re, `${key}=${value}`)
    else content += `\n${key}=${value}`
    fs.writeFileSync(ENV_PATH, content)
  }
  process.env[key] = value
  // Supabase에도 저장 (프로덕션 재시작 대비)
  dbSetConfig(key, value).catch(e => console.warn('[config] Supabase 저장 실패:', e))
}

async function loadTokensFromSupabase() {
  if (!supabase) return
  const [apiKey, refreshToken] = await Promise.all([
    dbGetConfig('HIGGSFIELD_API_KEY'),
    dbGetConfig('HIGGSFIELD_REFRESH_TOKEN'),
  ])
  if (apiKey) process.env.HIGGSFIELD_API_KEY = apiKey
  if (refreshToken) process.env.HIGGSFIELD_REFRESH_TOKEN = refreshToken
  if (apiKey || refreshToken) console.log('[config] Supabase에서 Higgsfield 토큰 로드 완료')
}

async function refreshHiggsfieldToken() {
  const rt = process.env.HIGGSFIELD_REFRESH_TOKEN
  if (!rt) return false
  try {
    const r = await fetch('https://mcp.higgsfield.ai/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rt, client_id: OAUTH_CLIENT_ID }),
    })
    const t = await r.json()
    if (!t.access_token) return false
    updateEnvKey('HIGGSFIELD_API_KEY', t.access_token)
    if (t.refresh_token) updateEnvKey('HIGGSFIELD_REFRESH_TOKEN', t.refresh_token)
    console.log('[oauth] Higgsfield 토큰 자동 갱신 완료')
    return true
  } catch { return false }
}

app.get('/auth/higgsfield/start', (req, res) => {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const state = crypto.randomBytes(16).toString('hex')
  _oauthPending = { verifier, state }
  const url = `https://mcp.higgsfield.ai/oauth2/authorize?` + new URLSearchParams({
    response_type: 'code', client_id: OAUTH_CLIENT_ID, redirect_uri: OAUTH_REDIRECT,
    scope: 'openid email offline_access', state, code_challenge: challenge, code_challenge_method: 'S256',
  })
  res.redirect(url)
})

app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query
  if (state !== _oauthPending.state) return res.status(400).send('State mismatch')
  try {
    const r = await fetch('https://mcp.higgsfield.ai/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: OAUTH_REDIRECT,
        client_id: OAUTH_CLIENT_ID, code_verifier: _oauthPending.verifier,
      }),
    })
    const t = await r.json()
    if (!t.access_token) return res.status(400).send(`<pre>실패: ${JSON.stringify(t)}</pre>`)
    updateEnvKey('HIGGSFIELD_API_KEY', t.access_token)
    if (t.refresh_token) updateEnvKey('HIGGSFIELD_REFRESH_TOKEN', t.refresh_token)
    console.log('[oauth] Higgsfield 로그인 성공, 토큰 저장됨')
    res.send('<h2 style="font-family:sans-serif;color:green">✅ Higgsfield 로그인 완료! 이 탭을 닫으세요.</h2>')
  } catch (e) { res.status(500).send(e.message) }
})

// ── Health ────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', model: MODEL }))

// ── Claude 사용량 누적 ─────────────────────────────────────
const USAGE_PATH = path.join(__dirname, 'usage.json')

function readUsage() {
  try { return JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8')) } catch { return {} }
}

function writeUsage(data) {
  fs.writeFileSync(USAGE_PATH, JSON.stringify(data, null, 2))
}

function accumulateUsage(projectId, u) {
  const pid = projectId || '__default__'
  // claude-sonnet-4-6 pricing (USD per token)
  const INPUT_PRICE     = 3    / 1_000_000
  const OUTPUT_PRICE    = 15   / 1_000_000
  const CACHE_READ      = 0.30 / 1_000_000
  const CACHE_WRITE     = 3.75 / 1_000_000
  const inp  = u?.input_tokens              ?? 0
  const out  = u?.output_tokens             ?? 0
  const cr   = u?.cache_read_input_tokens   ?? 0
  const cw   = u?.cache_creation_input_tokens ?? 0
  const cost = inp * INPUT_PRICE + out * OUTPUT_PRICE + cr * CACHE_READ + cw * CACHE_WRITE

  const all = readUsage()
  const cur = all[pid] ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0 }
  all[pid] = {
    inputTokens:      cur.inputTokens      + inp,
    outputTokens:     cur.outputTokens     + out,
    cacheReadTokens:  cur.cacheReadTokens  + cr,
    cacheWriteTokens: cur.cacheWriteTokens + cw,
    cost:             parseFloat((cur.cost + cost).toFixed(6)),
  }
  writeUsage(all)
  return cost
}

// ── Claude: 프롬프트 생성 ──────────────────────────────────
app.post('/api/claude/generate', async (req, res) => {
  const { systemPrompt, userMessage, maxTokens = 1500, projectId } = req.body
  if (!systemPrompt || !userMessage) {
    return res.status(400).json({ error: 'systemPrompt와 userMessage가 필요합니다' })
  }
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      // system을 배열로 변경 + cache_control → 동일 시스템 프롬프트 반복 호출 시 캐시 히트
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    })
    const text = message.content[0]?.text ?? ''

    const u = message.usage
    const hit  = u?.cache_read_input_tokens   ?? 0
    const miss = u?.cache_creation_input_tokens ?? 0
    const callCost = accumulateUsage(projectId, u)
    console.log(
      `[claude] ${hit > 0 ? '✅ 캐시 히트' : '🔄 캐시 생성'} | ` +
      `입력 ${u?.input_tokens ?? '?'} tok | 캐시 읽기 ${hit} | 캐시 생성 ${miss} | ` +
      `비용 $${callCost.toFixed(5)} (프로젝트: ${projectId ?? 'none'})`
    )

    res.json({ text })
  } catch (err) {
    console.error('[claude] 오류:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Claude 사용량 조회 ─────────────────────────────────────
app.get('/api/usage/claude', (req, res) => {
  const { projectId } = req.query
  const all = readUsage()
  if (projectId) {
    const entry = all[projectId] ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0 }
    return res.json(entry)
  }
  res.json(all)
})

// ── Higgsfield MCP 헬퍼 ───────────────────────────────────
async function listHiggsfieldTools() {
  const res = await fetch('https://mcp.higgsfield.ai/mcp', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HIGGSFIELD_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: Date.now() }),
  })
  const text = await res.text()
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    try {
      const data = JSON.parse(line.slice(6))
      if (data.result) return data.result.tools ?? []
    } catch {}
  }
  return []
}

async function callHiggsfieldMCP(toolName, args, timeoutMs = 180_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res
  try {
    res = await fetch('https://mcp.higgsfield.ai/mcp', {
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
      signal: controller.signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Higgsfield MCP 타임아웃 (${timeoutMs / 1000}s): ${toolName}`)
    throw e
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 401) {
    const refreshed = await refreshHiggsfieldToken()
    if (refreshed) return callHiggsfieldMCP(toolName, args, timeoutMs)
    throw new Error('Higgsfield 인증 실패 — /auth/higgsfield/start 에서 재로그인 필요')
  }
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

function isHiggsfieldAuthError(msg) {
  const m = msg.toLowerCase()
  return m.includes('invalid or expired token')
    || m.includes('session has expired')
    || m.includes('no longer valid')
    || m.includes('re-authorize')
    || m.includes('unauthorized')
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

  const runImage = async () => callHiggsfieldMCP('generate_image', args)
  try {
    let result = await runImage()
    // 인증 오류 시 자동 갱신 후 재시도
    if (result.isError) {
      const msg = result.content?.[0]?.text || ''
      console.error('[higgsfield/image] isError:', msg)
      if (isHiggsfieldAuthError(msg)) {
        const refreshed = await refreshHiggsfieldToken()
        if (refreshed) result = await runImage()
        else return res.status(401).json({ error: 'Higgsfield 토큰 만료 — http://localhost:3002/auth/higgsfield/start 에서 재로그인' })
      } else {
        return res.status(500).json({ error: msg })
      }
    }
    if (result.isError) return res.status(500).json({ error: result.content?.[0]?.text || '생성 오류' })
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
    prompt: rawPrompt,
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
  if (!rawPrompt) return res.status(400).json({ error: 'prompt 필요' })
  const trimmed = rawPrompt.length > 2490 ? rawPrompt.slice(0, 2490) : rawPrompt
  if (rawPrompt.length > 2490) console.warn(`[higgsfield/video] prompt truncated ${rawPrompt.length} → 2490`)
  // dedup 방지: Higgsfield가 동일 프롬프트 재사용 시 실패 job을 반환하는 문제 우회
  const prompt = trimmed + ` [${Date.now()}]`

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
      sound,
      aspect_ratio: videoAspect,
      seed: Math.floor(Math.random() * 2_147_483_647),
      ...(medias.length > 0 ? { medias } : {}),
    },
  }

  console.log('[higgsfield/video] params:', JSON.stringify(args.params, null, 2))

  const t0 = Date.now()
  const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`

  try {
    console.log('[higgsfield/video] ① generate_video MCP 호출 중...')
    let result = await callHiggsfieldMCP('generate_video', args)
    console.log(`[higgsfield/video] ② MCP 응답 수신 (${ts()})`)
    let rawContent = result.content?.map(c => c.text).join(' ') ?? ''
    console.log('[higgsfield/video] content:', rawContent.slice(0, 300))

    // Higgsfield가 프리셋을 제안하는 경우 → 자동으로 declined_preset_id 붙여 재시도
    if (rawContent.includes('declined_preset_id')) {
      const m = rawContent.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      const presetId = m?.[0]
      console.log(`[higgsfield/video] 프리셋 감지 (${presetId}), 리터럴 생성으로 재시도...`)
      const retryArgs = {
        params: { ...args.params, declined_preset_id: presetId },
      }
      result = await callHiggsfieldMCP('generate_video', retryArgs)
      rawContent = result.content?.map(c => c.text).join(' ') ?? ''
      console.log('[higgsfield/video] 재시도 content:', rawContent.slice(0, 300))
    }

    if (result.isError || rawContent.toLowerCase().includes('something went wrong')) {
      console.error('[higgsfield/video] 에러 응답:', rawContent)
      if (isHiggsfieldAuthError(rawContent)) {
        const refreshed = await refreshHiggsfieldToken()
        if (refreshed) {
          result = await callHiggsfieldMCP('generate_video', args)
          rawContent = result.content?.map(c => c.text).join(' ') ?? ''
          if (result.isError) return res.status(500).json({ error: rawContent || 'generate_video 실패' })
        } else {
          return res.status(401).json({ error: 'Higgsfield 토큰 만료 — http://localhost:3002/auth/higgsfield/start 에서 재로그인' })
        }
      } else {
        return res.status(500).json({ error: rawContent || 'generate_video 실패' })
      }
    }
    const jobId = extractJobId(result)
    console.log(`[higgsfield/video] ③ jobId: ${jobId} (${ts()})`)
    if (!jobId) {
      console.error('[higgsfield/video] jobId 추출 실패, content:', rawContent)
      return res.status(500).json({ error: `jobId 추출 실패: ${rawContent.slice(0, 200)}` })
    }
    res.json({ jobId, content: result.content })
  } catch (err) {
    console.error(`[higgsfield/video] 실패 (${ts()}):`, err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Higgsfield: 사용 가능한 MCP 툴 목록 (디버그) ──────────
app.get('/api/higgsfield/tools', async (req, res) => {
  if (!process.env.HIGGSFIELD_API_KEY) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY 미설정' })
  try {
    const tools = await listHiggsfieldTools()
    res.json({ tools: tools.map(t => ({ name: t.name, description: t.description })) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Higgsfield: 크레딧 조회 ────────────────────────────────
app.get('/api/higgsfield/credits', async (req, res) => {
  if (!process.env.HIGGSFIELD_API_KEY) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY 미설정' })
  try {
    const tools = await listHiggsfieldTools()
    const toolNames = tools.map(t => t.name)
    console.log('[higgsfield/credits] 사용 가능한 툴:', toolNames)

    const result = await callHiggsfieldMCP('balance', {}, 10_000)
    const text = result.content?.[0]?.text ?? ''
    console.log('[higgsfield/credits] balance 응답:', text)
    const match = text.match(/[\d,]+(\.\d+)?/)
    const credits = match ? parseFloat(match[0].replace(/,/g, '')) : null
    res.json({ credits, raw: text })
  } catch (err) {
    console.error('[higgsfield/credits]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Higgsfield: 상태 조회 ──────────────────────────────────
app.get('/api/higgsfield/status/:jobId', async (req, res) => {
  if (!process.env.HIGGSFIELD_API_KEY) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY 미설정' })

  try {
    const result = await callHiggsfieldMCP('job_status', { jobId: req.params.jobId })
    const resultUrl = extractResultUrl(result)
    const statusText = result.content?.[0]?.text ?? '(no text)'
    const lower = statusText.toLowerCase()

    const isFailed =
      result.isError ||
      lower.includes('something went wrong') ||
      lower.includes('failed') ||
      lower.includes('error') ||
      lower.includes('— failed') ||
      lower.includes('status: failed')

    console.log(`[higgsfield/status] ${req.params.jobId.slice(0, 8)}… → ${resultUrl ? '✅ URL' : isFailed ? '❌ 실패' : '⏳ 대기'} | ${statusText.slice(0, 120)}`)

    if (isFailed && !resultUrl) {
      return res.json({ jobId: req.params.jobId, resultUrl: null, error: '힉스필드 서버 오류. 힉스필드 웹에서 확인해보세요.', content: result.content })
    }

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

  const t0 = Date.now()
  const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`

  try {
    let mediaId

    if (url) {
      console.log(`[upload-ref] ① media_import_url 호출 중... (url: ${url.slice(0, 60)})`)
      const importResult = await callHiggsfieldMCP('media_import_url', { url, type: 'image' })
      if (importResult.isError) throw new Error(importResult.content?.[0]?.text || 'URL 임포트 실패')
      mediaId = extractMediaId(importResult)
      console.log(`[upload-ref] ② mediaId 획득: ${mediaId} (${ts()})`)
    } else {
      console.log(`[upload-ref] ① media_upload presigned 요청 중... (${filename})`)
      const uploadResult = await callHiggsfieldMCP('media_upload', {
        filename: filename || 'reference.jpg',
        content_type: contentType || 'image/jpeg',
      })
      if (uploadResult.isError) throw new Error(uploadResult.content?.[0]?.text || 'presigned URL 요청 실패')
      const { presignedUrl, id } = extractPresigned(uploadResult)
      console.log(`[upload-ref] ② presignedUrl: ${presignedUrl?.slice(0, 60)} id: ${id} (${ts()})`)
      if (!presignedUrl || !id) throw new Error('presigned URL 획득 실패')

      const base64Data = fileBase64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      console.log(`[upload-ref] ③ S3 PUT 업로드 중... (${buffer.length} bytes)`)
      const putRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType || 'image/jpeg' },
        body: buffer,
      })
      console.log(`[upload-ref] ④ S3 PUT 완료: ${putRes.status} (${ts()})`)
      if (!putRes.ok) throw new Error(`S3 업로드 실패: ${putRes.status}`)
      mediaId = id
    }

    if (!mediaId) throw new Error('mediaId 획득 실패')

    console.log(`[upload-ref] ⑤ media_confirm 호출 중... (mediaId: ${mediaId})`)
    const confirmResult = await callHiggsfieldMCP('media_confirm', { type: 'image', media_id: mediaId })
    console.log(`[upload-ref] ⑥ confirm 완료 (${ts()}):`, confirmResult.content?.[0]?.text?.slice(0, 100))
    if (confirmResult.isError) {
      const errText = confirmResult.content?.map(c => c.text).join(' ') ?? 'confirm 실패'
      throw new Error(`media_confirm 실패: ${errText}`)
    }

    console.log(`[upload-ref] 완료 → mediaId: ${mediaId} (총 ${ts()})`)
    res.json({ mediaId })
  } catch (err) {
    console.error(`[upload-ref] 실패 (${ts()}):`, err.message)
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

loadTokensFromSupabase().finally(() => {
  app.listen(PORT, () => {
    console.log(`\n🎨 Canvas 서버 시작: http://localhost:${PORT}`)
    console.log(`   Claude 모델: ${MODEL}`)
    console.log(`   API 키: ${process.env.ANTHROPIC_API_KEY ? '✓ 설정됨' : '✗ 미설정 (.env 파일 확인 필요)'}`)
    console.log(`   Supabase: ${supabase ? '✓ 연결됨' : '✗ 미설정 (토큰 영속성 없음)'}`)
  })
})
