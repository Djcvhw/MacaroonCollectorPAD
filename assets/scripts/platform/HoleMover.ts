import { _decorator, Component } from 'cc';
import { HoleController } from '../gameplay/HoleController';
import { PlayableEvent, playableEvents, PointerPayload } from './PlayableEvents';

const { ccclass, property } = _decorator;

/** TAOVOL Mover adaptation for the collector hole. */
@ccclass('HoleMover')
export class HoleMover extends Component {
  @property(HoleController) public hole: HoleController | null = null;

  public onEnable(): void {
    if (!this.hole) throw new Error('HoleMover requires a HoleController reference.');
    this.hole.setDirectInputEnabled(false);
    playableEvents.on(PlayableEvent.PointerStart, this.onPointerStart, this);
    playableEvents.on(PlayableEvent.PointerMove, this.onPointerMove, this);
    playableEvents.on(PlayableEvent.PointerEnd, this.onPointerEnd, this);
  }

  public onDisable(): void {
    playableEvents.off(PlayableEvent.PointerStart, this.onPointerStart, this);
    playableEvents.off(PlayableEvent.PointerMove, this.onPointerMove, this);
    playableEvents.off(PlayableEvent.PointerEnd, this.onPointerEnd, this);
    this.hole?.setDirectInputEnabled(true);
  }

  private onPointerStart(pointer: PointerPayload): void { this.hole?.beginPointer(pointer.x, pointer.y); }
  private onPointerMove(pointer: PointerPayload): void {
    this.hole?.movePointer(pointer.x, pointer.y);
    playableEvents.emit(PlayableEvent.CameraUpdatePosition);
  }
  private onPointerEnd(): void { this.hole?.endPointer(); }
}
