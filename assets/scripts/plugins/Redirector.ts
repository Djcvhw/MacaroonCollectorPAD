import { _decorator, Component } from 'cc';
import { gameEventTarget } from './GameEventTarget';
import { GameEvent } from '../enums/GameEvent';

const { ccclass, property } = _decorator;

@ccclass('Redirector')
export class Redirector extends Component {
	@property
	iOsUrl: string = '';

	@property
	androidUrl: string = '';

	@property
	isOneTap: boolean = false;

	private _currentStoreLink: string = ''

	onLoad() {
		//@ts-ignore
		window.gameReady && window.gameReady();
	}

	onEnable() {
		this._currentStoreLink = /android/i.test(navigator.userAgent) ?
			this.androidUrl : this.iOsUrl;

		this._subscribeEvents(true);
	}

	onDisable() {
		this._subscribeEvents(false);
	}

	start() {
		gameEventTarget.emit(GameEvent.GAME_START);

		if (this.isOneTap) {
			//@ts-ignore
			window.gameEnd && window.gameEnd();
		}
	}

	private _subscribeEvents(isOn: boolean): void {
		const func = isOn ? 'on' : 'off';

		gameEventTarget[func](GameEvent.REDIRECT_PROCESSING, this.onRedirectProcessing, this);
	}

	onRedirectProcessing() {
		gameEventTarget.emit(GameEvent.ANALYTICS_SEND_COMPLETION_EVENT);

		gameEventTarget.emit(GameEvent.ANALYTICS_SEND_EVENT, 'Redirect');

		try {
			//@ts-ignore
			window.AdRedirectProcessing();
		} catch (e) {
			console.log('Have error in redirect', e);
			window.open(this._currentStoreLink);
		}
	}
}
