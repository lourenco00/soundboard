export type Clip = {
  id: string;
  name: string;
  color: string;
  lane: number;
  start: number;
  buffer: AudioBuffer;
  offset: number;
  duration: number;
};

export type Dragging =
  | {
      kind: "move";
      clipId: string;

      // mouse position at drag start in CONTENT coordinates (includes scroll)
      grabX: number;
      grabY: number;

      anchorLane: number;

      // NEW: per-clip horizontal offset in px from mouse to clip start at drag start
      offsets: { id: string; dx: number }[];

      // NEW: scroll snapshot at drag start (helps with accuracy on long canvases)
      scrollLeft0?: number;
      scrollTop0?: number;
    }
  | {
      kind: "trim-left" | "trim-right";
      clipId: string;
      startPx: number;       // in CONTENT px (includes scroll)
      origStart: number;     // seconds
      origDuration: number;  // seconds
    };



export type ClipboardItem = {
  name: string;
  color: string;
  lane: number;
  relStart: number;
  offset: number;
  duration: number;
  buffer: AudioBuffer;
};

export type ClipboardBundle = { items: ClipboardItem[] };
