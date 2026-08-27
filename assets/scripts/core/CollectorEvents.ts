import { EventTarget } from 'cc';

export enum CollectorEvent {
  GameStateChanged = 'collector:game-state-changed',
  DragStarted = 'collector:drag-started',
  IntroFinished = 'collector:intro-finished',
  DragEnded = 'collector:drag-ended',
  ItemCollected = 'collector:item-collected',
  PhysicalItemCollected = 'collector:physical-item-collected',
  MacaroonFallStarted = 'collector:macaroon-fall-started',
  StageCompleted = 'collector:stage-completed',
  GateOpened = 'collector:gate-opened',
  GateBlocked = 'collector:gate-blocked',
  HoleSizedUp = 'collector:hole-sized-up',
  HolePositionRequested = 'collector:hole-position-requested',
  TimerChanged = 'collector:timer-changed',
  GameFinished = 'collector:game-finished',
}

export const collectorEvents = new EventTarget();
