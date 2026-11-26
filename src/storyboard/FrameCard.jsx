import { useRef, useState } from 'react'
import { FIELDS, STAGES, STAGE_PRESETS } from './api'
import AutoText from './AutoText'
import Comments from './Comments'

export default function FrameCard({ index, total, frame, imageUrl, canEdit, uploading, onChange, onImage, onRemoveImage, onMove, onDelete, comments, userId, onAddComment, onDeleteComment }) {
  const fileRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const stage = STAGES.find(s => s.key === frame.stageColor) ?? STAGES[STAGES.length - 1]

  const pick = file => { if (file) onImage(file) }

  return (
    <article className="sb-frame" aria-label={`Frame ${index + 1}`}>
      <div className="sb-frame-top">
        <span className="sb-frame-no">Frame {index + 1}</span>
        {canEdit && (
          <span className="sb-frame-tools">
            <button className="sb-icon" onClick={() => onMove(-1)} disabled={index === 0} title="왼쪽으로" aria-label="왼쪽으로 이동">‹</button>
            <button className="sb-icon" onClick={() => onMove(1)} disabled={index === total - 1} title="오른쪽으로" aria-label="오른쪽으로 이동">›</button>
            <button className="sb-icon sb-icon-danger" onClick={onDelete} title="프레임 삭제" aria-label="프레임 삭제">✕</button>
          </span>
        )}
      </div>

      <div className={`sb-image${dragOver ? ' is-over' : ''}${imageUrl ? ' has-image' : ''}`}
        onClick={() => canEdit && !imageUrl && fileRef.current?.click()}
        onDragOver={e => { if (canEdit) { e.preventDefault(); setDragOver(true) } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (canEdit) pick(e.dataTransfer.files?.[0]) }}>
        {imageUrl ? <img src={imageUrl} alt={`Frame ${index + 1} 이미지`} />
          : <span className="sb-image-empty">{uploading ? '올리는 중…' : canEdit ? '이미지를 끌어 놓거나 클릭해서 올리기' : '이미지 없음'}</span>}
        {imageUrl && canEdit && (
          <span className="sb-image-actions">
            <button className="sb-btn sb-btn-sm" onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>바꾸기</button>
            <button className="sb-btn sb-btn-sm" onClick={e => { e.stopPropagation(); onRemoveImage() }}>지우기</button>
          </span>
        )}
        {canEdit && <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />}
      </div>

      <div className={`sb-stage sb-stage-${stage.key}`}>
        {canEdit ? (
          <>
            <input className="sb-stage-label" value={frame.stageLabel} placeholder="단계 이름" list="sb-stage-presets"
              onChange={e => onChange({ stageLabel: e.target.value })} aria-label="단계 이름" />
            <span className="sb-swatches" role="radiogroup" aria-label="단계 색">
              {STAGES.map(s => (
                <button key={s.key} role="radio" aria-checked={s.key === stage.key} title={s.label}
                  className={`sb-swatch sb-stage-${s.key}${s.key === stage.key ? ' is-on' : ''}`}
                  onClick={() => onChange({ stageColor: s.key })} />
              ))}
            </span>
          </>
        ) : <span className="sb-stage-label is-static">{frame.stageLabel || '—'}</span>}
      </div>

      <dl className="sb-fields">
        {FIELDS.map(f => (
          <div key={f.key} className="sb-field">
            <dt>{f.label}</dt>
            <dd><AutoText value={frame[f.key]} readOnly={!canEdit} placeholder={`${f.label}…`} onChange={v => onChange({ [f.key]: v })} /></dd>
          </div>
        ))}
      </dl>

      <button className={`sb-comment-toggle${comments.length ? ' has' : ''}`} onClick={() => setShowComments(v => !v)} aria-expanded={showComments}>
        💬 댓글 {comments.length}
      </button>
      {showComments && <Comments comments={comments} userId={userId} onAdd={onAddComment} onDelete={onDeleteComment} />}
      <datalist id="sb-stage-presets">{STAGE_PRESETS.map(p => <option key={p} value={p} />)}</datalist>
    </article>
  )
}
