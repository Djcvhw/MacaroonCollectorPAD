import { _decorator, Component } from 'cc';
import { PlayableEvent, playableEvents } from './PlayableEvents';

const { ccclass, property } = _decorator;

/** TAOVOL Redirector adaptation. Call redirect from the CTA Button Click Event. */
@ccclass('PlayableRedirector')
export class PlayableRedirector extends Component {
  @property public iOsUrl = '';
  @property public androidUrl = '';

  private _storeUrl = '';

  public onLoad(): void {
    (window as any).gameReady?.();
    playableEvents.emit(PlayableEvent.GameReady);
  }

  public onEnable(): void {
    this._storeUrl = /android/i.test(navigator.userAgent) ? this.androidUrl : this.iOsUrl;
    playableEvents.on(PlayableEvent.RedirectProcessing, this.redirect, this);
  }

  public onDisable(): void { playableEvents.off(PlayableEvent.RedirectProcessing, this.redirect, this); }

  public redirect(): void {
    try { (window as any).AdRedirectProcessing?.(); }
    catch { if (this._storeUrl) window.open(this._storeUrl); }
  }
}
