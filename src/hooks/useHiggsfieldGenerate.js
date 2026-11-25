import { useCallback, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { higgsfieldHandlerRef, higgsfieldSheetHandlerRef, higgsfieldResumeHandlerRef } from '../lib/higgsfieldHandlerRef'
import { friendlyError } from '../lib/friendlyError'
import { apiFetch } from '../lib/config'
import { loadImageByNodeId } from '../lib/imageDB'
import { calcHiggsfieldCredits } from '../lib/higgsfieldCredits'
import { pollJob } from '../lib/pollJob'
import { appendResult, ownJobIdOf } from '../lib/nodeResult'

const SHEET_PROMPT = `Keeping the referenced character unchanged, a clean character reference sheet layout featuring the character displayed in three body views arranged in a row: front-facing pose, side profile (left), side profile (right), and back view — full body each, neutral standing pose, evenly spaced against a plain light background.

Below the body views, a row of six close-up facial expression panels, each labeled and depicting distinct emotions: joy (bright wide smile, sparkling eyes), sadness (downcast eyes, subtle tears, trembling lips), anger (furrowed brows, sharp glare, clenched jaw), pain/agony (scrunched brows, eyes squeezed shut, grimacing mouth), neutral/serious (flat calm expression, steady gaze, composed lips), and excitement (wide sparkling eyes, open elated smile, raised eyebrows).

The overall layout is organized like a professional animation character sheet, clean white or very light gray background, soft even ambient light across all panels, consistent character scale throughout, mood is professional and reference-ready. Clean guide lines separating each section.`

export function useHiggsfieldGenerate(characters, assets = [], epochRef) {
  const { getNodes, getEdges, updateNodeData } = useReactFlow()

  // 노드의 취소 버튼은 상태를 생성 중이 아닌 값으로 바꾼다 — 그러면 기다리기를 멈추고 이 작업의 결과는 반영하지 않는다
  const isCancelled = useCallback((nodeId, jobId) => {
    const d = getNodes().find(n => n.id === nodeId)?.data
    return !d || !['generating', 'slow'].includes(d.status) || ownJobIdOf(d) !== jobId
  }, [getNodes])

  // 제출된 작업을 기다렸다가 노드에 반영한다. 취소되거나 프로젝트가 바뀌면 아무것도 쓰지 않는다.
  const waitForResult = useCallback(async (nodeId, jobId, isVideo, epoch) => {
    const isStopped = () => (epochRef?.current ?? 0) !== epoch || isCancelled(nodeId, jobId)
    try {
      // 방금 쓴 '생성 중' 상태가 반영되기 전에 확인하면 취소로 오해하므로 반영될 때까지 잠깐 기다린다
      for (let i = 0; i < 60 && isCancelled(nodeId, jobId); i++) await new Promise(r => setTimeout(r, 50))
      const resultUrl = await pollJob({
        fetchStatus: () => apiFetch(`/api/higgsfield/status/${jobId}`),
        isStopped,
        slowAfterMs: (isVideo ? 10 : 5) * 60 * 1000,
        onSlow: () => updateNodeData(nodeId, { status: 'slow' }),
      })
      if (!resultUrl) return
      console.log(`[생성 완료] ${nodeId}: ${resultUrl.slice(0, 80)}`)
      const data = getNodes().find(n => n.id === nodeId)?.data ?? {}
      updateNodeData(nodeId, {
        status: 'done', ...appendResult(data, resultUrl), jobId, generatedAt: Date.now(),
        creditsUsed: (data.creditsUsed ?? 0) + calcHiggsfieldCredits(data),
      })
      window.dispatchEvent(new CustomEvent('higgsfield-generate-done'))
      // 다른 생성 노드는 연결선으로 이 노드의 결과를 직접 읽는다 — 넘겨주면 그 노드의 결과와 작업 id 를 덮어쓰게 된다
      const isGenerator = new Set(getNodes().filter(n => n.type === 'higgsfieldNode').map(n => n.id))
      getEdges().filter(e => e.source === nodeId && e.target !== nodeId && !isGenerator.has(e.target))
        .forEach(e => updateNodeData(e.target, { resultUrl, jobId }))
    } catch (err) {
      console.error(`[생성 실패] ${nodeId}`, err.message)
      if (isStopped()) return
      updateNodeData(nodeId, { status: 'error', error: friendlyError(err.message), errorCode: err.code })
    }
  }, [getNodes, getEdges, updateNodeData, epochRef, isCancelled])

  const handleHiggsfieldGenerate = useCallback(async (nodeId) => {
    const epoch = epochRef?.current ?? 0
    const switched = () => (epochRef?.current ?? 0) !== epoch
    const currentNodes = getNodes()
    const currentEdges = getEdges()

    const uploadError = (body, fallback) => Object.assign(new Error(body.error || fallback), { code: body.code })
    const named = (label, e) => Object.assign(new Error(`${label} — ${friendlyError(e.message)}`), { code: e.code })
    const failed = err => updateNodeData(nodeId, { status: 'error', error: friendlyError(err.message), errorCode: err.code })

    const node = currentNodes.find(n => n.id === nodeId)
    const isVideo = node?.data?.type === 'video'

    const promptEdge = currentEdges.find(e => e.target === nodeId && e.targetHandle === 'prompt')
    const promptSrc = promptEdge ? currentNodes.find(n => n.id === promptEdge.source) : null
    const basePrompt = promptSrc?.data?.prompt || promptSrc?.data?.value || ''

    // @Elements: 비디오 노드에 입력된 element 이름을 프롬프트 맨 앞에 삽입
    const videoElements = (node?.data?.videoElements ?? '').trim()
    const prompt = (isVideo && videoElements) ? `${videoElements}\n\n${basePrompt}` : basePrompt

    const uploadRefImage = async (srcNode) => {
      const { imageDataUrl, imageUrl, hasLocalImage, imageKey, filename, contentType } = srcNode.data ?? {}
      let fileBase64 = imageDataUrl || null
      let url = imageUrl || null
      if (hasLocalImage) {
        fileBase64 = await loadImageByNodeId(imageKey ?? srcNode.id) ?? null
        if (!fileBase64) throw new Error('레퍼런스 이미지 노드의 파일을 불러올 수 없습니다. 이미지를 다시 올리거나 연결을 해제해주세요.')
      }
      if (!fileBase64 && !url) return null
      const uploadRes = await apiFetch('/api/higgsfield/upload-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, fileBase64, filename, contentType }),
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.mediaId) throw named('레퍼런스 노드 이미지', uploadError(uploadData, '이미지 업로드 실패'))
      return uploadData.mediaId
    }

    const importRefUrl = async (urlOrBase64) => {
      const isBase64 = urlOrBase64?.startsWith('data:')
      const contentType = isBase64
        ? (urlOrBase64.match(/^data:([^;]+)/) ?? [])[1] ?? 'image/jpeg'
        : null
      const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
      const body = isBase64
        ? { fileBase64: urlOrBase64, filename: `reference.${ext}`, contentType }
        : { url: urlOrBase64 }
      const res = await apiFetch('/api/higgsfield/upload-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data.mediaId) throw uploadError(data, '레퍼런스 업로드 실패')
      return data.mediaId
    }

    // 선택한 참조를 못 읽으면 빠진 채로 생성하지 않고 중단한다 — 크레딧만 쓰고 @imageN 번호도 밀린다
    const loadStored = async (kind, item, key) => {
      const src = item.hasLocalImage ? await loadImageByNodeId(key) : item.resultUrl
      if (!src) throw new Error(`${kind} "${item.name}" 이미지를 불러올 수 없습니다. 다시 등록하거나 선택을 해제해주세요.`)
      return src
    }

    const importStored = async (kind, item, key) => {
      const src = await loadStored(kind, item, key)
      return importRefUrl(src).catch(e => { throw named(`${kind} "${item.name}"`, e) })
    }

    const mediaEdges = currentEdges.filter(e => e.target === nodeId &&
      (e.targetHandle === 'ref' || e.targetHandle === 'image'))
    const mediaSources = mediaEdges
      .map(e => currentNodes.find(n => n.id === e.source))
      .filter(Boolean)

    const t0 = Date.now()
    const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`
    console.log(`[생성 시작] nodeId: ${nodeId}, type: ${isVideo ? '비디오' : '이미지'}, prompt: "${prompt.slice(0, 60)}..."`)

    updateNodeData(nodeId, {
      status: 'loading', error: undefined, errorCode: undefined, elementWarning: undefined,
      ownJobId: undefined, generatingStartedAt: undefined,
    })

    let referenceMediaIds = []

    if (!isVideo) {
      const selectedCharIds = node?.data?.selectedCharacterIds ?? []
      const noCharRef = node?.data?.noCharRef ?? false
      const useDropdown = selectedCharIds.length > 0
      try {
        if (noCharRef) {
          referenceMediaIds = []
        } else if (useDropdown) {
          for (const charId of selectedCharIds) {
            const char = characters.find(c => c.id === charId)
            if (!char) continue
            const mediaId = await importStored('캐릭터', char, `char-${charId}`)
            if (mediaId) referenceMediaIds.push(mediaId)
          }
          const refImgResults = await Promise.all(
            mediaSources.filter(s => s.type === 'referenceImage').map(uploadRefImage)
          )
          refImgResults.forEach(id => { if (id) referenceMediaIds.push(id) })
        } else {
          const results = await Promise.all(mediaSources.map(src => {
            if (src.type === 'referenceImage') return uploadRefImage(src)
            if (src.data?.resultUrl) return importRefUrl(src.data.resultUrl).catch(e => { throw named('연결된 이미지', e) })
            return Promise.resolve(null)
          }))
          results.forEach(id => { if (id) referenceMediaIds.push(id) })
        }

        // 제품 참조 이미지 추가
        for (const assetId of node?.data?.selectedAssetIds ?? []) {
          const asset = assets.find(a => a.id === assetId)
          if (!asset) continue
          referenceMediaIds.push(await importStored('제품', asset, `asset-${assetId}`))
        }
      } catch (err) {
        if (switched()) return
        failed(err)
        return
      }
    }

    let firstFrameMediaId = null
    let endFrameMediaId = null
    let seedanceMediasPayload = null

    if (isVideo) {
      // 캐릭터 참조로 프레임 로드하는 헬퍼
      const loadCharFrame = async (charId) => {
        const char = characters.find(c => c.id === charId)
        if (!char) return null
        return importStored('캐릭터', char, `char-${charId}`)
      }

      const loadAssetFrame = asset => importStored('제품', asset, `asset-${asset.id}`)

      const videoModel = node?.data?.videoModel ?? 'kling3_0'

      if (videoModel === 'seedance_2_0') {
        // Seedance: Step02 이미지(start) → seedanceMediaRoles 순으로 medias 구성
        const seedanceMediaRoles = node?.data?.seedanceMediaRoles ?? {}

        // Step 02 higgsfieldImage 노드 (targetHandle: 'image' 엣지 소스)
        const step02Edge = mediaEdges.find(e => {
          const src = currentNodes.find(n => n.id === e.source)
          return src?.type === 'higgsfieldNode' && src?.data?.type === 'image'
        })
        const step02Src = step02Edge ? currentNodes.find(n => n.id === step02Edge.source) : null

        const tasks = []
        // 1. Step 02 이미지 → start 역할로 첫 번째
        if (step02Src?.data?.resultUrl) {
          tasks.push({ type: 'url', url: step02Src.data.resultUrl, role: 'start_image' })
        }
        // 2. 사용자가 선택한 레퍼런스 이미지 → characters 배열 순서대로 (클릭 순서 무관)
        for (const char of characters) {
          const role = seedanceMediaRoles[char.id]
          if (!role) continue
          tasks.push({ type: 'char', charId: char.id, role })
        }
        // 3. 역할이 지정된 제품 이미지 → assets 배열 순서대로 (@imageN 번호가 화면과 같도록 캐릭터 다음)
        for (const asset of assets) {
          const role = seedanceMediaRoles[`asset-${asset.id}`]
          if (!role) continue
          tasks.push({ type: 'asset', asset, role })
        }

        if (tasks.length > 0) {
          try {
            const resolved = await Promise.all(
              tasks.map(async (task) => {
                const mediaId = task.type === 'url' ? await importRefUrl(task.url).catch(e => { throw named('첫 프레임 이미지', e) })
                  : task.type === 'asset' ? await loadAssetFrame(task.asset)
                  : await loadCharFrame(task.charId)
                return mediaId ? { mediaId, role: task.role } : null
              })
            )
            seedanceMediasPayload = resolved.filter(Boolean)
          } catch (err) {
            console.error(`[미디어 임포트 실패] ${err.message} (${ts()})`)
            if (switched()) return
            failed(err)
            return
          }
        }
      } else {
        // Kling: videoFrameCharIds[0] → 첫프레임, [1] → 끝프레임
        const videoFrameCharIds = node?.data?.videoFrameCharIds ?? []
        // 목록에서 지워진 캐릭터는 화면에 보이지 않으므로 선택하지 않은 것으로 본다
        const existing = id => characters.some(c => c.id === id) ? id : null
        const firstCharId = existing(videoFrameCharIds[0])
        const endCharId   = existing(videoFrameCharIds[1])

        // 엣지 기반 소스 (캐릭터 참조가 없을 때 폴백)
        const refImgEdge = mediaEdges.find(e => currentNodes.find(n => n.id === e.source)?.type === 'referenceImage')
        const mediaEdge = refImgEdge ?? mediaEdges[0]
        const mediaSrc = mediaEdge ? currentNodes.find(n => n.id === mediaEdge.source) : null

        const endEdges = currentEdges.filter(e => e.target === nodeId && e.targetHandle === 'end_image')
        const endRefImgEdge = endEdges.find(e => currentNodes.find(n => n.id === e.source)?.type === 'referenceImage')
        const endEdge = endRefImgEdge ?? endEdges[0]
        const endSrc = endEdge ? currentNodes.find(n => n.id === endEdge.source) : null

        try {
          const [fId, eId] = await Promise.all([
            firstCharId ? loadCharFrame(firstCharId)
              : mediaSrc?.type === 'referenceImage' ? uploadRefImage(mediaSrc)
              : mediaSrc?.data?.resultUrl ? importRefUrl(mediaSrc.data.resultUrl).catch(e => { throw named('첫 프레임 이미지', e) })
              : Promise.resolve(null),
            endCharId ? loadCharFrame(endCharId)
              : endSrc?.type === 'referenceImage' ? uploadRefImage(endSrc)
              : endSrc?.data?.resultUrl ? importRefUrl(endSrc.data.resultUrl).catch(e => { throw named('끝 프레임 이미지', e) })
              : Promise.resolve(null),
          ])
          if (fId) firstFrameMediaId = fId
          if (eId) endFrameMediaId = eId
        } catch (err) {
          console.error(`[미디어 임포트 실패] ${err.message} (${ts()})`)
          if (switched()) return
          failed(err)
          return
        }
      }
    }

    // 준비하는 동안 프로젝트가 바뀌었으면 제출하지 않는다 (다른 프로젝트의 같은 id 노드에 결과가 들어가는 것 방지)
    if (switched()) return

    try {
      const endpoint = isVideo ? 'video' : 'image'
      const body = isVideo
        ? {
            prompt,
            videoModel: node?.data?.videoModel ?? 'kling3_0',
            duration: node?.data?.duration ?? '5',
            videoMode: node?.data?.videoMode ?? 'pro',
            sound: node?.data?.sound ?? 'off',
            videoAspect: node?.data?.videoAspect ?? '16:9',
            ...(seedanceMediasPayload ? { seedanceMediasPayload } : {}),
            ...(firstFrameMediaId ? { firstFrameMediaId } : {}),
            ...(endFrameMediaId ? { endFrameMediaId } : {}),
          }
        : {
            prompt,
            model: node?.data?.model ?? 'gpt_image_2',
            quality: node?.data?.quality ?? 'high',
            aspectRatio: node?.data?.aspectRatio ?? '9:16',
            referenceMediaIds,
          }

      console.log(`[생성 요청] /api/higgsfield/${endpoint} 호출 중...`, body)
      const genRes = await apiFetch(`/api/higgsfield/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (switched()) return
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}))
        if (genRes.status === 401 && err.code === 'LOGIN_REQUIRED') {
          updateNodeData(nodeId, { status: 'error', error: err.error })
          return
        }
        if (genRes.status === 401) {
          updateNodeData(nodeId, { status: 'auth_error', error: err.error })
          return
        }
        if (genRes.status === 402) {
          updateNodeData(nodeId, { status: 'error', error: 'Higgsfield 크레딧이 부족합니다. Higgsfield 계정에서 크레딧을 충전해주세요.' })
          return
        }
        throw Object.assign(new Error(err.error || `서버 오류 ${genRes.status}`), { code: err.code })
      }
      const genResData = await genRes.json()
      const { jobId, unresolvedElements = [] } = genResData
      console.log(`[생성 응답 원문] content:`, genResData.content?.[0]?.text)
      if (!jobId) throw new Error('jobId를 받지 못했습니다')
      console.log(`[생성 요청 완료] jobId: ${jobId} (${ts()})`)

      updateNodeData(nodeId, {
        status: 'generating', jobId, ownJobId: jobId, generatingStartedAt: Date.now(),
        elementWarning: unresolvedElements.length ? unresolvedElements.map(n => `@${n}`).join(', ') : undefined,
      })

      await waitForResult(nodeId, jobId, isVideo, epoch)
    } catch (err) {
      console.error(`[생성 실패] (${ts()})`, err.message)
      if (switched()) return
      failed(err)
    }
  }, [getNodes, getEdges, updateNodeData, characters, assets, epochRef, waitForResult])

  const resumePolling = useCallback(async (nodeId, jobId, isVideo) => {
    const epoch = epochRef?.current ?? 0
    console.log(`[결과 대기 재개] nodeId: ${nodeId}, jobId: ${jobId}, isVideo: ${isVideo}`)
    updateNodeData(nodeId, { status: 'generating', jobId, ownJobId: jobId, error: undefined, errorCode: undefined })
    await waitForResult(nodeId, jobId, isVideo, epoch)
  }, [updateNodeData, epochRef, waitForResult])

  const handleSheetGenerate = useCallback(async (nodeId) => {
    const epoch = epochRef?.current ?? 0
    const switched = () => (epochRef?.current ?? 0) !== epoch
    const currentNodes = getNodes()
    const node = currentNodes.find(n => n.id === nodeId)
    if (!node?.data?.resultUrl) return

    const anchorNode = currentNodes.find(n => n.type === 'styleAnchorInput')
    const anchor = anchorNode?.data?.imageAnchor ?? ''
    const prompt = anchor ? `${SHEET_PROMPT}\n\n${anchor}` : SHEET_PROMPT

    updateNodeData(nodeId, { sheetGenerating: true, sheetError: null })

    const importRefUrl = async (urlOrBase64) => {
      const isBase64 = urlOrBase64?.startsWith('data:')
      const contentType = isBase64
        ? (urlOrBase64.match(/^data:([^;]+)/) ?? [])[1] ?? 'image/jpeg'
        : null
      const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
      const body = isBase64
        ? { fileBase64: urlOrBase64, filename: `reference.${ext}`, contentType }
        : { url: urlOrBase64 }
      const res = await apiFetch('/api/higgsfield/upload-reference', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data.mediaId) throw new Error(data.error || '레퍼런스 업로드 실패')
      return data.mediaId
    }

    try {
      const refMediaId = await importRefUrl(node.data.resultUrl)

      const body = {
        prompt,
        model: node.data.model ?? 'gpt_image_2',
        quality: node.data.quality ?? 'high',
        aspectRatio: node.data.aspectRatio ?? '9:16',
        referenceMediaIds: refMediaId ? [refMediaId] : [],
      }

      const genRes = await apiFetch('/api/higgsfield/image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}))
        throw new Error(err.error || `서버 오류 ${genRes.status}`)
      }
      const { jobId } = await genRes.json()
      if (!jobId) throw new Error('jobId를 받지 못했습니다')

      // 시트 생성에는 취소 버튼이 없으므로 서버가 5분 넘게 응답하지 않으면 멈춘다
      const resultUrl = await pollJob({
        fetchStatus: () => apiFetch(`/api/higgsfield/status/${jobId}`),
        isStopped: switched,
        maxOutages: 60,
      })
      if (!resultUrl) return
      const data = getNodes().find(n => n.id === nodeId)?.data ?? node.data
      updateNodeData(nodeId, {
        sheetGenerating: false, ...appendResult(data, resultUrl),
        creditsUsed: (data.creditsUsed ?? 0) + calcHiggsfieldCredits(data),
      })
    } catch (err) {
      console.error('[시트 생성 실패]', err.message)
      if (switched()) return
      updateNodeData(nodeId, { sheetGenerating: false, sheetError: friendlyError(err.message) })
    }
  }, [getNodes, updateNodeData, epochRef])

  useEffect(() => {
    higgsfieldHandlerRef.current = handleHiggsfieldGenerate
  }, [handleHiggsfieldGenerate])

  useEffect(() => {
    higgsfieldSheetHandlerRef.current = handleSheetGenerate
  }, [handleSheetGenerate])

  useEffect(() => {
    higgsfieldResumeHandlerRef.current = (nodeId) => {
      const d = getNodes().find(n => n.id === nodeId)?.data
      const jobId = d ? ownJobIdOf(d) : null
      if (jobId) resumePolling(nodeId, jobId, d.type === 'video')
    }
  }, [getNodes, resumePolling])

  return resumePolling
}
