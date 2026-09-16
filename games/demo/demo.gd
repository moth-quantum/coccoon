extends Node

# Demo — a quantum terrain generator and a tutorial introduction to coccoon.
#
# The screen is a 32×18 grid of cells. Each cell holds a sprite. Arrow keys
# scroll the camera through an infinite world whose terrain is determined
# cell-by-cell using a single-qubit quantum circuit.
#
# This is the coccoon version of the 'first-quantum-game' notebook from the
# Qiskit textbook, ported from qisge. The quantum logic is identical; only
# the engine calls change.

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
	# Tell the engine which image files to use. Each entry gets an index
	# matching its position in this list — the same list as in the notebook.
	# index 0 = water, 1 = red flower, 2 = grass, 3 = path,
	# 4 = grass again (convenient alias), 5 = purple flower, 6 = tree
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
	# Create one sprite per cell covering the whole screen.
	# All start on image index 1; _refresh_terrain() will set the real values.
	# Sprites stay fixed on screen — scrolling works by changing which world
	# position each sprite represents, not by moving the sprites themselves.
	for dx in range(0, coccoon.GRID_W):
		for dy in range(0, coccoon.GRID_H):
			_sprites[str(dx) + "," + str(dy)] = coccoon.Sprite.new(1, float(dx), float(dy), 1)

	_refresh_terrain()


# ── Quantum terrain ────────────────────────────────────────────────────────────
#
# This is the heart of the demo. We want a function that maps a world position
# (x, y) to one of our six terrain images. We use a single-qubit quantum circuit
# to do it.
#
# The idea: rotate a qubit by angles that depend on (x, y), then read the
# probability of measuring |0⟩. That probability lies in [0, 1], so multiplying
# by (TERRAIN_TYPES - 1) and rounding gives a discrete image index 0–5.
#
# Rx, Rz, Ry together can reach any point on the Bloch sphere, so the
# combination of position-dependent angles produces a varied, continuous
# landscape rather than a simple repeating pattern.
#
# The seed values _s make the landscape different every run. Change them (or
# fix them) to explore different worlds.
func _get_image_id(x: int, y: int) -> int:
	var qc := MicroMoth.QuantumCircuit.new(1)

	# Position-dependent rotation angles, scaled so the terrain varies smoothly.
	var tx: float = (_s[0] * x + _s[1] * y) * PI / 7.0
	var ty: float = (_s[2] * x - _s[3] * y) * PI / 7.0
	var tz: float = (_s[4] * (x + y) + _s[5] * (x - y)) * PI / 7.0

	qc.rx(tx, 0)
	qc.rz(tz, 0)
	qc.ry(ty, 0)

	# Simulate the circuit and read the probability of outcome '0'.
	var probs: Dictionary = MicroMoth.simulate(qc, 1024, "probabilities_dict")
	return int(round(probs.get("0", 0.0) * (TERRAIN_TYPES - 1)))


# Redraw every tile: the sprite at screen position (dx, dy) shows the terrain
# at world position (pos_x + dx, pos_y + dy).
func _refresh_terrain() -> void:
	for dx in range(0, coccoon.GRID_W):
		for dy in range(0, coccoon.GRID_H):
			_sprites[str(dx) + "," + str(dy)].image_id = _get_image_id(_pos_x + dx, _pos_y + dy)


# ── Input ──────────────────────────────────────────────────────────────────────
# Arrow keys scroll the camera. Because terrain generation runs a quantum
# circuit for every cell on screen, movement triggers ~576 single-qubit
# simulations — so scrolling is intentionally step-by-step rather than smooth.
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
