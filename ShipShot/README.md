# ShipShot

Capture anything. Remember everything.

ShipShot is a local-first macOS screen capture application connected directly
to Ship Memory. New captures remain temporary in Quick Access until **Save** is
pressed. Saved captures are stored in `~/Pictures/ShipShot`; remembered media is
copied into `~/ShipMemory/.shipmemory/attachments` and linked from portable
Markdown memory notes.

## Working MVP

- Area, window, and fullscreen screenshots using native macOS capture
- Interactive screen recording with microphone and click indicators
- Bottom-left Quick Access card with collapsed, hover, and pinned states
- Explicit-save lifecycle: Copy, Edit, Drag, Desktop export, and Delete never
  add a temporary capture to the ShipShot library
- Native drag-out into Finder, Desktop, text boxes, and compatible image apps
- Annotation editor with pencil, highlight, shapes, arrows, text, color, width,
  undo/redo, Desktop export, and drag-out
- Persistent local capture history and image previews
- Reveal, copy, and delete capture actions
- Automatic or manual Ship Memory ingestion
- Native Logitech/standard mouse-button binding with no keyboard required
- Global shortcuts available as a fallback for Logi Options+ mappings
- Dedicated Capture, Library, Ship Memory, Mouse & Shortcuts, and Settings UI

## Default shortcuts

| Action | Shortcut |
| --- | --- |
| Capture area | `Option + Shift + 1` |
| Capture window | `Option + Shift + 2` |
| Capture fullscreen | `Option + Shift + 3` |
| Record screen | `Option + Shift + 4` |

For direct mouse control, open **Mouse & Shortcuts**, grant Accessibility
access, press **Bind** beside an action, and click a side or middle mouse button.
ShipShot remembers the physical button and can reserve it so other apps do not
also perform Back, Forward, or Middle Click. Leave that button on its normal
mouse action in Logi Options+; a keystroke remap can prevent ShipShot from
receiving the physical click.

Keyboard-shortcut mappings remain available as a fallback. In Logi Options+,
select the mouse, choose a programmable button, select **Keyboard Shortcut**,
and enter the corresponding ShipShot shortcut.

## Development

```bash
npm install
npm run dev
```

Production bundle:

```bash
npm run build
```

The first capture may cause macOS to request Screen Recording permission.
Recording with narration may also request Microphone permission.
