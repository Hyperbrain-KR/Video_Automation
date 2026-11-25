// Higgsfield 는 차단 이유를 따로 주지 않고 상태 이름(nsfw, ip_detected)이나 짧은 문구만 준다
export function blockCode(text) {
  if (/ip_detected|copyright|intellectual property/i.test(text)) return 'IP'
  if (/\bnsfw\b|flagged|safety system|moderation|content policy/i.test(text)) return 'SAFETY'
  return null
}

export function blockMessage(code) {
  if (code === 'IP') return '저작권이 있는 대상(브랜드·캐릭터·작품 등)으로 감지되어 차단됐습니다.'
  if (code === 'IMAGE_NSFW') return 'Higgsfield가 부적절한 이미지(nsfw)로 분류했습니다. 프롬프트가 아니라 이미지가 원인이니, 다른 이미지로 바꾸거나 다시 생성해주세요.'
  return '안전 시스템에 의해 차단됐습니다.'
}
