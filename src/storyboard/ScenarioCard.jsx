import { useState } from 'react'
import { SCENARIO_FIELDS } from './api'
import AutoText from './AutoText'
import Comments from './Comments'

const lines = text => (text ?? '').split('\n').map(l => l.replace(/^\s*[-•·]\s*/, '').trim()).filter(Boolean)

function Field({ field, value, canEdit, onChange }) {
  return (
    <div className="sb-scn-field">
      <div className="sb-scn-label">{field.label}</div>
      {!canEdit && field.list
        ? (lines(value).length ? <ul className="sb-scn-list">{lines(value).map((l, i) => <li key={i}>{l}</li>)}</ul> : <div className="sb-scn-empty">—</div>)
        : <AutoText value={value} readOnly={!canEdit} onChange={onChange}
            placeholder={field.placeholder ?? '한 줄에 하나씩'} />}
    </div>
  )
}

// 스토리보드 맨 왼쪽 — 이 보드가 어떤 이야기인지 적어두는 카드
export default function ScenarioCard({ scenario, canEdit, onChange, comments, userId, onAddComment, onDeleteComment }) {
  const [showComments, setShowComments] = useState(false)
  const s = scenario ?? {}
  const field = key => SCENARIO_FIELDS.find(f => f.key === key)
  const set = key => v => onChange({ [key]: v })

  return (
    <article className="sb-scenario" aria-label="시나리오">
      <div className="sb-frame-top"><span className="sb-frame-no">시나리오</span></div>
      <div className="sb-scn-body">
        <div className="sb-scn-main">
          <div className="sb-scn-kicker">이 이야기의 주인공</div>
          {canEdit
            ? <input className="sb-scn-persona" value={s.persona ?? ''} placeholder="예: Game-Changer"
                onChange={e => onChange({ persona: e.target.value })} aria-label="주인공" />
            : <div className="sb-scn-persona is-static">{s.persona || '—'}</div>}
          <Field field={field('summary')} value={s.summary} canEdit={canEdit} onChange={set('summary')} />
        </div>
        <div className="sb-scn-col">
          <Field field={field('goals')} value={s.goals} canEdit={canEdit} onChange={set('goals')} />
          <Field field={field('pains')} value={s.pains} canEdit={canEdit} onChange={set('pains')} />
        </div>
        <div className="sb-scn-col sb-scn-side">
          <Field field={field('context')} value={s.context} canEdit={canEdit} onChange={set('context')} />
          <Field field={field('activities')} value={s.activities} canEdit={canEdit} onChange={set('activities')} />
        </div>
      </div>
      <button className={`sb-comment-toggle${comments.length ? ' has' : ''}`} onClick={() => setShowComments(v => !v)} aria-expanded={showComments}>
        💬 댓글 {comments.length}
      </button>
      {showComments && <Comments comments={comments} userId={userId} onAdd={onAddComment} onDelete={onDeleteComment} />}
    </article>
  )
}
