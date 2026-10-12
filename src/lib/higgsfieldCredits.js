// Seedance 2.0 Fast 정가 (4s~15s), 오디오 무관
const SEEDANCE_CREDITS = [14, 18, 21, 25, 28, 32, 35, 39, 42, 46, 49, 53]

export function calcHiggsfieldCredits(data) {
  if (data.type === 'video') {
    const duration = Number(data.duration ?? 5)
    const videoModel = data.videoModel ?? 'kling3_0'

    if (videoModel === 'seedance_2_0') {
      const idx = Math.min(Math.max(duration - 4, 0), SEEDANCE_CREDITS.length - 1)
      return SEEDANCE_CREDITS[idx]
    }

    // Kling 3.0
    const sound = data.sound ?? 'off'
    return sound === 'on'
      ? 6 + (duration - 3) * 2
      : 4.5 + (duration - 3) * 1.5
  }
  // image
  const model = data.model ?? 'gpt_image_2'
  const quality = data.quality ?? 'high'
  if (model === 'gpt_image_2') {
    return { low: 0.5, medium: 2, high: 4 }[quality] ?? 2
  }
  return { '1k': 0.5, '2k': 2, '4k': 4 }[quality] ?? 0.5
}
