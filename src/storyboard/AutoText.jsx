// 내용만큼 자동으로 늘어나는 글상자
export default function AutoText({ value, onChange, readOnly, placeholder, className = '' }) {
  const grow = el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }
  return (
    <textarea ref={grow} className={`sb-field-input ${className}`} rows={1}
      value={value ?? ''} readOnly={readOnly} placeholder={readOnly ? '' : placeholder}
      onChange={e => { grow(e.target); onChange(e.target.value) }} />
  )
}
