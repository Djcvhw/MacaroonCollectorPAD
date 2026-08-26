import { _decorator, Component, Node, v3, Vec2, Vec3, CameraComponent, Quat } from 'cc';
import { gameEventTarget } from '../plugins/GameEventTarget';
import { GameEvent } from '../enums/GameEvent';
import { MoverEvent } from './MoverEvent';

const { ccclass, property } = _decorator;

@ccclass('Mover')
export class Mover extends Component {
	@property
	moveSpeed: number = 10;

	@property
	rotationSpeed: number = 10;

	@property
	interRadius: number = 3;

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
}
