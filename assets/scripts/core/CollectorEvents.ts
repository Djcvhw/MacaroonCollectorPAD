import { EventTarget } from 'cc';

export enum CollectorEvent {
  GameStateChanged = 'collector:game-state-changed',
  DragStarted = 'collector:drag-started',
  DragEnded = 'collector:drag-ended',
  ItemCollected = 'collector:item-collected',
  PhysicalItemCollected = 'collector:physical-item-collected',
  StageCompleted = 'collector:stage-completed',
  GateOpened = 'collector:gate-opened',
  HoleSizedUp = 'collector:hole-sized-up',
  TimerChanged = 'collector:timer-changed',
  GameFinished = 'collector:game-finished',
}

export const collectorEvents = new EventTarget();
