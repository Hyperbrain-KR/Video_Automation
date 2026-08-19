export function calcHiggsfieldCredits(data) {
  if (data.type === 'video') {
    const duration = Number(data.duration ?? 5)
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
