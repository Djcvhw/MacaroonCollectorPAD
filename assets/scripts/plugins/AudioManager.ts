import { _decorator, AudioClip, AudioSource, Component, error } from 'cc';
import { GameEvent } from '../enums/GameEvent';
import { gameEventTarget } from './GameEventTarget';

const { ccclass, property } = _decorator;

@ccclass('AudioManager')
export class AudioManager extends Component {
	@property(AudioClip)
	private sfxMusic: AudioClip | null = null;

	@property(AudioClip)
	private sfxBuy: AudioClip | null = null;

	@property(AudioClip)
	private sfxCoin: AudioClip | null = null;

	@property(AudioClip)
	private sfxCollect: AudioClip | null = null;

	@property(AudioClip)
	private sfxCollectMoney: AudioClip | null = null;

	@property(AudioClip)
	private sfxConveerLv01: AudioClip | null = null;

	@property(AudioClip)
	private sfxConveerLv02: AudioClip | null = null;

	@property(AudioClip)
	private sfxFootstep: AudioClip | null = null;

	@property(AudioClip)
	private sfxPut: AudioClip | null = null;

	@property(AudioClip)
	private sfxSpendMoney: AudioClip | null = null;

	@property(AudioClip)
	private sfxSuccessFinal: AudioClip | null = null;

	@property(AudioClip)
	private sfxUpgrade: AudioClip | null = null;

	@property
	private musicVolume = 0.45;

	@property
	private sfxVolume = 1;

	@property
	private conveyorVolume = 0.55;

	@property
	private footstepVolume = 0.55;

	private _musicSource: AudioSource | null = null;
	private _conveyorSource: AudioSource | null = null;
	private _footstepSource: AudioSource | null = null;
	private _sfxSource: AudioSource | null = null;
	private _isSoundOn = true;
	private _isPlayerWalking = false;
	private _conveyorLevel = 0;
	private _isGameEnded = false;
	private _isMusicStarted = false;

	onLoad() {
		this._musicSource = this._createSource();
		this._conveyorSource = this._createSource();
		this._footstepSource = this._createSource();
		this._sfxSource = this._createSource();
	}

	onEnable() {
		this._subscribeEvents(true);
	}

	start() {
		gameEventTarget.emit(GameEvent.SOUND_GET_IS_ON, (isOn: boolean) => {
			this._setSoundEnabled(isOn);
		});
	}

	onDisable() {
		this._subscribeEvents(false);
		this._stopLoops();
	}

	private _subscribeEvents(isOn: boolean) {
		const func = isOn ? 'on' : 'off';

		gameEventTarget[func](GameEvent.TOGGLE_SOUND, this._setSoundEnabled, this);
		gameEventTarget[func](GameEvent.SCREEN_TOUCH_START, this._onScreenTouchStart, this);
		gameEventTarget[func](GameEvent.GAME_END, this._onGameEnd, this);
	}

	private _createSource(): AudioSource {
		const source = this.node.addComponent(AudioSource);
		source.playOnAwake = false;
		source.loop = false;
		return source;
	}

	private _setSoundEnabled(isOn: boolean) {
		this._isSoundOn = isOn;
		this._setSourceVolume(this._musicSource, this.musicVolume);
		this._setSourceVolume(this._conveyorSource, this.conveyorVolume);
		this._setSourceVolume(this._footstepSource, this.footstepVolume);
		this._setSourceVolume(this._sfxSource, 1);
	}

	private _playMusic() {
		this._playLoop(this._musicSource, this.sfxMusic, this.musicVolume, 'sfx_music');
	}

	private _onScreenTouchStart() {
		if (this._isMusicStarted) {
			return;
		}

		this._isMusicStarted = true;
		this._playMusic();
	}

	private _onConveerBuy() {
		this._playOneShot(this.sfxBuy, 'sfx_buy');
	}

	private _onConveerStart() {
		this._conveyorLevel = 1;
		this._playConveyorLoop();
	}

	private _onConveerUpgradeBuy() {
		this._conveyorLevel = 2;
		this._playOneShot(this.sfxUpgrade, 'sfx_upgrade');
		this._playConveyorLoop();
	}

	private _onEmployerBuy() {
		this._playOneShot(this.sfxBuy, 'sfx_buy');
	}

	private _onNextLevelBuy() {
		this._playOneShot(this.sfxSuccessFinal, 'sfx_success_final');
	}

	private _onGameEnd() {
		this._isGameEnded = true;
		this._stopGameplaySounds();
	}

	private _onPlayerCoinSpendToZone() {
		this._playOneShot(this.sfxSpendMoney, 'sfx_spend_money');
	}

	private _onPlayerWalkStart() {
		this._isPlayerWalking = true;
		this._playFootstepLoop();
	}

	private _onPlayerWalkEnd() {
		this._isPlayerWalking = false;
		this._footstepSource?.stop();
	}

	private _onCollect() {
		this._playOneShot(this.sfxCollect, 'sfx_collect');
	}

	private _onPut() {
		this._playOneShot(this.sfxPut, 'sfx_put');
	}

	private _onBoxSell() {
		this._playOneShot(this.sfxPut, 'sfx_put');
	}

	private _onCoinSpawn() {
		this._playOneShot(this.sfxCoin, 'sfx_coin');
	}

	private _onCoinCollect() {
		this._playOneShot(this.sfxCollectMoney, 'sfx_collect_money');
	}

	private _playConveyorLoop() {
		if (this._isGameEnded || this._conveyorLevel === 0) {
			return;
		}

		const clip = this._conveyorLevel === 2 ? this.sfxConveerLv02 : this.sfxConveerLv01;
		const clipName = this._conveyorLevel === 2 ? 'sfx_conveer_lv02' : 'sfx_conveer_lv01';
		this._playLoop(this._conveyorSource, clip, this.conveyorVolume, clipName);
	}

	private _playFootstepLoop() {
		if (this._isGameEnded || !this._isPlayerWalking) {
			return;
		}

		this._playLoop(this._footstepSource, this.sfxFootstep, this.footstepVolume, 'sfx_footstep');
	}

	private _playLoop(source: AudioSource | null, clip: AudioClip | null, volume: number, clipName: string) {
		if (!source) {
			error('[AudioManager] AudioSource is not initialized');
			return;
		}

		if (!clip) {
			error(`[AudioManager] ${clipName} clip is not assigned`);
			return;
		}

		source.stop();
		source.clip = clip;
		source.loop = true;
		source.volume = this._isSoundOn ? volume : 0;
		source.play();
	}

	private _playOneShot(clip: AudioClip | null, clipName: string) {
		if (this._isGameEnded) {
			return;
		}

		if (!this._sfxSource) {
			error('[AudioManager] SFX AudioSource is not initialized');
			return;
		}

		if (!clip) {
			error(`[AudioManager] ${clipName} clip is not assigned`);
			return;
		}

		this._sfxSource.playOneShot(clip, this.sfxVolume);
	}

	private _setSourceVolume(source: AudioSource | null, volume: number) {
		if (source) {
			source.volume = this._isSoundOn ? volume : 0;
		}
	}

	private _stopLoops() {
		this._musicSource?.stop();
		this._conveyorSource?.stop();
		this._footstepSource?.stop();
	}

	private _stopGameplaySounds() {
		this._conveyorSource?.stop();
		this._footstepSource?.stop();
		this._sfxSource?.stop();
	}
}
