/**
 * @ship-memory/ui — the embeddable notepad.
 *
 * One component, `<Notepad engine={...} />`, over any @ship-memory/core
 * engine. ShipMemory.app wraps it in a Tauri shell today; ShipSpace (or any
 * future host) can mount the same component against the same hub.
 */

export { Notepad, type NotepadProps } from "./Notepad";
export { GraphView, type GraphViewProps } from "./GraphView";
export { NotePane, type NotePaneProps } from "./NotePane";
export { MarkdownEditor } from "./MarkdownEditor";
export { EditorToolbar, type NoteFont } from "./EditorToolbar";
export {
  attachmentKind,
  attachmentMime,
  attachmentPreviews,
  type AttachmentKind,
  type AttachmentLoader,
  type AttachmentOpener,
  type AttachmentOpenRequest,
  type AttachmentPathImporter,
  type SavedAttachment,
} from "./attachments";
export * from "./commands";
