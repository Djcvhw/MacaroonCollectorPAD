import { _decorator, BoxCollider, Component, Intersection2D, Node, RigidBody, v2, Vec2, Vec3 } from 'cc';
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
	private _playablePolygon: Vec2[] = [];
	private _physicsWalls: Node[] = [];
	// Tall enough for the fully physical multi-layer piles. The wall begins at Y=0.
	private readonly _wallHeight = 8;
	private readonly _wallThickness = 0.4;

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
		this._playablePolygon.length = 0;
		this._collectBorderGroups(this.node);
		this._rebuildPhysicsWalls();
	}

	/** True only inside the closed Fence contour, with clearance from its physical wall. */
	public containsPlayablePosition(worldPosition: Vec3, clearance = 0): boolean {
		if (this._playablePolygon.length === 0) this.recalculateBorders();
		if (this._playablePolygon.length < 3) {
			console.error('[Borders] Playable fence contour is invalid: at least three points are required.');
			return false;
		}
		const point = v2(worldPosition.x, worldPosition.z);
		let inside = false;
		for (let index = 0, previous = this._playablePolygon.length - 1; index < this._playablePolygon.length; previous = index++) {
			const currentPoint = this._playablePolygon[index];
			const previousPoint = this._playablePolygon[previous];
			if ((currentPoint.y > point.y) !== (previousPoint.y > point.y)
				&& point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) / (previousPoint.y - currentPoint.y) + currentPoint.x) inside = !inside;
		}
		if (!inside) return false;
		for (let index = 0; index < this._playablePolygon.length; index++) {
			const start = this._playablePolygon[index];
			const end = this._playablePolygon[(index + 1) % this._playablePolygon.length];
			if (this._distanceToSegment(point, start, end) < clearance) return false;
		}
		return true;
	}

	private _rebuildPhysicsWalls(): void {
		this._physicsWalls.forEach(wall => wall.destroy());
		this._physicsWalls.length = 0;
		this._borderLines.forEach(line => {
			const dx = line.endPos.x - line.startPos.x;
			const dz = line.endPos.y - line.startPos.y;
			const length = Math.sqrt(dx * dx + dz * dz);
			if (length <= 0.001) return;
			const wall = new Node('PhysicsBorder');
			wall.parent = this.node;
			wall.setWorldPosition((line.startPos.x + line.endPos.x) * 0.5, this._wallHeight * 0.5, (line.startPos.y + line.endPos.y) * 0.5);
			wall.setRotationFromEuler(0, -Math.atan2(dz, dx) * 180 / Math.PI, 0);
			wall.addComponent(RigidBody).type = RigidBody.Type.STATIC;
			const collider = wall.addComponent(BoxCollider);
			collider.size = new Vec3(length, this._wallHeight, this._wallThickness);
			this._physicsWalls.push(wall);
		});
	}

	private _collectBorderGroups(node): void {
		if (!node.active) return;

		if (this._hasPointChildren(node)) {
			this._addBorderGroup(node.children);
			return;
		}

		node.children.forEach(child => this._collectBorderGroups(child));
	}

	private _hasPointChildren(node): boolean {
		return node.children.length >= 2 && node.children.every(child => child.children.length === 0);
	}

	private _addBorderGroup(points): void {
		const worldPoints = points.map(point => v2(point.worldPosition.x, point.worldPosition.z));
		for (let i = 0; i < points.length - 1; i++) {
			this._addBorderLine(points[i].worldPosition, points[i + 1].worldPosition);
		}

		// A two-point group is an open segment (for example, a gate).
		// Three or more points form a closed fence loop.
		if (points.length > 2) {
			this._addBorderLine(points[points.length - 1].worldPosition, points[0].worldPosition);
			if (this._polygonArea(worldPoints) > this._polygonArea(this._playablePolygon)) this._playablePolygon = worldPoints;
		}
	}

	private _polygonArea(points: Vec2[]): number {
		let area = 0;
		for (let index = 0; index < points.length; index++) {
			const next = points[(index + 1) % points.length];
			area += points[index].x * next.y - next.x * points[index].y;
		}
		return Math.abs(area) * 0.5;
	}

	private _distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
		const dx = end.x - start.x;
		const dy = end.y - start.y;
		const lengthSq = dx * dx + dy * dy;
		if (lengthSq <= 0.000001) return Vec2.distance(point, start);
		const progress = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
		const nearestX = start.x + dx * progress;
		const nearestY = start.y + dy * progress;
		const distanceX = point.x - nearestX;
		const distanceY = point.y - nearestY;
		return Math.sqrt(distanceX * distanceX + distanceY * distanceY);
	}

	private _addBorderLine(startPos3d: Vec3, endPos3d: Vec3): void {
		this._borderLines.push({
			startPos: v2(startPos3d.x, startPos3d.z),
			endPos: v2(endPos3d.x, endPos3d.z)
		});
	}
}
