extends Node

var _images
var _sprites: Dictionary = {}
var _pos_x: int = 0
var _pos_y: int = 0

const TERRAIN_TYPES := 6
var _s: Array = []

func _ready() -> void:
	_images = coccoon.ImageList.new([
		"games/demo/images/terrain-water.png",
		"games/demo/images/terrain-red-flower.png",
		"games/demo/images/terrain-grass.png",
		"games/demo/images/terrain-path.png",
		"games/demo/images/terrain-grass.png",
		"games/demo/images/terrain-purple-flower.png",
		"games/demo/images/terrain-tree.png",
	])

	for i in range(6):
		_s.append(0.5 * randf())

	for dx in range(0, coccoon.GRID_W):
		for dy in range(0, coccoon.GRID_H):
			_sprites[str(dx) + "," + str(dy)] = coccoon.Sprite.new(1, float(dx), float(dy), 1)

	_refresh_terrain()

func _get_image_id(x: int, y: int) -> int:
	var qc := MicroMoth.QuantumCircuit.new(1)
	var tx: float = (_s[0] * x + _s[1] * y) * PI / 7.0
	var ty: float = (_s[2] * x - _s[3] * y) * PI / 7.0
	var tz: float = (_s[4] * (x + y) + _s[5] * (x - y)) * PI / 7.0
	qc.rx(tx, 0)
	qc.rz(tz, 0)
	qc.ry(ty, 0)
	var probs: Dictionary = MicroMoth.simulate(qc, 1024, "probabilities_dict")
	return int(round(probs.get("0", 0.0) * (TERRAIN_TYPES - 1)))

func _refresh_terrain() -> void:
	for dx in range(0, coccoon.GRID_W):
		for dy in range(0, coccoon.GRID_H):
			_sprites[str(dx) + "," + str(dy)].image_id = _get_image_id(_pos_x + dx, _pos_y + dy)

func _process(_delta: float) -> void:
	var inp: Dictionary = coccoon.update()
	var moved := false
	if 0 in inp["key_presses"]:
		_pos_y += 1
		moved = true
	if 1 in inp["key_presses"]:
		_pos_x += 1
		moved = true
	if 2 in inp["key_presses"]:
		_pos_y -= 1
		moved = true
	if 3 in inp["key_presses"]:
		_pos_x -= 1
		moved = true
	if moved:
		_refresh_terrain()
