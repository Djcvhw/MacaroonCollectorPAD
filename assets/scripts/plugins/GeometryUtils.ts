import { Vec3 } from 'cc';

export class GeometryUtils {
	static distanceXZ(a: Vec3, b: Vec3): number {
		const dx = a.x - b.x;
		const dz = a.z - b.z;
		return Math.sqrt(dx * dx + dz * dz);
	}
}
