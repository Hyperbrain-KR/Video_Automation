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

// ── Higgsfield: 이미지 생성 ────────────────────────────────
app.post('/api/higgsfield/image', async (req, res) => {
  // TODO: Higgsfield API 연동
  res.status(501).json({ error: 'Higgsfield 이미지 생성 미구현 (추후 연동 예정)' })
})

// ── Higgsfield: 비디오 생성 ────────────────────────────────
app.post('/api/higgsfield/video', async (req, res) => {
  // TODO: Higgsfield API 연동
  res.status(501).json({ error: 'Higgsfield 비디오 생성 미구현 (추후 연동 예정)' })
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`\n🎨 Canvas 서버 시작: http://localhost:${PORT}`)
  console.log(`   Claude 모델: ${MODEL}`)
  console.log(`   API 키: ${process.env.ANTHROPIC_API_KEY ? '✓ 설정됨' : '✗ 미설정 (.env 파일 확인 필요)'}`)
})
