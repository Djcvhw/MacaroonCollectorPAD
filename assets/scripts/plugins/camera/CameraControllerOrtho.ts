import { _decorator, Camera, Component, CameraComponent, Node, tween, v3, Vec3, view, easing, game } from 'cc';
import { gameEventTarget } from '../GameEventTarget';
import { GameEvent } from '../../enums/GameEvent';

const { ccclass, property } = _decorator;

@ccclass('CameraSetupOrtho')
class CameraSetupOrtho {
	@property(Node)
	target: Node;

	@property
	orthoHeightP: number = 10;
	@property
	orthoHeightL: number = 10;
	@property
	dist: number = 80;
	@property
	thetaDeg: number = 0;
	@property
	phiDeg: number = 0;
}

@ccclass('CameraControllerOrtho')
export class CameraControllerOrtho extends Component {
	@property(Node)
	targetProxy: Node;

	@property([CameraSetupOrtho])
	cameraSetups: CameraSetupOrtho[] = [];

	@property
	shakeMagnitude: number = 3;

	@property({
		min: 0.01,
	})
	followingSpeed = 0.1;

	@property
	isMain = false;

	targetIdx = 0;

	private _cTarget: Node;
	private _cSetupIndex: number = 0;
	private _cDist: number = 0;
	private _cTheta: number = 0;
	private _cPhi: number = 0;
	private _cShakeAngle: number = 0;
	private _transitionState: Record<string, number> | null = null;

	onLoad() {
		// //@ts-ignore
		// this.cameraSetups[0].orthoHeightL = window.cameraSizeLandscape ?? this.cameraSetups[0].orthoHeightL;
		// //@ts-ignore
		// this.cameraSetups[0].orthoHeightP = window.cameraSizePortrait ?? this.cameraSetups[0].orthoHeightP;
		// //@ts-ignore
		// this.cameraSetups[0].thetaDeg = window.cameraThetaAngle ?? this.cameraSetups[0].thetaDeg;
		// //@ts-ignore
		// this.cameraSetups[0].phiDeg = window.cameraPhiAngle ?? this.cameraSetups[0].phiDeg;
	}

	onEnable() {
		this._subscribeEvents(true);
	}

	onDisable() {
		this._subscribeEvents(false);
	}

	start() {
		this._updateCurrentParameters();
		this._positionCamera();
	}

	update(deltaTime: number) {
		// if (this._cTarget) {
		// 	const delta = Vec3.subtract(v3(), this._cTarget.worldPosition,
		// 		this.targetProxy.worldPosition);
		// 	delta.multiplyScalar(Math.min(deltaTime * this.followingSpeed, 1));
		// 	this.targetProxy.translate(delta);
		// 	// this.targetProxy.setWorldPosition(this.targetProxy.getWorldPosition().add(delta));

		// 	this._positionCamera();
		// }
	}

	private _subscribeEvents(isOn: boolean): void {
		const func: string = isOn ? 'on' : 'off';

		view[func]('canvas-resize', this.onCanvasResize, this);
		gameEventTarget[func](GameEvent.CAMERA_TRANSITION, this.onCameraTransition, this);
		gameEventTarget[func](GameEvent.CAMERA_SHAKE, this.onCameraShake, this);
		gameEventTarget[func](GameEvent.CAMERA_GET, this.onCameraGet, this);
		gameEventTarget[func](GameEvent.CAMERA_UPDATE_POSITION, this.onCameraUpdatePosition, this);
		gameEventTarget[func](GameEvent.CAMERA_TRANSITION_TO_NODE, this.onCameraTransitionToNode, this);
		gameEventTarget[func](GameEvent.CAMERA_SET_SETUP_IMMEDIATE, this.onCameraSetSetupImmediate, this);
		gameEventTarget[func](GameEvent.CAMERA_INTRO_ROUTE, this.onCameraIntroRoute, this);
	}

	private _positionCamera() {
		const targetPos = this.targetProxy.worldPosition;

		const x = targetPos.x + this._cDist * Math.sin(this._cTheta) * Math.sin(this._cPhi);
		const y = targetPos.y + this._cDist * Math.cos(this._cTheta);
		const z = targetPos.z + this._cDist * Math.sin(this._cTheta) * Math.cos(this._cPhi);

		const xAngle = this._cTheta * 180 / Math.PI - 90 + this._cShakeAngle;
		const yAngle = this._cPhi * 180 / Math.PI;

		this.node.setWorldPosition(v3(x, y, z));
		this.node.eulerAngles = new Vec3(xAngle, yAngle, 0);
	}

