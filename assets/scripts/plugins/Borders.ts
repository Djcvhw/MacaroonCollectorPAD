import { _decorator, Component, Intersection2D, v2, Vec2, Vec3 } from 'cc';
import { gameEventTarget } from './GameEventTarget';
import { GameEvent } from '../enums/GameEvent';

const { ccclass } = _decorator;

type BorderLine = {
	startPos: Vec2;
	endPos: Vec2;
};

@ccclass('Borders')
export class Borders extends Component {
	private _borderLines: BorderLine[] = [];

	onEnable() {
		this.recalculateBorders();
		this._subscribeEvents(true);
	}

	onDisable() {
		this._subscribeEvents(false);
	}

	private _subscribeEvents(isOn: boolean): void {
		const func: string = isOn ? 'on' : 'off';

		gameEventTarget[func](GameEvent.CORRECT_VELOCITY, this.onCorrectVelocity, this);
	}

	onCorrectVelocity(pos3d: Vec3, radius: number, velocity: Vec3, callback: Function) {
		let corrVelocity3d = velocity;
		let corrVelocity = v2(velocity.x, velocity.z);
		const pos = v2(pos3d.x, pos3d.z);

		for (let i = 0; i < this._borderLines.length; i++) {

			const borderLine = this._borderLines[i];

			const centNewPos = v2();
			centNewPos.add(pos).add(corrVelocity).subtract(borderLine.startPos);
			const centOldPos = v2();
			centOldPos.add(pos).subtract(borderLine.startPos);
			const centEnd = v2();
			centEnd.add(borderLine.endPos).subtract(borderLine.startPos);

			const dir = Vec2.normalize(v2(), centEnd);
			const borderLength = centEnd.length();
			const projLenNew = centNewPos.dot(dir);
			const projLenOld = centOldPos.dot(dir);

			if (projLenNew > 0 && projLenNew < borderLength) {

				const projVecNew = Vec2.multiplyScalar(v2(), dir, projLenNew);
				const tangVecNew = Vec2.subtract(v2(), centNewPos, projVecNew);

				const projVecOld = Vec2.multiplyScalar(v2(), dir, projLenOld);
				const tangVecOld = Vec2.subtract(v2(), centOldPos, projVecOld);

				if (tangVecNew.length() < radius && tangVecNew.length() < tangVecOld.length()) {

					const velProjLen = corrVelocity.dot(dir);
					const velProjVec = Vec2.multiplyScalar(v2(), dir, velProjLen);

					corrVelocity = velProjVec;
				}
			}
		}

		for (let i = 0; i < this._borderLines.length; i++) {

			const borderLine = this._borderLines[i];

			if (Intersection2D.lineLine(pos, v2(pos.x + corrVelocity.x, pos.y + corrVelocity.y), borderLine.startPos, borderLine.endPos)) {
				// corrVelocity.x = -velocity.x;
				// corrVelocity.y = -velocity.z;
				corrVelocity.x = 0;
				corrVelocity.y = 0;
			}

		}

		corrVelocity3d.x = corrVelocity.x;
		corrVelocity3d.z = corrVelocity.y;

		callback(corrVelocity3d);
	}

	public recalculateBorders(): void {
		this._borderLines.length = 0;

		if (this._hasPointChildren(this.node)) {
			this._addBorderGroup(this.node.children);
			return;
		}

		this.node.children.forEach(child => {
			if (child.active && this._hasPointChildren(child)) {
				this._addBorderGroup(child.children);
			}
		});
	}

	private _hasPointChildren(node): boolean {
		return node.children.length >= 2 && node.children.every(child => child.children.length === 0);
	}

	private _addBorderGroup(points): void {
		for (let i = 0; i < points.length - 1; i++) {
			this._addBorderLine(points[i].worldPosition, points[i + 1].worldPosition);
		}

		this._addBorderLine(points[points.length - 1].worldPosition, points[0].worldPosition);
	}

	private _addBorderLine(startPos3d: Vec3, endPos3d: Vec3): void {
		this._borderLines.push({
			startPos: v2(startPos3d.x, startPos3d.z),
			endPos: v2(endPos3d.x, endPos3d.z)
		});
	}
}
