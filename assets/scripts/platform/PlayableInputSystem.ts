import { _decorator, Component, EventTouch, input, Input } from 'cc';
import { PlayableEvent, playableEvents } from './PlayableEvents';

const { ccclass } = _decorator;

/** Adapted from TAOVOL InputSystem: input publishes commands, never moves gameplay nodes. */
@ccclass('PlayableInputSystem')
export class PlayableInputSystem extends Component {
  public onEnable(): void {
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  public onDisable(): void {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  private onTouchStart(event: EventTouch): void { playableEvents.emit(PlayableEvent.PointerStart, this.payload(event)); }
  private onTouchMove(event: EventTouch): void { playableEvents.emit(PlayableEvent.PointerMove, this.payload(event)); }
  private onTouchEnd(): void { playableEvents.emit(PlayableEvent.PointerEnd); }
  private payload(event: EventTouch) { return { x: event.getLocationX(), y: event.getLocationY() }; }
}
