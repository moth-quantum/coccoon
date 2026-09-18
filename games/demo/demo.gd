extends Node

# Demo — quantum terrain generation, and a tutorial introduction to coccoon.
#
# Coccoon renders to a virtual 32×18 cell grid. Each cell holds a sprite.
# The engine and the MicroMoth quantum simulator are Godot autoloads, so you
# never import or instantiate them — just use `coccoon` and `MicroMoth` anywhere.
#
# This demo fills the screen with terrain tiles whose type is determined
# cell-by-cell by a single-qubit quantum circuit. Arrow keys scroll the camera
# through an infinite world. The quantum logic is identical to the
# 'first-quantum-game' notebook in the Qiskit textbook and its qisge port;
# only the engine calls change.

var _images
var _sprites: Dictionary = {}
var _pos_x: int = 0
var _pos_y: int = 0

const TERRAIN_TYPES := 6

# Six random seed values in (0, 0.5), generated once at startup.
# They parameterise the rotation angles so every run produces a different landscape.
# Use a fixed seed (e.g. set all entries manually) to get the same world each time.
var _s: Array = []


func _ready() -> void:
	# ── Images ────────────────────────────────────────────────────────────────
	# ImageList maps integer indices to image files (or Color values — passing a
	# Color instead of a path creates a solid-colour texture, no file needed).
	# The index is just the position in this array: whatever is at index 0 is
	# image 0, and so on. You can list the same file twice to give it a second
	# alias index (see index 4 below), which is convenient when terrain logic
	# assigns different numeric categories to what is visually the same tile.
	_images = coccoon.ImageList.new([
		"games/demo/images/terrain-water.png",        # 0
		"games/demo/images/terrain-red-flower.png",   # 1
		"games/demo/images/terrain-grass.png",        # 2
		"games/demo/images/terrain-path.png",         # 3
		"games/demo/images/terrain-grass.png",        # 4  (listed twice for convenience)
		"games/demo/images/terrain-purple-flower.png", # 5
		"games/demo/images/terrain-tree.png",         # 6
	])

	# Six seed values — one for each rotation parameter in _get_image_id.
	for i in range(6):
		_s.append(0.5 * randf())

	# ── Sprites ───────────────────────────────────────────────────────────────
	# Sprite.new(image_id, x, y, z) places a sprite on the grid.
	# x runs 0 (left) to 31 (right); y runs 0 (BOTTOM) to 17 (TOP) — note the
	# y-axis is inverted relative to screen pixels. z controls draw order.
	#
	# We create exactly one sprite per screen cell and never move them. Scrolling
	# is achieved by changing each sprite's image_id to reflect the new world
	# position, not by repositioning nodes. This avoids unnecessary Godot scene
	# tree operations and keeps the frame budget flat regardless of world size.
	for dx in range(0, coccoon.GRID_W):
		for dy in range(0, coccoon.GRID_H):
			_sprites[str(dx) + "," + str(dy)] = coccoon.Sprite.new(1, float(dx), float(dy), 1)

	_refresh_terrain()


# ── Quantum terrain ────────────────────────────────────────────────────────────
#
# We want a function that maps a world position (x, y) to one of six terrain
# images. A classical hash would work, but we use a single-qubit quantum circuit
# instead — both because it produces naturally smooth, varied landscapes and
# because it demonstrates the core MicroMoth API.
#
# A single qubit can be visualised as a point on the Bloch sphere. Rx, Rz, and
# Ry rotate that point around the X, Z, and Y axes respectively. By choosing
# rotation angles that depend on (x, y), different world positions steer the
# qubit to different points on the sphere, giving different probabilities of
# measuring |0⟩.
#
# Using three rotations (Rx then Rz then Ry) rather than one gives richer
# variation: a single Ry(ty) can only produce terrain that varies along one
# linear combination of x and y, while the three-rotation sequence can reach
# any point on the Bloch sphere and mixes x and y in two independent ways.
#
# The probability of |0⟩ lies in [0, 1], so multiplying by (TERRAIN_TYPES - 1)
# and rounding maps it to a discrete index 0–5 without any if/else branching.
#
# The seed values _s make every run different. Fix them (e.g. all 0.1) to get a
# reproducible world for testing.
func _get_image_id(x: int, y: int) -> int:
	var qc := MicroMoth.QuantumCircuit.new(1)

	# Position-dependent rotation angles, scaled so the terrain varies smoothly.
	var tx: float = (_s[0] * x + _s[1] * y) * PI / 7.0
	var ty: float = (_s[2] * x - _s[3] * y) * PI / 7.0
	var tz: float = (_s[4] * (x + y) + _s[5] * (x - y)) * PI / 7.0

	qc.rx(tx, 0)
	qc.rz(tz, 0)
	qc.ry(ty, 0)

	# "probabilities_dict" returns the exact Born-rule probabilities derived from
	# the statevector — no randomness, same result every call for the same circuit.
	# The dictionary keys are bitstrings: "0" and "1" for a 1-qubit circuit.
	# Use "counts" or "memory" instead if you want genuine random sampling.
	# shots=1024 is conventional for probabilities_dict; the value is ignored
	# for the exact calculation but kept for API consistency.
	var probs: Dictionary = MicroMoth.simulate(qc, 1024, "probabilities_dict")
	return int(round(probs.get("0", 0.0) * (TERRAIN_TYPES - 1)))


# Redraw every tile: the sprite at screen position (dx, dy) shows the terrain
# at world position (pos_x + dx, pos_y + dy).
func _refresh_terrain() -> void:
	for dx in range(0, coccoon.GRID_W):
		for dy in range(0, coccoon.GRID_H):
			_sprites[str(dx) + "," + str(dy)].image_id = _get_image_id(_pos_x + dx, _pos_y + dy)


# ── Input ──────────────────────────────────────────────────────────────────────
# coccoon.update() must be called once per frame. It returns a dictionary:
#   { "key_presses": [...], "clicks": [...] }
# A key code appears in key_presses for every frame the key is held (not just
# the frame it was first pressed). Key codes: 0=up, 1=right, 2=down, 3=left,
# 4=space, 5=W, 6=A, 7=S, 8=D, -1=Escape.
#
# Because _get_image_id runs a quantum circuit for every screen cell, each
# scroll step triggers ~576 single-qubit simulations. That is fast enough for
# step-by-step movement but too slow for smooth per-frame scrolling — which is
# why we move only one cell at a time and only when a key is pressed.
func _process(_delta: float) -> void:
	var inp: Dictionary = coccoon.update()
	var moved := false
	if 0 in inp["key_presses"]:
		_pos_y += 1   # walk up   (world scrolls down)
		moved = true
	if 1 in inp["key_presses"]:
		_pos_x += 1   # walk right
		moved = true
	if 2 in inp["key_presses"]:
		_pos_y -= 1   # walk down
		moved = true
	if 3 in inp["key_presses"]:
		_pos_x -= 1   # walk left
		moved = true
	if moved:
		_refresh_terrain()