	private _updateCurrentParameters() {
		const isLand = view.getVisibleSize().width > view.getVisibleSize().height;
		const cSetup = this.cameraSetups[this._cSetupIndex];

		this._cTarget = cSetup.target;
		this._cDist = cSetup.dist;
		this._cTheta = cSetup.thetaDeg / 180 * Math.PI;
		this._cPhi = cSetup.phiDeg / 180 * Math.PI;
		this.getComponent(Camera).orthoHeight = isLand ? cSetup.orthoHeightL : cSetup.orthoHeightP;

		const targetPos = this._cTarget.worldPosition;
		this.targetProxy.setWorldPosition(targetPos);
	}

	onCanvasResize() {
		if (this._transitionState) {
			return;
		}

		this._updateCurrentParameters();
	}

	onCameraSetSetupImmediate(setupIndex: number) {
		const setup = this.cameraSetups[setupIndex];
		if (!setup) {
			return;
		}

		this._stopTransition();
		this._cSetupIndex = setupIndex;
		this.targetIdx = setupIndex;
		this._applySetup(setup);
	}

	onCameraTransition(setupIndex: number, time: number = .5, easingType = easing.sineIn, callback: any = null) {
		const newSetup = this.cameraSetups[setupIndex];
		const currSetup = this.cameraSetups[this._cSetupIndex];
		if (!newSetup || !currSetup) {
			return;
		}

		this._stopTransition();
		this._cTarget = null;

		this._cSetupIndex = setupIndex;
		this.targetIdx = this._cSetupIndex;

		const t = { value: 0 };
		this._transitionState = t;
		const startPosition = this.targetProxy.worldPosition.clone();
		tween(t)
			.to(time, { value: 1 }, {
				onUpdate: () => {
					const isLand = view.getVisibleSize().width > view.getVisibleSize().height;
					this._cDist = newSetup.dist * t.value + currSetup.dist * (1 - t.value);
					this._cTheta = (newSetup.thetaDeg * t.value + currSetup.thetaDeg * (1 - t.value)) / 180 * Math.PI;
					this._cPhi = (newSetup.phiDeg * t.value + currSetup.phiDeg * (1 - t.value)) / 180 * Math.PI;

					this.targetProxy.setWorldPosition(Vec3.lerp(v3(), startPosition, newSetup.target.worldPosition, t.value));
					this._positionCamera();

					this.getComponent(Camera).orthoHeight = isLand ? newSetup.orthoHeightL * t.value + currSetup.orthoHeightL * (1 - t.value) :
						newSetup.orthoHeightP * t.value + currSetup.orthoHeightP * (1 - t.value);
				},
				easing: easingType,
			})
			.call(() => {
				this._cTarget = newSetup.target;
				this._transitionState = null;
				if (this.isMain && callback) { callback(); }
			})
			.start();
	}

	onCameraIntroRoute(setupIndices: number[], segmentTimes: number[], pauseBetweenSegments: number = 0, callback: any = null) {
		if (setupIndices.length < 2 || segmentTimes.length !== setupIndices.length - 1) {
			return;
		}

		const setups = setupIndices.map(index => this.cameraSetups[index]);
		if (setups.some(setup => !setup)) {
			return;
		}

		this._stopTransition();
		this._playIntroSegment(setups, setupIndices, segmentTimes, pauseBetweenSegments, 0, callback);
	}

	onCameraTransitionToNode(target: Node, time: number = .3, easingType = easing.sineInOut, callback: any = null) {
		if (!target) {
			return;
		}

		this._stopTransition();
		this._cTarget = null;
		const startPosition = this.targetProxy.worldPosition.clone();
		const state = { value: 0 };
		this._transitionState = state;
		tween(state)
			.to(time, { value: 1 }, {
				easing: easingType,
				onUpdate: () => {
					this.targetProxy.setWorldPosition(Vec3.lerp(v3(), startPosition, target.worldPosition, state.value));
					this._positionCamera();
				}
			})
			.call(() => {
				this._transitionState = null;
				if (this.isMain && callback) { callback(); }
			})
			.start();
	}

	private _playIntroSegment(setups: CameraSetupOrtho[], setupIndices: number[], segmentTimes: number[], pauseBetweenSegments: number, segmentIndex: number, callback: any) {
		const fromSetup = setups[segmentIndex];
		const toSetup = setups[segmentIndex + 1];
		const state = { value: 0 };

		this._cTarget = null;
		this._cSetupIndex = setupIndices[segmentIndex];
		this.targetIdx = this._cSetupIndex;
		this._transitionState = state;
		tween(state)
			.to(Math.max(segmentTimes[segmentIndex], 0.01), { value: 1 }, {
				easing: easing.sineInOut,
				onUpdate: () => this._applyInterpolatedPose(fromSetup, toSetup, state.value)
			})
			.call(() => {
				this._applySetup(toSetup);
				this._cSetupIndex = setupIndices[segmentIndex + 1];
				this.targetIdx = this._cSetupIndex;
				this._transitionState = null;

				if (segmentIndex + 1 < segmentTimes.length) {
					this._waitBeforeNextIntroSegment(setups, setupIndices, segmentTimes, pauseBetweenSegments, segmentIndex + 1, callback);
					return;
				}

				if (this.isMain && callback) { callback(); }
			})
			.start();
	}

