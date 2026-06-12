import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";

const theme = EditorView.theme({
  "&": {
    fontSize: "15px",
    backgroundColor: "transparent",
    height: "100%",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
    lineHeight: "1.55",
  },
  ".cm-content": {
    padding: "16px 0 48vh 0",
    caretColor: "var(--smui-accent)",
    maxWidth: "100%",
  },
  ".cm-line": { padding: "0 4px" },
  ".cm-cursor": { borderLeftColor: "var(--smui-accent)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--smui-selection) !important",
  },
});

export interface MarkdownEditorProps {
  /** Initial document. The editor owns the text after mount — remount (key) to replace it. */
  initialDoc: string;
  onChange: (text: string) => void;
  autoFocus?: boolean;
}

export function MarkdownEditor({
  initialDoc,
  onChange,
  autoFocus,
}: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current!,
      state: EditorState.create({
        doc: initialDoc,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          EditorView.lineWrapping,
          placeholder("Start writing…"),
          theme,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    if (autoFocus) view.focus();
    return () => view.destroy();
    // The host remounts this component (React key) when the note or its
    // on-disk content changes — initialDoc is intentionally mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="smui-cm" ref={hostRef} />;
}
