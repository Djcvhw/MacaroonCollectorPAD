import { _decorator, AudioClip, AudioSource, Component, error } from 'cc';
import { GameEvent } from '../enums/GameEvent';
import { gameEventTarget } from './GameEventTarget';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';

const { ccclass, property } = _decorator;

@ccclass('AudioManager')
export class AudioManager extends Component {

	@property(AudioClip)
	private collectorMacaroonClip: AudioClip | null = null;

	@property(AudioClip)
	private collectorGateOpenClip: AudioClip | null = null;

	@property(AudioClip)
	private collectorGoalUnlockedClip: AudioClip | null = null;

	@property(AudioClip)
	private collectorSizeUpClip: AudioClip | null = null;

	@property(AudioClip)
	private collectorWooshClip: AudioClip | null = null;

	@property
	private collectorMacaroonVolume = 1;

	@property
	private collectorMacaroonThrottleSeconds = 0.1;

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
	private _isGameEnded = false;
	private _lastMacaroonSoundTime = -Infinity;

	onLoad() {
		this._musicSource = this._createSource();
		this._conveyorSource = this._createSource();
		this._footstepSource = this._createSource();
		this._sfxSource = this._createSource();
	}

	onEnable() {
		this._subscribeEvents(true);
		this._subscribeCollectorEvents(true);
	}

	start() {
		gameEventTarget.emit(GameEvent.SOUND_GET_IS_ON, (isOn: boolean) => {
			this._setSoundEnabled(isOn);
		});
	}

	onDisable() {
		this._subscribeEvents(false);
		this._subscribeCollectorEvents(false);
		this._stopLoops();
	}

	private _subscribeEvents(isOn: boolean) {
		const func = isOn ? 'on' : 'off';

		gameEventTarget[func](GameEvent.TOGGLE_SOUND, this._setSoundEnabled, this);
		gameEventTarget[func](GameEvent.GAME_END, this._onGameEnd, this);
	}


	private _subscribeCollectorEvents(isOn: boolean) {
		const func = isOn ? 'on' : 'off';
		collectorEvents[func](CollectorEvent.MacaroonFallStarted, this._onCollectorMacaroonCollected, this);
		collectorEvents[func](CollectorEvent.GateOpened, this._onCollectorGateOpened, this);
		collectorEvents[func](CollectorEvent.StageCompleted, this._onCollectorGoalUnlocked, this);
		collectorEvents[func](CollectorEvent.HoleSizedUp, this._onCollectorSizeUp, this);
		collectorEvents[func](CollectorEvent.IntroFinished, this._onCollectorIntroFinished, this);
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

	private _onGameEnd() {
		this._isGameEnded = true;
		this._stopGameplaySounds();
	}


	private _onCollectorMacaroonCollected() {
		const now = performance.now() / 1000;
		if (now - this._lastMacaroonSoundTime < this.collectorMacaroonThrottleSeconds) return;
		this._lastMacaroonSoundTime = now;
		this._playOneShot(this.collectorMacaroonClip, 'collected_macaroon', this.collectorMacaroonVolume);
	}

	private _onCollectorGateOpened() {
		this._playOneShot(this.collectorGateOpenClip, 'gate_open');
	}

	private _onCollectorGoalUnlocked() {
		this._playOneShot(this.collectorGoalUnlockedClip, 'goal_unlocked');
	}

	private _onCollectorSizeUp() {
		this._playOneShot(this.collectorSizeUpClip, 'size_up');
	}

	private _onCollectorIntroFinished() {
		this._playOneShot(this.collectorWooshClip, 'woosh');
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

	private _playOneShot(clip: AudioClip | null, clipName: string, volume = this.sfxVolume) {
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

		this._sfxSource.playOneShot(clip, volume);
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