	private _waitBeforeNextIntroSegment(setups: CameraSetupOrtho[], setupIndices: number[], segmentTimes: number[], pauseBetweenSegments: number, segmentIndex: number, callback: any) {
		if (pauseBetweenSegments <= 0) {
			this._playIntroSegment(setups, setupIndices, segmentTimes, pauseBetweenSegments, segmentIndex, callback);
			return;
		}

		const state = { value: 0 };
		this._transitionState = state;
		tween(state)
			.delay(pauseBetweenSegments)
			.call(() => {
				this._transitionState = null;
				this._playIntroSegment(setups, setupIndices, segmentTimes, pauseBetweenSegments, segmentIndex, callback);
			})
			.start();
	}

	private _applyInterpolatedPose(fromSetup: CameraSetupOrtho, toSetup: CameraSetupOrtho, progress: number) {
		const isLand = view.getVisibleSize().width > view.getVisibleSize().height;
		const targetPosition = Vec3.lerp(v3(), fromSetup.target.worldPosition, toSetup.target.worldPosition, progress);
		const cameraPosition = Vec3.lerp(v3(), this._getSetupCameraPosition(fromSetup), this._getSetupCameraPosition(toSetup), progress);

		this.targetProxy.setWorldPosition(targetPosition);
		this._applyCameraPose(cameraPosition, targetPosition);
		this._positionCamera();
		this.getComponent(Camera).orthoHeight = isLand
			? toSetup.orthoHeightL * progress + fromSetup.orthoHeightL * (1 - progress)
			: toSetup.orthoHeightP * progress + fromSetup.orthoHeightP * (1 - progress);
	}

	private _getSetupCameraPosition(setup: CameraSetupOrtho): Vec3 {
		const targetPosition = setup.target.worldPosition;
		const theta = setup.thetaDeg / 180 * Math.PI;
		const phi = setup.phiDeg / 180 * Math.PI;

		return v3(
			targetPosition.x + setup.dist * Math.sin(theta) * Math.sin(phi),
			targetPosition.y + setup.dist * Math.cos(theta),
			targetPosition.z + setup.dist * Math.sin(theta) * Math.cos(phi)
		);
	}

	private _applyCameraPose(cameraPosition: Vec3, targetPosition: Vec3) {
		const offset = Vec3.subtract(v3(), cameraPosition, targetPosition);
		this._cDist = offset.length();
		this._cTheta = Math.acos(offset.y / this._cDist);
		this._cPhi = Math.atan2(offset.x, offset.z);
	}

	private _applySetup(setup: CameraSetupOrtho) {
		const isLand = view.getVisibleSize().width > view.getVisibleSize().height;
		this._cTarget = setup.target;
		this._cDist = setup.dist;
		this._cTheta = setup.thetaDeg / 180 * Math.PI;
		this._cPhi = setup.phiDeg / 180 * Math.PI;
		this.getComponent(Camera).orthoHeight = isLand ? setup.orthoHeightL : setup.orthoHeightP;
		this.targetProxy.setWorldPosition(setup.target.worldPosition);
		this._positionCamera();
	}

	private _stopTransition() {
		if (!this._transitionState) {
			return;
		}

		tween(this._transitionState).stop();
		this._transitionState = null;
	}

	onCameraShake(duration: number = .2) {
		const t = { value: 0 };
		tween(t)
			.to(duration, { value: 1 }, {
				onUpdate: () => {
					this._cShakeAngle = Math.sin(t.value * Math.PI * 10) * this.shakeMagnitude;
				}
			})
			.start();
	}

	onCameraGet(callback: any) {
		if (this.isMain && callback) {
			callback(this.getComponent(CameraComponent));
		}
	}

	onCameraUpdatePosition() {
		if (this._cTarget) {
			const delta = Vec3.subtract(v3(), this._cTarget.worldPosition,
				this.targetProxy.worldPosition);
			delta.multiplyScalar(Math.min(game.deltaTime * this.followingSpeed, 1));
			this.targetProxy.translate(delta);

			this._positionCamera();
		}
	}
}
