import { _decorator, Component, Node, v3, Vec2, Vec3, CameraComponent } from 'cc';
import { gameEventTarget } from '../plugins/GameEventTarget';
import { GameEvent } from '../enums/GameEvent';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';
import { PhysicalHoleFloor } from '../gameplay/PhysicalHoleFloor';

const { ccclass, property } = _decorator;

@ccclass('Mover')
export class Mover extends Component {
	@property
	moveSpeed: number = 10;

	@property
	interRadius: number = 3;

	@property
	growthEvery: number = 45;

	@property
	growthStep: number = 0.1;

	/** Visual mesh of the hole. Assign Hole/VisualRoot in the Inspector. */
	@property(Node)
	visualRoot: Node | null = null;

	/** Physical floor with the moving cut-out. Assign the component on Hole. */
	@property(PhysicalHoleFloor)
	physicalHoleFloor: PhysicalHoleFloor | null = null;

	/** Keep this enabled for ground-bound objects such as the collector hole. */
	@property
	lockWorldY: boolean = false;

	private _cameraNode: Node = null;

	private _cVelocity: Vec3 = v3();
	private _hasActiveTouch: boolean = false;

	private _isMoving = false;

	private _isInputEnabled = true;
	private _fixedWorldY = 0;
	private _initialInterRadius = 0;
	private _initialVisualScale: Vec3 | null = null;
	private _collectedCount = 0;
	private _appliedGrowthLevel = 0;

	onLoad() {
		this._initialInterRadius = this.interRadius;
		if (!this.visualRoot || !this.physicalHoleFloor) {
			console.error('[Mover] Visual Root and Physical Hole Floor must be assigned in Inspector.');
			this.enabled = false;
			return;
		}
		this._initialVisualScale = this.visualRoot.scale.clone();
		collectorEvents.on(CollectorEvent.PhysicalItemCollected, this.onPhysicalItemCollected, this);
		collectorEvents.on(CollectorEvent.HolePositionRequested, this.onHolePositionRequested, this);
	}

	onDestroy() {
		collectorEvents.off(CollectorEvent.PhysicalItemCollected, this.onPhysicalItemCollected, this);
		collectorEvents.off(CollectorEvent.HolePositionRequested, this.onHolePositionRequested, this);
	}

	onEnable() {
		this._fixedWorldY = this.node.worldPosition.y;
		gameEventTarget.emit(GameEvent.CAMERA_GET, (camera: CameraComponent) => {
			this._cameraNode = camera.node;

			this._subscribeEvents(true);
		});
	}

	onDisable() {
		this._subscribeEvents(false);
	}


	update(dt: number) {
		if (this._cVelocity.length() > 0) {
			let velocity = Vec3.multiplyScalar(v3(), this._cVelocity, dt);

			Vec3.rotateY(
				velocity,
				velocity,
				new Vec3(0, 0, 0),
				this._cameraNode.eulerAngles.y * Math.PI / 180.0
			);

			gameEventTarget.emit(GameEvent.CORRECT_VELOCITY, this.node.worldPosition, this.interRadius,
				velocity, newVel => velocity = newVel);

			const pos = this.node.worldPosition.clone().add(velocity);
			this.node.setWorldPosition(pos.x, this.lockWorldY ? this._fixedWorldY : pos.y, pos.z);

			gameEventTarget.emit(GameEvent.CAMERA_UPDATE_POSITION);
		}

		// gameEventTarget.emit(GameEvent.CHECK_INTERACTION, this.node.worldPosition, this.interRadius);
	}

	private _subscribeEvents(isOn: boolean) {
		const func = isOn ? 'on' : 'off';

		gameEventTarget[func](GameEvent.JOYSTICK_MOVE_START, this.onJoystickMoveStart, this);
		gameEventTarget[func](GameEvent.JOYSTICK_MOVE, this.onJoystickMove, this);
		gameEventTarget[func](GameEvent.JOYSTICK_MOVE_END, this.onJoystickMoveEnd, this);

		gameEventTarget[func](GameEvent.SET_INPUT_ENABLED, this.onSetInputEnabled, this);

	}

	onJoystickMoveStart() {
		if (this._isInputEnabled) {
			this._hasActiveTouch = true;
		}
	}


	onJoystickMove(_cPos: Vec2, delta: Vec2) {
		if (this._hasActiveTouch && delta.length() > 0) {
			if (!this._isMoving) {
				this._isMoving = true;
				collectorEvents.emit(CollectorEvent.DragStarted);
			}

			this._cVelocity.x = delta.x * this.moveSpeed / delta.length();
			this._cVelocity.z = -delta.y * this.moveSpeed / delta.length();
		}
	}

	onJoystickMoveEnd() {
		if (this._hasActiveTouch) {
			this._hasActiveTouch = false;
			this._isMoving = false;

			this._cVelocity = v3();

		}
	}

	onSetInputEnabled(isOn: boolean) {
		if (!isOn && this._isInputEnabled) {
			this._isInputEnabled = isOn;
			this.onJoystickMoveEnd();
		} else if (isOn && !this._isInputEnabled) {
			this._cVelocity = v3();
			this._isInputEnabled = isOn;
		}
	}

	private onPhysicalItemCollected() {
		this._collectedCount += 1;
		const level = Math.floor(this._collectedCount / Math.max(1, this.growthEvery));
		if (level <= this._appliedGrowthLevel) return;
		this._appliedGrowthLevel = level;
		const scale = 1 + level * this.growthStep;
		if (!this._initialVisualScale || !this.visualRoot || !this.physicalHoleFloor) {
			console.error('[Mover] Cannot apply growth: required Inspector references are missing.');
			return;
		}
		this.visualRoot.setScale(
				this._initialVisualScale.x * scale,
				this._initialVisualScale.y,
				this._initialVisualScale.z * scale,
		);
		this.physicalHoleFloor.setHoleScale(scale);
		this.interRadius = this._initialInterRadius * scale;
		collectorEvents.emit(CollectorEvent.HoleSizedUp, scale, this.node.worldPosition.clone());
	}

	private onHolePositionRequested(callback: (position: Vec3) => void) {
		if (!this.visualRoot) {
			console.error('[Mover] Cannot provide hole position: Visual Root is not assigned.');
			return;
		}
		callback(this.visualRoot.worldPosition.clone());
	}
}
