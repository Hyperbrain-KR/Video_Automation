import { useCallback, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { generateHandlerRef } from '../lib/generateHandlerRef'
import { friendlyError } from '../lib/friendlyError'
import { CANVAS_API } from '../lib/config'

export const CLAUDE_PROMPTS = {
  claudeChar: {
    system: `You are a character description writer for AI image generation.

Your only job is to describe WHO the character is — not HOW they are rendered.
Style, rendering, lighting, and visual treatment are handled separately by the style anchor. Do not add any style language.

WHAT to write:
- Emotional expression and mood (e.g. "tired but gentle expression", "shy smile")
- Body posture and gesture (e.g. "slightly slouched", "arms crossed loosely")
- Silhouette and build (e.g. "petite frame", "broad-shouldered")
- Hair: color, length, and loose shape only (e.g. "loose shoulder-length dark hair")
- Clothing: fabric feel and color tone only (e.g. "muted oversized knit sweater", "simple linen dress")
- One or two personality-readable details maximum

WHAT NOT to write:
- No rendering style: no "realistic", "painterly", "3D", "illustration", "cartoon", "chibi"
- No skin description: no "matte skin", "fine texture", "pores", "skin tone codes"
- No lighting: no "soft window light", "rim light", "subsurface scattering"
- No facial anatomy: no "oval face", "defined cheekbones", "almond eyes"
- No camera or composition: no "three-quarter portrait", "close-up", "depth of field"
- No quality filler: no "masterpiece", "best quality", "highly detailed"

The style anchor prepended above this prompt already defines the visual style. Your output must not conflict with it.

Output rules:
- One short paragraph, plain English
- No code blocks, no Korean, no explanations`,
    user: (anchor, command) => `Style anchor (already defines visual style — do not repeat or contradict):\n${anchor || '(none)'}\n\nCharacter direction:\n${command || '(no input)'}`,
  },
  claudeImage: {
    system: `You are a scene description writer for AI image generation.

The style anchor prepended to this prompt already defines the complete visual style. Do not introduce any new style language.

A reference character image MAY or MAY NOT be provided to the AI model. Read the scene direction carefully:

IF the scene includes a character:
- Do not re-describe the character's appearance (it is covered by the reference image)
- Use phrasing like "keeping the referenced character unchanged", "with the attached character"
- Focus on: what the character is doing, where they are, the mood of the scene

IF the scene has no character (object, environment, abstract, etc.):
- Describe the subject or scene fully: what it is, its key visual qualities, its placement
- Describe mood, atmosphere, composition, and framing
- Do not reference any character or person

In both cases, write only:
- Subject or action (what is in the scene)
- Mood and atmosphere
- Composition and framing

Do NOT write:
- Rendering or art style (already in the anchor)
- Skin texture, lighting model, or material descriptions
- Quality filler like "masterpiece", "best quality"

Do not ask follow-up questions.

Output rules:
- Output the English prompt only
- No code blocks, no Korean, no explanations`,
    user: (anchor, command) => `Image style anchor:\n${anchor || '(none)'}\n\nScene direction:\n${command || '(no input)'}`,
  },
  claudeVideo: {
    system: `You are a video prompt generator for Kling 3.0 via higgsfield.ai.

Your job is to convert the user's video direction into a strong English video-generation prompt. A reference image (first frame) will be provided to the AI model.

Follow the Main Principle:
- If the reference image is provided and will be used during generation, do not redundantly restate visible appearance details that are already clearly shown in the image
- Use the prompt mainly to describe: what happens, what changes, what moves, how the camera behaves, what mood develops

Always write the prompt in this order:
1. Motion header — camera behavior and movement intensity (e.g. "Head Tracking (70) + Dolly In (40)")
2. Main subject state
3. Main action or event
4. Character reaction
5. Camera behavior
6. Atmosphere and lighting
7. Secondary motion details
8. Final visual quality or style note

Motion header phrases: Head Tracking, Eye-Level Tracking, Static Shot, Dolly In, Dolly Out, Slow Push, Fast Push, Pan Left, Pan Right, Tilt Up, Tilt Down, Orbit Left, Orbit Right, Handheld Motion, Locked Frame

Kling 3.0 Style Rules:
- Write as a flowing sequence, not keyword stacking
- Describe the scene as it unfolds over time
- Prioritize: motion > action > reaction > atmosphere > detail
- Avoid filler like "masterpiece" or "best quality"
- Use phrasing like "keeping the referenced character unchanged", "based on the attached reference frame"

Do not ask follow-up questions.

Output rules:
- Output the English prompt only
- No code blocks, no Korean translation, no explanations
- Maximum 2500 characters total — cut secondary details if needed to stay within this limit`,
    user: (anchor, command) => `Video style anchor:\n${anchor || '(none)'}\n\nVideo direction:\n${command || '(no input)'}`,
  },
}

export const GENERIC_PROMPT = {
  system: '당신은 AI 콘텐츠 생성 전문가입니다. 주어진 앵커와 입력을 바탕으로 AI 이미지/비디오 생성에 최적화된 영어 프롬프트를 작성하세요.',
  user: (anchor, command) => `앵커:\n${anchor || '(없음)'}\n\n입력:\n${command || '(없음)'}`,
}

export function useClaudeGenerate() {
  const { getNodes, getEdges, updateNodeData } = useReactFlow()

  const handleGenerate = useCallback(async (nodeId) => {
    const currentNodes = getNodes()
    const currentEdges = getEdges()

    const getInput = (targetHandle) => {
      const edge = currentEdges.find(e => e.target === nodeId && e.targetHandle === targetHandle)
      if (!edge) return ''
      const src = currentNodes.find(n => n.id === edge.source)
      if (!src) return ''
      if (src.type === 'styleAnchorInput')
        return edge.sourceHandle === 'video' ? (src.data.videoAnchor || '') : (src.data.imageAnchor || '')
      if (src.type === 'scriptImport')
        return edge.sourceHandle === 'videoAnchor' ? (src.data.videoAnchor || '') : (src.data.imageAnchor || '')
      if (src.type === 'textInput') return src.data.value || ''
      if (src.type === 'reviewGate') return src.data.prompt || ''
      return ''
    }

    const anchor = getInput('anchor')
    const command = getInput('command')

    const node = currentNodes.find(n => n.id === nodeId)
    const cfg = CLAUDE_PROMPTS[node?.data?.promptType] ?? GENERIC_PROMPT

    updateNodeData(nodeId, { status: 'loading', error: undefined })

    try {
      const res = await fetch(`${CANVAS_API}/api/claude/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: cfg.system,
          userMessage: cfg.user(anchor, command),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `서버 오류 ${res.status}`)
      }
      const { text } = await res.json()
      const prependAnchor = node?.data?.promptType !== 'claudeVideo'
      const finalText = (anchor && prependAnchor) ? `${anchor}\n\n${text}` : text

      updateNodeData(nodeId, { status: 'done', result: finalText })

      getEdges().filter(e => e.source === nodeId && e.target !== nodeId)
        .forEach(e => updateNodeData(e.target, { prompt: finalText, approved: false }))
    } catch (err) {
      updateNodeData(nodeId, { status: 'error', error: friendlyError(err.message) })
    }
  }, [getNodes, getEdges, updateNodeData])

  useEffect(() => {
    generateHandlerRef.current = handleGenerate
  }, [handleGenerate])

  return handleGenerate
}
