import { easing, Node, tween, v3, Vec3 } from 'cc';

export class JumpTween {
	static toWorld(node: Node, target: Vec3, duration: number, height: number, onComplete?: () => void) {
		const start = node.worldPosition.clone();
		const end = target.clone();
		this._jump(node, start, end, duration, height, position => node.setWorldPosition(position), onComplete);
	}

	static toLocal(node: Node, target: Vec3, duration: number, height: number, onComplete?: () => void) {
		const start = node.position.clone();
		const end = target.clone();
		this._jump(node, start, end, duration, height, position => node.setPosition(position), onComplete);
	}

	private static _jump(node: Node, start: Vec3, end: Vec3, duration: number, height: number, apply: (position: Vec3) => void, onComplete?: () => void) {
		const state = { t: 0 };
		const position = v3();

		tween(state)
			.to(duration, { t: 1 }, {
				easing: easing.sineOut,
				onUpdate: () => {
					Vec3.lerp(position, start, end, state.t);
					position.y += Math.sin(Math.PI * state.t) * height;
					apply(position);
				}
			})
			.call(() => {
				apply(end);
				onComplete?.();
			})
			.start();
	}
}
