import { EventTarget } from 'cc';

/** Small, portable subset of the TAOVOL playable event contract. */
export enum PlayableEvent {
  GameReady = 'playable:game-ready',
  GameStarted = 'playable:game-started',
  GameEnded = 'playable:game-ended',
  RedirectProcessing = 'playable:redirect-processing',
  PointerStart = 'playable:pointer-start',
  PointerMove = 'playable:pointer-move',
  PointerEnd = 'playable:pointer-end',
  CameraGet = 'playable:camera-get',
  CameraUpdatePosition = 'playable:camera-update-position',
}

export interface PointerPayload { x: number; y: number; }

export const playableEvents = new EventTarget();
