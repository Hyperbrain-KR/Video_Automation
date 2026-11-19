// HiggsfieldNode → FlowCanvas 콜백 공유 (모듈 레벨 싱글턴)
export const higgsfieldHandlerRef = { current: null }
export const higgsfieldSheetHandlerRef = { current: null }
// 이미 제출된 작업의 결과만 다시 받아온다 (크레딧 추가 차감 없음)
export const higgsfieldResumeHandlerRef = { current: null }
