// idle 기본상태
// nod 끄덕이기
// shake 좌우 흔들기
// bounce 통통 튀기
// 감정과 행동이 서로 독립적 (ex happy 감정에서도 nod나 bounce 행동 사용 가능)

export type Action =
  | 'idle'
  | 'nod'
  | 'shake'
  | 'bounce';