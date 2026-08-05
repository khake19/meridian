import { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';

interface EditableTranscriptTextProps {
  text: string;
  label: string;
  editing: boolean;
  onChange(text: string): void;
  onCommit(text: string): void;
  onActivate(): void;
  onFinishEditing(): void;
}

export const EditableTranscriptText = forwardRef<HTMLDivElement, EditableTranscriptTextProps>(function EditableTranscriptText({ text, label, editing, onChange, onCommit, onActivate, onFinishEditing }, forwardedRef) {
  const elementRef = useRef<HTMLDivElement>(null);

  function setRefs(element: HTMLDivElement | null) {
    elementRef.current = element;
    if (typeof forwardedRef === 'function') forwardedRef(element);
    else if (forwardedRef) forwardedRef.current = element;
  }

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (element && document.activeElement !== element && element.textContent !== text) {
      element.textContent = text;
    }
  }, [text]);

  useEffect(() => {
    const element = elementRef.current;
    if (!editing || !element) return;
    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editing]);

  return <div
    ref={setRefs}
    className={`transcript-copy${editing ? ' editing' : ''}`}
    contentEditable={editing}
    suppressContentEditableWarning
    role={editing ? 'textbox' : 'button'}
    aria-label={label}
    aria-multiline="true"
    spellCheck
    tabIndex={0}
    onClick={() => { if (!editing) onActivate(); }}
    onKeyDown={(event) => { if (!editing && (event.key === 'Enter' || event.key === ' ')) onActivate(); }}
    onInput={(event) => { if (editing) onChange(event.currentTarget.textContent || ''); }}
    onBlur={(event) => { if (editing) { onCommit(event.currentTarget.textContent || ''); onFinishEditing(); } }}
  />;
});
