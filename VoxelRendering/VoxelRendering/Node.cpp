#include "Node.h";

Node::Node() {
	terminal = true;
	voxel = Voxel(Color(0, 0, 0, 0), 0, true);
	for (int i = 0; i < 8; i++) {
		children[i] = nullptr;
	}
}

Node::Node(Node* _children[8]) {
	terminal = true;
	bool was = false;
	for (int i = 0; i < 8; i++) {
		children[i] = _children[i];
		if (children[i] != nullptr) {
			terminal &= children[i]->terminal;
			if (terminal && !was) {
				was = true;
				voxel = children[i]->voxel;
			}
			if (terminal && children[i]->voxel != voxel) {
				terminal = false;
			}
		}
	}
}