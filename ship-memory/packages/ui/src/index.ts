/**
 * @ship-memory/ui — the embeddable notepad.
 *
 * One component, `<Notepad engine={...} />`, over any @ship-memory/core
 * engine. ShipMemory.app wraps it in a Tauri shell today; ShipSpace (or any
 * future host) can mount the same component against the same hub.
 */

export { Notepad, type NotepadProps } from "./Notepad.js";
export { GraphView, type GraphViewProps } from "./GraphView.js";
export { NotePane, type NotePaneProps } from "./NotePane.js";
export { MarkdownEditor } from "./MarkdownEditor.js";
export { EditorToolbar, type NoteFont } from "./EditorToolbar.js";
export {
  attachmentKind,
  attachmentMime,
  attachmentPreviews,
  type AttachmentKind,
  type AttachmentLoader,
  type AttachmentOpener,
  type AttachmentOpenRequest,
} from "./attachments.js";
export * from "./commands.js";
