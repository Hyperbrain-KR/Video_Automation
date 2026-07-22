import { useCallback, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { higgsfieldHandlerRef } from '../lib/higgsfieldHandlerRef'
import { friendlyError } from '../lib/friendlyError'
import { CANVAS_API } from '../lib/config'
import { loadImageByNodeId } from '../lib/imageDB'

export function useHiggsfieldGenerate(characters) {
  const { getNodes, getEdges, updateNodeData } = useReactFlow()

  const handleHiggsfieldGenerate = useCallback(async (nodeId) => {
    const currentNodes = getNodes()
    const currentEdges = getEdges()

    const node = currentNodes.find(n => n.id === nodeId)
    const isVideo = node?.data?.type === 'video'

    const promptEdge = currentEdges.find(e => e.target === nodeId && e.targetHandle === 'prompt')
    const promptSrc = promptEdge ? currentNodes.find(n => n.id === promptEdge.source) : null
    const prompt = promptSrc?.data?.prompt || promptSrc?.data?.value || ''

    const uploadRefImage = async (srcNode) => {
      const { imageDataUrl, imageUrl, hasLocalImage, filename, contentType } = srcNode.data ?? {}
      let fileBase64 = imageDataUrl || null
      let url = imageUrl || null
      if (hasLocalImage) {
        fileBase64 = await loadImageByNodeId(srcNode.id) ?? null
      }
      if (!fileBase64 && !url) return null
      const uploadRes = await fetch(`${CANVAS_API}/api/higgsfield/upload-reference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, fileBase64, filename, contentType }),
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.mediaId) throw new Error(uploadData.error || '이미지 업로드 실패')
      return uploadData.mediaId
    }

    const importRefUrl = async (urlOrBase64) => {
      const isBase64 = urlOrBase64?.startsWith('data:')
      const contentType = isBase64
        ? (urlOrBase64.match(/^data:([^;]+)/) ?? [])[1] ?? 'image/jpeg'
        : null
      const body = isBase64
        ? { fileBase64: urlOrBase64, filename: 'reference.jpg', contentType }
        : { url: urlOrBase64 }
      const res = await fetch(`${CANVAS_API}/api/higgsfield/upload-reference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data.mediaId) throw new Error(data.error || '레퍼런스 업로드 실패')
      return data.mediaId
    }

    const mediaEdges = currentEdges.filter(e => e.target === nodeId &&
      (e.targetHandle === 'ref' || e.targetHandle === 'image'))
    const mediaSources = mediaEdges
      .map(e => currentNodes.find(n => n.id === e.source))
      .filter(Boolean)

    const t0 = Date.now()
    const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`
    console.log(`[생성 시작] nodeId: ${nodeId}, type: ${isVideo ? '비디오' : '이미지'}, prompt: "${prompt.slice(0, 60)}..."`)

    updateNodeData(nodeId, { status: 'loading', error: undefined })

    let referenceMediaIds = []

    if (!isVideo) {
      const selectedCharIds = node?.data?.selectedCharacterIds ?? []
      const noCharRef = node?.data?.noCharRef ?? false
      const useDropdown = selectedCharIds.length > 0
      try {
        if (noCharRef) {
          referenceMediaIds = []
        } else if (useDropdown) {
          const charResults = await Promise.all(
            selectedCharIds.map(async charId => {
              const char = characters.find(c => c.id === charId)
              if (!char) return null
              const src = char.hasLocalImage
                ? await loadImageByNodeId(`char-${charId}`)
                : char.resultUrl
              if (!src) return null
              return importRefUrl(src).catch(() => {
                throw new Error(`캐릭터 "${char.name}" 이미지를 불러올 수 없습니다.`)
              })
            })
          )
          charResults.forEach(id => { if (id) referenceMediaIds.push(id) })
          const refImgResults = await Promise.all(
            mediaSources.filter(s => s.type === 'referenceImage').map(uploadRefImage)
          )
          refImgResults.forEach(id => { if (id) referenceMediaIds.push(id) })
        } else {
          const results = await Promise.all(mediaSources.map(src => {
            if (src.type === 'referenceImage') return uploadRefImage(src)
            if (src.data?.resultUrl) return importRefUrl(src.data.resultUrl)
            return Promise.resolve(null)
          }))
          results.forEach(id => { if (id) referenceMediaIds.push(id) })
        }
      } catch (err) {
        updateNodeData(nodeId, { status: 'error', error: friendlyError(err.message) })
        return
      }
    }

    let firstFrameMediaId = null
    let endFrameMediaId = null

    if (isVideo) {
      const refImgEdge = mediaEdges.find(e => currentNodes.find(n => n.id === e.source)?.type === 'referenceImage')
      const mediaEdge = refImgEdge ?? mediaEdges[0]
      const mediaSrc = mediaEdge ? currentNodes.find(n => n.id === mediaEdge.source) : null

      const endEdges = currentEdges.filter(e => e.target === nodeId && e.targetHandle === 'end_image')
      const endRefImgEdge = endEdges.find(e => currentNodes.find(n => n.id === e.source)?.type === 'referenceImage')
      const endEdge = endRefImgEdge ?? endEdges[0]
      const endSrc = endEdge ? currentNodes.find(n => n.id === endEdge.source) : null

      console.log(`[미디어 임포트] 첫프레임: ${mediaSrc?.type ?? '없음'}, 끝프레임: ${endSrc?.type ?? '없음'}`)
      try {
        const [fId, eId] = await Promise.all([
          mediaSrc?.type === 'referenceImage' ? uploadRefImage(mediaSrc)
            : mediaSrc?.data?.resultUrl ? importRefUrl(mediaSrc.data.resultUrl)
            : Promise.resolve(null),
          endSrc?.type === 'referenceImage' ? uploadRefImage(endSrc)
            : endSrc?.data?.resultUrl ? importRefUrl(endSrc.data.resultUrl)
            : Promise.resolve(null),
        ])
        if (fId) firstFrameMediaId = fId
        if (eId) endFrameMediaId = eId
        console.log(`[미디어 임포트 완료] firstFrameMediaId: ${firstFrameMediaId}, endFrameMediaId: ${endFrameMediaId} (${ts()})`)
      } catch (err) {
        console.error(`[미디어 임포트 실패] ${err.message} (${ts()})`)
        updateNodeData(nodeId, { status: 'error', error: friendlyError(err.message) })
        return
      }
    }

    try {
      const endpoint = isVideo ? 'video' : 'image'
      const body = isVideo
        ? {
            prompt,
            duration: node?.data?.duration ?? '5',
            videoMode: node?.data?.videoMode ?? 'pro',
            sound: node?.data?.sound ?? 'off',
            videoAspect: node?.data?.videoAspect ?? '16:9',
            ...(firstFrameMediaId ? { firstFrameMediaId } : {}),
            ...(endFrameMediaId ? { endFrameMediaId } : {}),
          }
        : {
            prompt,
            model: node?.data?.model ?? 'nano_banana_pro',
            quality: node?.data?.quality ?? '1k',
            aspectRatio: node?.data?.aspectRatio ?? 'auto',
            referenceMediaIds,
          }

      console.log(`[생성 요청] /api/higgsfield/${endpoint} 호출 중...`, body)
      const genRes = await fetch(`${CANVAS_API}/api/higgsfield/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}))
        if (genRes.status === 401) {
          updateNodeData(nodeId, { status: 'auth_error', error: err.error })
          return
        }
        throw new Error(err.error || `서버 오류 ${genRes.status}`)
      }
      const genResData = await genRes.json()
      const { jobId } = genResData
      console.log(`[생성 응답 원문] content:`, genResData.content?.[0]?.text)
      if (!jobId) throw new Error('jobId를 받지 못했습니다')
      console.log(`[생성 요청 완료] jobId: ${jobId} (${ts()})`)

      updateNodeData(nodeId, { status: 'generating', jobId })

      const deadlineMs = Date.now() + (isVideo ? 10 * 60 * 1000 : 5 * 60 * 1000)
      let resultUrl = null
      let pollCount = 0
      while (Date.now() < deadlineMs) {
        pollCount++
        const statusRes = await fetch(`${CANVAS_API}/api/higgsfield/status/${jobId}`)
        const statusData = await statusRes.json()
        const rawStatus = statusData.content?.[0]?.text?.slice(0, 200) ?? '(응답 없음)'
        console.log(`[폴링 #${pollCount}] (${ts()})`, statusData.resultUrl ? `✅ URL: ${statusData.resultUrl.slice(0, 60)}` : `⏳ 대기 중`, statusData.error ? `❌ ${statusData.error}` : '', '\n  Higgsfield 응답:', rawStatus)
        if (!statusRes.ok) {
          if (statusRes.status >= 500) { await new Promise(r => setTimeout(r, 5000)); continue }
          throw new Error(statusData.error || `상태 조회 오류 ${statusRes.status}`)
        }
        if (statusData.resultUrl) { resultUrl = statusData.resultUrl; break }
        if (statusData.error) throw new Error(statusData.error)
        if (rawStatus.toLowerCase().includes('something went wrong')) throw new Error(`Higgsfield 오류: ${rawStatus}`)
        if (Date.now() + 5000 < deadlineMs) await new Promise(r => setTimeout(r, 5000))
        else break
      }

      if (!resultUrl) throw new Error('결과 URL을 받지 못했습니다')
      console.log(`[생성 완료] resultUrl: ${resultUrl.slice(0, 80)} (${ts()})`)

      updateNodeData(nodeId, { status: 'done', resultUrl, jobId })

      getEdges().filter(e => e.source === nodeId && e.target !== nodeId)
        .forEach(e => updateNodeData(e.target, { resultUrl, jobId }))

    } catch (err) {
      console.error(`[생성 실패] (${ts()})`, err.message)
      updateNodeData(nodeId, { status: 'error', error: friendlyError(err.message) })
    }
  }, [getNodes, getEdges, updateNodeData, characters])

  useEffect(() => {
    higgsfieldHandlerRef.current = handleHiggsfieldGenerate
  }, [handleHiggsfieldGenerate])

  return handleHiggsfieldGenerate
}
