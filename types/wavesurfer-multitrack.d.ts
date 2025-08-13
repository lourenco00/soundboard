// types/wavesurfer-multitrack.d.ts
declare module "wavesurfer-multitrack" {
  // Super loose typings; the package does not ship types.
  export default class Multitrack {
    constructor(
      tracks: any[],
      options: {
        container: HTMLElement;
        minPxPerSec?: number;
        rightButtonDrag?: boolean;
        barHeight?: number;
        waveHeight?: number;
        renderWaveform?: boolean;
        audioContext?: AudioContext;
        audioContextDestination?: AudioNode;
        // more options exist, we don’t need strict types here
        [key: string]: any;
      }
    );
    play(): void;
    pause(): void;
    seekTo(seconds: number): void;
    zoom(pxPerSec: number): void;

    addTrack(cfg: any): any;       // returns a track
    removeTrack(track: any): void;

    on(event: string, handler: (...args: any[]) => void): void;
    destroy(): void;
  }
}
