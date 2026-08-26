import { MeshRenderer, Node, SpriteRenderer } from 'cc';

type MaterialWithPasses = {
	passes?: {
		setPriority?: (priority: number) => void;
	}[];
};

export class RenderPriority {
	static set(node: Node, priority: number) {
		node.getComponentsInChildren(MeshRenderer).forEach(renderer => {
			this._setMaterialPriority(renderer.getMaterialInstance(0), priority);
		});

		node.getComponentsInChildren(SpriteRenderer).forEach(renderer => {
			renderer.priority = priority;
			this._setMaterialPriority(renderer.getMaterialInstance(0), priority);
		});
	}

	private static _setMaterialPriority(material: unknown, priority: number) {
		const materialWithPasses = material as MaterialWithPasses | null;
		if (!materialWithPasses?.passes) {
			return;
		}

		materialWithPasses.passes.forEach(pass => {
			pass.setPriority?.(priority);
		});
	}
}
