import { _decorator, Component, Node, v3, Vec2, Vec3, CameraComponent, Quat } from 'cc';
import { gameEventTarget } from '../plugins/GameEventTarget';
import { GameEvent } from '../enums/GameEvent';
import { MoverEvent } from './MoverEvent';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';
import { PhysicalHoleFloor } from '../gameplay/PhysicalHoleFloor';

const { ccclass, property } = _decorator;

@ccclass('Mover')
export class Mover extends Component {
	@property
	moveSpeed: number = 10;

	@property
	rotationSpeed: number = 10;

	@property
	interRadius: number = 3;

	/** Visual mesh of the hole. Assign Hole/VisualRoot in the Inspector. */
	@property(Node)
	visualRoot: Node | null = null;

	/** Physical floor with the moving cut-out. Assign the component on Hole. */
	@property(PhysicalHoleFloor)
	physicalHoleFloor: PhysicalHoleFloor | null = null;

	@property
	growthEvery: number = 45;

	/** Added to the initial scale after each growth threshold. */
	@property
	growthStep: number = 0.1;

	/** Keep this enabled for ground-bound objects such as the collector hole. */
	@property
	lockWorldY: boolean = false;

	/** Characters can face their direction of travel; a hole must remain unrotated. */
	@property
	rotateWithMovement: boolean = true;


	private _cameraNode: Node = null;
	private _isCameraUnfocused = false;

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
		this._initialVisualScale = this.visualRoot?.scale.clone() ?? null;
		collectorEvents.on(CollectorEvent.PhysicalItemCollected, this.onPhysicalItemCollected, this);
	}

	onDestroy() {
		collectorEvents.off(CollectorEvent.PhysicalItemCollected, this.onPhysicalItemCollected, this);
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

			if (this.rotateWithMovement) {
				const angle = Math.atan2(velocity.x, velocity.z) / Math.PI * 180;
				const targetRotation: Quat = Quat.fromEuler(new Quat(), 0, angle, 0);

				if (!Quat.equals(this.node.worldRotation, targetRotation)) {
					const newRotation = new Quat();
					Quat.rotateTowards(newRotation, this.node.worldRotation, targetRotation, this.rotationSpeed * dt);
					this.node.setWorldRotation(newRotation);
				}
			}

			gameEventTarget.emit(GameEvent.CORRECT_VELOCITY, this.node.worldPosition, this.interRadius,
				velocity, newVel => velocity = newVel);

			const pos = this.node.worldPosition.clone().add(velocity);
			this.node.setWorldPosition(pos.x, this.lockWorldY ? this._fixedWorldY : pos.y, pos.z);

			gameEventTarget.emit(GameEvent.CAMERA_UPDATE_POSITION);
		} else if (this._isCameraUnfocused) {
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

		gameEventTarget[func](GameEvent.CAMERA_FOCUS, this.onCameraFocus, this);
	}

	onJoystickMoveStart() {
		if (this._isInputEnabled) {
			this._hasActiveTouch = true;
			collectorEvents.emit(CollectorEvent.DragStarted);
		}
	}


	onJoystickMove(cPos: Vec2, delta: Vec2) {
		if (this._hasActiveTouch && delta.length() > 0) {
			if (!this._isMoving) {
				this._isMoving = true;
				//@ts-ignore
				this.node.emit(MoverEvent.StartMove);
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

			//@ts-ignore
			this.node.emit(MoverEvent.StopMove);
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

	onCameraFocus(setupIdx: number) {
		this._isCameraUnfocused = setupIdx != 0;
	}

	private onPhysicalItemCollected() {
		this._collectedCount += 1;
		const level = Math.floor(this._collectedCount / Math.max(1, this.growthEvery));
		if (level <= this._appliedGrowthLevel) return;

		this._appliedGrowthLevel = level;
		const scale = 1 + level * this.growthStep;
		if (this.visualRoot && this._initialVisualScale) {
			this.visualRoot.setScale(
				this._initialVisualScale.x * scale,
				this._initialVisualScale.y,
				this._initialVisualScale.z * scale,
			);
		}
		// The floor component lives on the same Hole node; Inspector assignment is
		// preferred, while this fallback keeps the physical opening in sync if a
		// scene is opened before Creator has restored its serialized reference.
		(this.physicalHoleFloor ?? this.getComponent(PhysicalHoleFloor))?.setHoleScale(scale);
		this.interRadius = this._initialInterRadius * scale;
	}
}
