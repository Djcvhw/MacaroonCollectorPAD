export enum CollectorGameState {
  Loading = 'loading',
  Tutorial = 'tutorial',
  Playing = 'playing',
  Transition = 'transition',
  Won = 'won',
  Lost = 'lost',
}

export interface StageProgress {
  stageIndex: number;
  collected: number;
  target: number;
}
