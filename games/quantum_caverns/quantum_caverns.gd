extends Node

# Quantum Caverns
# Quantum maze game: navigate from start (red) to beam-out point (blue)
# within the step limit. Your previous loop's path stays visible as a dim trail.

const VIEW_W: int = 32
const VIEW_H: int = 17
const L: int = 32

const IMG_PATH     = 0
const IMG_WALL     = 1
const IMG_END      = 2
const IMG_PLAYER   = 3
const IMG_OUTSIDE  = 4
const IMG_PATH_DIM = 5

var _images
var _tiles: Dictionary = {}
var _status_text

var _maze: Dictionary = {}
var _start: Vector2i
var _end: Vector2i
var _max_steps: int
var _player: Vector2i
var _step: int = 0
var _path: Array = []
var _lastpath: Array = []
var _success: bool = false
var _prev_keys: Array = []


func _ready() -> void:
	_images = coccoon.ImageList.new([
		Color(0.15, 0.50, 0.15),  # 0 path
		Color(0.60, 0.30, 0.00),  # 1 wall
		Color(0.10, 0.25, 0.90),  # 2 beam-out point
		Color(0.90, 0.10, 0.10),  # 3 player
		Color(0.15, 0.15, 0.15),  # 4 outside maze
		Color(0.05, 0.22, 0.05),  # 5 path dim (last loop trail)
	])
	for dx in range(VIEW_W):
		for sy in range(VIEW_H):
			_tiles[Vector2i(dx, sy)] = coccoon.Sprite.new(
				IMG_OUTSIDE, float(dx), float(VIEW_H - sy), 0)
	_status_text = coccoon.Text.new(
		"Generating quantum maze...", VIEW_W, 1, 0, 0,
		16, Color.WHITE, Color(0.05, 0.05, 0.15))
	_generate_maze()
	_reset_loop()


# ── Maze generation ─────────────────────────────────────────────────────────

func _generate_maze() -> void:
	var height: Dictionary = {}
	for x in range(L):
		for y in range(L):
			height[Vector2i(x, y)] = 0.0
	for _i in range(L):
		height[Vector2i(randi() % L, randi() % L)] = randf()

	var qc = QuantumBlur.height2circuit(height, L)
	for j in range(qc.num_qubits):
		qc.rx(PI * 0.125, j)
	var new_height: Dictionary = QuantumBlur.circuit2height(qc, L, L, true)

	_maze.clear()
	for x in range(L):
		for y in range(L):
			var pos := Vector2i(x, y)
			if x == 0 or x == L - 1 or y == 0 or y == L - 1:
				_maze[pos] = 1
			else:
				_maze[pos] = 1 if new_height[pos] > 0.5 else 0

	var path_cells: Array = []
	for x in range(L):
		for y in range(L):
			if _maze[Vector2i(x, y)] == 0:
				path_cells.append(Vector2i(x, y))

	var largest: Array = _largest_component(path_cells)
	var largest_set: Dictionary = {}
	for pos in largest:
		largest_set[pos] = true
	for pos in path_cells:
		if not largest_set.has(pos):
			_maze[pos] = 1

	var r1: Array = _bfs(largest[0], largest_set)
	var r2: Array = _bfs(r1[0], largest_set)
	var r3: Array = _bfs(r2[0], largest_set)
	_start = r2[0]
	_end = r3[0]
	_max_steps = r3[1] + 2


# ── Graph helpers ───────────────────────────────────────────────────────────

func _bfs(from: Vector2i, valid: Dictionary) -> Array:
	var dist: Dictionary = {from: 0}
	var queue: Array = [from]
	var head: int = 0
	var farthest: Vector2i = from
	while head < queue.size():
		var pos: Vector2i = queue[head]
		head += 1
		for d in [Vector2i(1,0), Vector2i(-1,0), Vector2i(0,1), Vector2i(0,-1)]:
			var nxt: Vector2i = pos + d
			if valid.has(nxt) and not dist.has(nxt):
				dist[nxt] = dist[pos] + 1
				queue.append(nxt)
				if dist[nxt] > dist[farthest]:
					farthest = nxt
	return [farthest, dist[farthest]]

func _largest_component(cells: Array) -> Array:
	var unvisited: Dictionary = {}
	for pos in cells:
		unvisited[pos] = true
	var largest: Array = []
	while unvisited.size() > 0:
		var start: Vector2i = unvisited.keys()[0]
		var visited: Array = []
		var queue: Array = [start]
		var in_q: Dictionary = {start: true}
		var head: int = 0
		while head < queue.size():
			var pos: Vector2i = queue[head]
			head += 1
			visited.append(pos)
			unvisited.erase(pos)
			for d in [Vector2i(1,0), Vector2i(-1,0), Vector2i(0,1), Vector2i(0,-1)]:
				var nxt: Vector2i = pos + d
				if unvisited.has(nxt) and not in_q.has(nxt):
					in_q[nxt] = true
					queue.append(nxt)
		if visited.size() > largest.size():
			largest = visited
	return largest


# ── Game loop ───────────────────────────────────────────────────────────────

func _reset_loop() -> void:
	_player = _start
	_step = 0
	_path = [_start]
	_success = false
	_render()

func _scroll_y() -> int:
	return clampi(_player.y - VIEW_H / 2, 0, L - VIEW_H)

func _tile_img(pos: Vector2i, in_last: bool) -> int:
	if not _maze.has(pos):
		return IMG_OUTSIDE
	if pos == _player:
		return IMG_PLAYER
	if pos == _end:
		return IMG_END
	if _maze[pos] == 1:
		return IMG_WALL
	return IMG_PATH_DIM if in_last else IMG_PATH

func _render() -> void:
	var sy: int = _scroll_y()
	var lp_set: Dictionary = {}
	for pos in _lastpath:
		lp_set[pos] = true
	for dx in range(VIEW_W):
		for screen_y in range(VIEW_H):
			var maze_pos := Vector2i(dx, sy + screen_y)
			_tiles[Vector2i(dx, screen_y)].image_id = _tile_img(maze_pos, lp_set.has(maze_pos))
	if _success:
		_status_text.text = "Captain O'Brien made it out! Space = new maze."
	else:
		_status_text.text = str(_max_steps - _step) + " steps to reach the beam-out point."

func _process(_delta: float) -> void:
	var inp: Dictionary = coccoon.update()
	var keys: Array = inp["key_presses"]
	var just_pressed: Array = []
	for k in keys:
		if k not in _prev_keys:
			just_pressed.append(k)
	_prev_keys = keys.duplicate()

	if _success:
		if 4 in just_pressed:
			_lastpath = []
			_generate_maze()
			_reset_loop()
		return

	if _step >= _max_steps:
		_lastpath = _path.duplicate()
		_reset_loop()
		return

	var dx: int = 0
	var dy: int = 0
	if 0 in just_pressed: dy = -1
	if 2 in just_pressed: dy = 1
	if 3 in just_pressed: dx = -1
	if 1 in just_pressed: dx = 1

	if dx != 0 or dy != 0:
		var nxt: Vector2i = _player + Vector2i(dx, dy)
		if _maze.get(nxt, 1) == 0:
			_player = nxt
			_step += 1
			_path.append(nxt)
			if _player == _end:
				_success = true
		_render()
