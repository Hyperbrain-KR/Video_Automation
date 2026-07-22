export function friendlyError(msg) {
  if (!msg) return '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.'
  if (/HTTP 520/.test(msg)) return 'Higgsfield 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.'
  if (/HTTP 5\d\d/.test(msg)) return 'Higgsfield 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  if (/status 5\d\d|Service Unavailable|Error starting generation/i.test(msg)) return 'Higgsfield 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.'
  if (/타임아웃|timeout/i.test(msg)) return '요청 시간이 초과됐습니다. 다시 시도해주세요.'
  if (/something went wrong/i.test(msg)) return 'Higgsfield에서 오류를 반환했습니다. 설정을 바꿔 다시 시도해주세요.'
  if (/jobId/.test(msg)) return '생성 요청에 실패했습니다. 잠시 후 다시 시도해주세요.'
  if (/결과 URL/.test(msg)) return '생성 시간이 초과됐습니다. 다시 시도해주세요.'
  if (/상태 조회 오류/.test(msg)) return '생성 상태 확인에 실패했습니다. 잠시 후 다시 시도해주세요.'
  if (/이미지 업로드 실패/.test(msg)) return '이미지 업로드에 실패했습니다. 다시 시도해주세요.'
  if (/레퍼런스 업로드 실패/.test(msg)) return '참조 이미지 업로드에 실패했습니다. 다시 시도해주세요.'
  if (/힉스필드 서버 오류/.test(msg)) return msg
  if (/서버 오류/.test(msg)) return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return '네트워크 연결을 확인해주세요.'
  return msg
}
