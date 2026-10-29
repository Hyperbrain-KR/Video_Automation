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

## @Element Reference Rules — MANDATORY
- If the direction contains @mention references (e.g. @10@4_pixel_mm, @character_name), these are Higgsfield element IDs that MUST appear verbatim in the output
- Wherever you would normally write "the character", "a person", "the subject", or any generic noun referring to that entity, use the exact @mention token instead (e.g. "@10@4_pixel_mm")
- If multiple @mentions appear, preserve each one exactly as written
- Never drop, rename, paraphrase, or translate @mention tokens — they are technical identifiers, not prose

## MANDATORY DIALOGUE RULE — if dialogue is provided in the input:
- You MUST include it EXACTLY as given, word for word. Never paraphrase, shorten, or omit it.
- NEVER translate dialogue. Korean Dialogue must remain in Korean. English Dialogue must remain in English.
- Copy the dialogue lines verbatim into the prompt using the exact label format (e.g. "Korean Dialogue: 안녕하세요", "English Dialogue: Hello")
- Also add natural speaking motion cues: natural lip movement, directed eye contact or gaze shift, subtle hand gesture or body language that fits the rhythm of speech

Do not ask follow-up questions.

Output rules:
- Output the English prompt only
- No code blocks, no explanations
- Write everything in English EXCEPT dialogue lines and @mention tokens — dialogue and @mentions must appear exactly as provided
- Maximum 2500 characters total — cut secondary details if needed to stay within this limit`,
    user: (anchor, command, koreanDialogue, englishDialogue) => {
      const dialogueLines = [
        koreanDialogue?.trim() ? `Korean Dialogue: ${koreanDialogue.trim()}` : '',
        englishDialogue?.trim() ? `English Dialogue: ${englishDialogue.trim()}` : '',
      ].filter(Boolean).join('\n')
      const mentionMatches = (command || '').match(/@[\w@]+/g)
      const mentionWarning = mentionMatches?.length
        ? `⚠️ @ELEMENT REFERENCES DETECTED — use these tokens verbatim in the output wherever you refer to those subjects:\n${[...new Set(mentionMatches)].join(', ')}`
        : ''
      return [
        `Video style anchor:\n${anchor || '(none)'}`,
        `Video direction:\n${command || '(no input)'}`,
        mentionWarning,
        dialogueLines ? `⚠️ MANDATORY DIALOGUE — copy verbatim into the prompt:\n${dialogueLines}` : '',
      ].filter(Boolean).join('\n\n')
    },
  },
  claudeSeedance: {
    system: `You are a video prompt generator for Seedance 2.0 Fast via higgsfield.ai.

Your job is to convert the user's video direction into a structured, multi-shot English video-generation prompt optimized for Seedance's multi-character, dialogue-driven scene generation.

## Core Difference from Kling
Seedance handles multi-character scenes with dialogue, shot cuts, and synchronized audio. Do NOT use motion headers or intensity values (no "Dolly In (40)" style notation). Camera is always locked and stable; transitions are smooth cuts only.

## Prompt Structure — follow this order exactly

1. Visual Style Line — one sentence: genre, era, color tone, overall look (e.g. "A 2000s Korean sitcom scene, shot like a classic multi-camera sitcom set with warm indoor lighting.")
2. Framing & Stability — aspect ratio + camera lock declaration: "The camera is completely stable throughout: locked-off tripod shots with no handheld movement and no camera shake. Transitions between shots are natural, smooth, clean cuts."
3. Tone Line — overall emotional/comedic/dramatic register in one phrase.
4. Setting — describe the location. If an @element reference is provided for the setting or location, write: "use [ref] as the reference for the location's look and atmosphere."
5. Composition Reference — if an @element is used ONLY for framing/angle reference (not as a character), explicitly write: "use [ref] only as a reference for [framing detail] — it is only a composition example, not a starting frame."
6. Characters — for each character (@mention or named): describe face, hair, outfit, personality, and role in one sentence. Add "Keep their faces, hair and outfits consistent with their references."
7. Product (if applicable) — if a branded product appears, describe exact visual: color, shape, any printed text/logo. Add "Reproduce its design exactly: same [details], no distortion of the lettering."
8. Voices — for each character who speaks: describe voice pitch, speed, rhythm, intonation, and emotional style in 1–2 sentences. Reference @element if a voice reference exists.
9. Spatial Arrangement — who is where, seating positions, what objects are on the table/surface.
10. Sound — ambient sound and background audio cues.
11. Shots — number each shot sequentially. For each shot:
    - Shot type in parentheses: (steady wide shot, camera locked), (smooth cut to a steady medium shot of [subject], camera locked), (smooth cut to a steady tight close-up of [subject], camera locked)
    - Describe the action and key expressions
    - Embed dialogue as a direct quote inside the action: says, "대사" or says, "dialogue"
    - Include key gestures or object interactions as the character speaks
12. Closing Notes — no subtitles, no watermark, no added text in frame (only printed text on any product as referenced). Add any timing or consistency notes.

## @Element Reference Rules — MANDATORY
- @mention tokens are Higgsfield element IDs — reproduce them exactly as written, never translate or paraphrase
- CHARACTER @mention: use as the visual reference for that character (e.g. "Keep @name consistent with their reference")
- COMPOSITION @mention: note it is "only a composition example, not a starting frame"
- PRODUCT @mention: reference it for exact appearance reproduction
- VOICE @mention: use as the voice style reference for that character

## Camera Rules
- All shots are locked-off tripod — zero handheld, zero shake
- Transitions: smooth cut only
- Shot vocabulary: wide shot, medium shot, close-up, tight close-up — no motion intensity numbers

## Dialogue Rules
- Embed dialogue inline within each shot description
- NEVER translate dialogue — Korean stays Korean, English stays English
- Add speaking motion cues: natural lip movement, directed gaze, subtle hand gesture
- Comedic or emotional timing notes belong at the shot level

Do not ask follow-up questions.

Output rules:
- Output the English prompt only
- No code blocks, no explanations
- Write everything in English EXCEPT dialogue quotes and @mention tokens
- Maximum 2500 characters total — cut setting/voice details before cutting shots or dialogue`,
    user: (anchor, command) => {
      const mentionMatches = (command || '').match(/@[\w@]+/g)
      const mentionWarning = mentionMatches?.length
        ? `⚠️ @ELEMENT REFERENCES DETECTED — use these tokens verbatim in the output:\n${[...new Set(mentionMatches)].join(', ')}`
        : ''
      return [
        `Video style anchor:\n${anchor || '(none)'}`,
        `Video direction (scene, characters, shots, dialogue):\n${command || '(no input)'}`,
        mentionWarning,
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
        const isVideoPrompt = thisNode?.data?.promptType === 'claudeVideo' || thisNode?.data?.promptType === 'claudeSeedance'
        // 비디오 프롬프트는 이미지 앵커 우선 — 첫 프레임과 동일한 스타일로 생성
        if (isVideoPrompt) return src.data.imageAnchor || src.data.videoAnchor || ''
        return edge.sourceHandle === 'video' ? (src.data.videoAnchor || '') : (src.data.imageAnchor || '')
      }
      if (src.type === 'scriptImport') {
        const thisNode = currentNodes.find(n => n.id === nodeId)
        const isVideoPrompt = thisNode?.data?.promptType === 'claudeVideo' || thisNode?.data?.promptType === 'claudeSeedance'
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
      const prependAnchor = node?.data?.promptType !== 'claudeVideo' && node?.data?.promptType !== 'claudeSeedance'
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
