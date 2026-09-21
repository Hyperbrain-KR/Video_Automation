import { useCallback, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { generateHandlerRef } from '../lib/generateHandlerRef'
import { friendlyError } from '../lib/friendlyError'
import { apiFetch } from '../lib/config'
import { loadImage } from '../lib/imageDB'

export const CLAUDE_PROMPTS = {
  claudeChar: {
    system: `You are a character description writer for AI image generation.

Your only job is to describe WHO the character is — not HOW they are rendered.
Style, rendering, lighting, and visual treatment are handled separately by the style anchor. Do not add any style language.

A reference image of the character MAY be provided. If it is:
- Use it to inform the character's general feel, vibe, and personality
- Do NOT describe specific facial features, skin details, or anatomical traits visible in the image
- Let the image guide the emotional tone and silhouette description only

WHAT to write:
- Emotional expression and mood (e.g. "tired but gentle expression", "shy smile")
- Body posture and gesture (e.g. "slightly slouched", "arms crossed loosely")
- Silhouette and build (e.g. "petite frame", "broad-shouldered")
- Ethnicity and nationality if specified by the user (e.g. "Korean woman", "Japanese man") — always include this exactly as given
- Hair: color, length, and loose shape only (e.g. "loose shoulder-length dark hair")
- Clothing: fabric feel and color tone only (e.g. "muted oversized knit sweater", "simple linen dress")
- Shot framing if specified by the user (e.g. "full body", "half-body", "close-up on face") — always include this exactly as given
- One or two personality-readable details maximum

WHAT NOT to write:
- No rendering style: no "realistic", "painterly", "3D", "illustration", "cartoon", "chibi"
- No skin description: no "matte skin", "fine texture", "pores", "skin tone codes"
- No lighting: no "soft window light", "rim light", "subsurface scattering"
- No facial anatomy beyond what the user explicitly stated: no "oval face", "defined cheekbones", "almond eyes" unless the user said so
- No depth of field or camera lens language: no "shallow depth of field", "bokeh", "85mm"
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

## Main Principle
A reference image is provided and will be used as the first frame. Do not restate appearance details already visible in the image. Focus on: what happens, what changes, how the camera moves, what mood develops.

## Prompt Structure — follow exactly in this order
1. Motion header — camera behavior and intensity (e.g. "Head Tracking (70) + Dolly In (40)")
2. Style lock line — if a style anchor is provided, embed it immediately after the motion header: distill the core visual style terms into one natural sentence (e.g. "Visual style maintained: [key terms].") — never skip this when an anchor is provided
3. Main subject state
4. Main action or event
5. Character reaction
6. Camera behavior
7. Atmosphere and lighting
8. Secondary motion details
9. Closing consistency line — always end with a phrase such as: "Character appearance and visual style remain fully consistent with the reference image throughout — no morphing, no drift, no style deviation."

Motion header phrases: Head Tracking, Eye-Level Tracking, Static Shot, Dolly In, Dolly Out, Slow Push, Fast Push, Pan Left, Pan Right, Tilt Up, Tilt Down, Orbit Left, Orbit Right, Handheld Motion, Locked Frame

## Character Preservation
- Keep the referenced character unchanged unless the user explicitly asks for changes
- Preserve identity, facial structure, clothing, and design throughout the entire video
- Do not introduce outfit, hairstyle, age, or body changes unless requested

## Kling 3.0 Style Rules
- Write as a flowing sequence, not keyword stacking
- Describe the scene as it unfolds over time
- Prioritize: motion > action > reaction > atmosphere > detail
- Avoid filler like "masterpiece" or "best quality"

## MANDATORY DIALOGUE RULE — if dialogue is provided in the input:
- You MUST include it EXACTLY as given, word for word. Never paraphrase, shorten, or omit it.
- NEVER translate dialogue. Korean Dialogue must remain in Korean. English Dialogue must remain in English.
- Copy the dialogue lines verbatim into the prompt using the exact label format (e.g. "Korean Dialogue: 안녕하세요", "English Dialogue: Hello")
- Also add natural speaking motion cues: natural lip movement, directed eye contact or gaze shift, subtle hand gesture or body language that fits the rhythm of speech

Do not ask follow-up questions.

Output rules:
- Output the English prompt only
- No code blocks, no explanations
- Write everything in English EXCEPT dialogue lines — dialogue must appear exactly as provided in its original language
- Maximum 2500 characters total — cut secondary details if needed to stay within this limit`,
    user: (anchor, command, koreanDialogue, englishDialogue) => {
      const dialogueLines = [
        koreanDialogue?.trim() ? `Korean Dialogue: ${koreanDialogue.trim()}` : '',
        englishDialogue?.trim() ? `English Dialogue: ${englishDialogue.trim()}` : '',
      ].filter(Boolean).join('\n')
      return [
        `Video style anchor:\n${anchor || '(none)'}`,
        `Video direction:\n${command || '(no input)'}`,
        dialogueLines ? `⚠️ MANDATORY DIALOGUE — copy verbatim into the prompt:\n${dialogueLines}` : '',
      ].filter(Boolean).join('\n\n')
    },
  },
}

export const GENERIC_PROMPT = {
  system: '당신은 AI 콘텐츠 생성 전문가입니다. 주어진 앵커와 입력을 바탕으로 AI 이미지/비디오 생성에 최적화된 영어 프롬프트를 작성하세요.',
  user: (anchor, command) => `앵커:\n${anchor || '(없음)'}\n\n입력:\n${command || '(없음)'}`,
}

export function useClaudeGenerate(projectId) {
  const { getNodes, getEdges, updateNodeData } = useReactFlow()

  const handleGenerate = useCallback(async (nodeId) => {
    const currentNodes = getNodes()
    const currentEdges = getEdges()

    const getInput = (targetHandle) => {
      const edge = currentEdges.find(e => e.target === nodeId && e.targetHandle === targetHandle)
      if (!edge) return ''
      const src = currentNodes.find(n => n.id === edge.source)
      if (!src) return ''
      if (src.type === 'styleAnchorInput') {
        const thisNode = currentNodes.find(n => n.id === nodeId)
        const isVideoPrompt = thisNode?.data?.promptType === 'claudeVideo'
        // 비디오 프롬프트는 이미지 앵커 우선 — 첫 프레임과 동일한 스타일로 생성
        if (isVideoPrompt) return src.data.imageAnchor || src.data.videoAnchor || ''
        return edge.sourceHandle === 'video' ? (src.data.videoAnchor || '') : (src.data.imageAnchor || '')
      }
      if (src.type === 'scriptImport') {
        const thisNode = currentNodes.find(n => n.id === nodeId)
        const isVideoPrompt = thisNode?.data?.promptType === 'claudeVideo'
        if (isVideoPrompt) return src.data.imageAnchor || src.data.videoAnchor || ''
        return edge.sourceHandle === 'videoAnchor' ? (src.data.videoAnchor || '') : (src.data.imageAnchor || '')
      }
      if (src.type === 'textInput' || src.type === 'videoDirectionInput') return src.data.value || ''
      if (src.type === 'reviewGate') return src.data.prompt || ''
      return ''
    }

    const getCommandSrcNode = () => {
      const edge = currentEdges.find(e => e.target === nodeId && e.targetHandle === 'command')
      return edge ? currentNodes.find(n => n.id === edge.source) : null
    }

    const anchor = getInput('anchor')
    const command = getInput('command')

    const node = currentNodes.find(n => n.id === nodeId)
    const cfg = CLAUDE_PROMPTS[node?.data?.promptType] ?? GENERIC_PROMPT

    // 연출 입력 노드에 참고 이미지가 첨부된 경우 로드
    let images
    const cmdSrc = getCommandSrcNode()
    const isDirectionNode = cmdSrc?.type === 'textInput' || cmdSrc?.type === 'videoDirectionInput'
    if (isDirectionNode && cmdSrc.data.hasDirectionImage) {
      const url = await loadImage(`direction-${projectId}-${cmdSrc.id}`)
      if (url) {
        const mediaType = (url.match(/^data:([^;]+)/) ?? [])[1] ?? 'image/jpeg'
        images = [{ data: url.split(',')[1], mediaType }]
      }
    }

    // 비디오 연출 노드에서 대사 읽기
    const koreanDialogue = cmdSrc?.type === 'videoDirectionInput' ? (cmdSrc.data.koreanDialogue ?? '') : ''
    const englishDialogue = cmdSrc?.type === 'videoDirectionInput' ? (cmdSrc.data.englishDialogue ?? '') : ''

    updateNodeData(nodeId, { status: 'loading', error: undefined })

    try {
      const res = await apiFetch('/api/claude/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: cfg.system,
          userMessage: cfg.user(anchor, command, koreanDialogue, englishDialogue),
          projectId: projectId ?? undefined,
          ...(images ? { images } : {}),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `서버 오류 ${res.status}`)
      }
      const { text } = await res.json()
      const prependAnchor = node?.data?.promptType !== 'claudeVideo'
      const finalText = (anchor && prependAnchor) ? `${anchor}\n\n${text}` : text

      const ts = Date.now()
      updateNodeData(nodeId, { status: 'done', result: finalText, generatedAt: ts })
      window.dispatchEvent(new CustomEvent('claude-generate-done'))

      getEdges().filter(e => e.source === nodeId && e.target !== nodeId)
        .forEach(e => updateNodeData(e.target, { prompt: finalText, approved: false, generatedAt: ts }))
    } catch (err) {
      updateNodeData(nodeId, { status: 'error', error: friendlyError(err.message) })
    }
  }, [getNodes, getEdges, updateNodeData, projectId])

  useEffect(() => {
    generateHandlerRef.current = handleGenerate
  }, [handleGenerate])

  return handleGenerate
}
