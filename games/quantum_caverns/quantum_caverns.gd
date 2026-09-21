extends Node

# Quantum Caverns
# Quantum maze game: navigate from start (red) to exit (blue)
# within the step limit. Your previous route stays visible as a dim trail.
#
# This source file doubles as a tutorial for calling the Moth API from a
# coccoon game. Search for "── API" sections to read that part of the story.
# The quantum computation here is quantum blur: a height map is scattered with
# random peaks, then blurred by rotating each qubit on the Bloch sphere. Values
# above 0.5 after blurring become walls; the rest become paths. The blur-core-v1
# engine on the Moth platform performs the same calculation on real quantum
# hardware or a cloud simulator, depending on availability.

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

var _generating: bool = false       # true only during the very first maze
var _anim_tick: int = 0
var _prefetching: bool = false      # background fetch of next maze is running
var _next_maze_height: Dictionary = {}
var _next_maze_ready: bool = false
var _waiting_for_next: bool = false # player finished; waiting for prefetch

# HTTPRequest is Godot's built-in async HTTP node. One instance handles one
# request at a time — await request_completed before issuing the next one.
# We use a single node here because all requests (submit, poll, download) run
# sequentially inside coroutines and never overlap.
var _http: HTTPRequest
var _loading_text

const _API_BASE := "https://api.mothquantum.com"


func _ready() -> void:
	_images = coccoon.ImageList.new([
		Color(0.15, 0.50, 0.15),  # 0 path
		Color(0.60, 0.30, 0.00),  # 1 wall
		Color(0.10, 0.25, 0.90),  # 2 beam-out point
		Color(0.90, 0.10, 0.10),  # 3 player
		Color(0.15, 0.15, 0.15),  # 4 outside maze
		Color(0.05, 0.22, 0.05),  # 5 path dim (last loop trail)
	])
	_http = HTTPRequest.new()
	add_child(_http)
	for dx in range(VIEW_W):
		for sy in range(VIEW_H):
			_tiles[Vector2i(dx, sy)] = coccoon.Sprite.new(
				IMG_OUTSIDE, float(dx), float(VIEW_H - sy), 0)
	_status_text = coccoon.Text.new(
		"Generating quantum maze", VIEW_W, 1, 0, 0,
		16, Color.WHITE, Color(0.05, 0.05, 0.15))
	_loading_text = coccoon.Text.new(
		"Reach the exit (blue) from the start (red) within the step limit.\n\n" +
		"Your previous route stays visible as a trail.\n\n" +
		"Arrow keys to move\n" +
		"Space for a new maze\n" +
		"Esc to return to menu",
		26.0, 7.0, 3.0, 5.0, 14, Color(0.75, 0.8, 1.0), Color(0.06, 0.06, 0.18))
	_start_generation()


# ── Generation dispatcher ────────────────────────────────────────────────────
#
# _start_generation is an async coroutine (it contains "await"). Calling it
# without "await" — as _ready does — launches it as a background coroutine and
# returns immediately. The _generating flag keeps _process from doing anything
# until the coroutine finishes and clears it.
#
# Once the first maze is built, _prefetch_next fires in the same way: a
# fire-and-forget coroutine that silently generates the next maze while the
# player is playing, so the transition on Space is instant (or nearly so).

func _start_generation() -> void:
	_generating = true
	_anim_tick = 0
	_status_text.text = "Generating quantum maze"
	var height := await _gen_height(coccoon.get_api_key())
	_build_maze(height)
	_generating = false
	_loading_text.set_font_color(Color(0, 0, 0, 0))
	_loading_text.set_background_color(Color(0, 0, 0, 0))
	_reset_loop()
	_prefetch_next()  # fire-and-forget


func _prefetch_next() -> void:
	if _prefetching or _next_maze_ready:
		return
	_prefetching = true
	_next_maze_height = await _gen_height(coccoon.get_api_key())
	_next_maze_ready = true
	_prefetching = false


func _apply_next_maze() -> void:
	_build_maze(_next_maze_height)
	_next_maze_height = {}
	_next_maze_ready = false
	_waiting_for_next = false
	_reset_loop()
	_prefetch_next()


# ── Height generation ────────────────────────────────────────────────────────
#
# _gen_height is the single entry point for both code paths. It tries the API
# first if a key is available, then falls back to the local QuantumBlur
# implementation. Callers never need to know which path ran.
#
# The API key is stored at the engine level and entered via the coccoon menu —
# games retrieve it with coccoon.get_api_key(). That keeps credential handling
# out of game code entirely.

func _gen_height(key: String) -> Dictionary:
	if key.length() > 0:
		var h: Variant = await _gen_height_api(key)
		if h is Dictionary and not h.is_empty():
			return h
	return _gen_height_local()


func _make_initial_height() -> Dictionary:
	var height: Dictionary = {}
	for x in range(L):
		for y in range(L):
			height[Vector2i(x, y)] = 0.0
	for _i in range(L):
		height[Vector2i(randi() % L, randi() % L)] = randf()
	return height


# ── API: submitting a job ────────────────────────────────────────────────────
#
# The Moth API follows an async job model: you POST a request, receive a job_id
# immediately (HTTP 202 Accepted), then poll a separate endpoint until the job
# finishes. This is standard for quantum workloads because circuit execution
# time is variable and can involve a queue.
#
# blur-core-v1 takes:
#   params.values   — the input grid as a nested array (row-major, floats 0–1)
#   params.strength — how much blur to apply (0 = none, 1 = maximum; 0.25 here
#                     matches one Rx(π/8) rotation per qubit in QuantumBlur)
#
# All Moth API requests carry a Bearer token in the Authorization header. The
# token is the raw API key string — no extra encoding needed.

func _gen_height_api(key: String) -> Variant:
	var height := _make_initial_height()
	var body := JSON.stringify({
		"params": {
			"values": _height_to_array(height),
			"strength": 0.25,
		}
	})
	var err := _http.request(
		_API_BASE + "/api/v1/engines/blur-core-v1/process",
		PackedStringArray([
			"Authorization: Bearer " + key,
			"Content-Type: application/json",
		]),
		HTTPClient.METHOD_POST, body)
	if err != OK:
		return null

	# await suspends this coroutine until the HTTP node signals completion.
	# resp = [result_code, http_status, headers, body_as_PackedByteArray]
	var resp: Array = await _http.request_completed
	if resp[1] != 202:
		return null

	var parsed: Variant = JSON.parse_string(resp[3].get_string_from_utf8())
	if not (parsed is Dictionary) or not parsed.has("job_id"):
		return null

	# Hand off to the polling loop, which returns the raw result data.
	var result_data: Variant = await _poll_job(key, parsed["job_id"])
	if result_data == null:
		return null
	return _extract_height(result_data)


# ── API: polling for completion ──────────────────────────────────────────────
#
# GET /api/v1/jobs/{job_id} returns the job's current status. We wait half a
# second between polls to avoid hammering the API. A 32×32 blur job typically
# completes in a few seconds; the 60-attempt ceiling (30 s) is a safety net.
#
# When the job is complete the response contains either:
#   result  — the output data inline as a JSON value, or
#   outputs — an array of OutputItems each with a presigned "url" for download.
# We check both, in that order.

func _poll_job(key: String, job_id: String) -> Variant:
	var get_headers := PackedStringArray(["Authorization: Bearer " + key])
	for _attempt in range(60):
		await get_tree().create_timer(0.5).timeout
		var err := _http.request(
			_API_BASE + "/api/v1/jobs/" + job_id,
			get_headers, HTTPClient.METHOD_GET)
		if err != OK:
			return null
		var resp: Array = await _http.request_completed
		if resp[1] != 200:
			return null
		var parsed: Variant = JSON.parse_string(resp[3].get_string_from_utf8())
		if not (parsed is Dictionary):
			return null
		var status: String = str(parsed.get("status", ""))
		if status in ["completed", "succeeded", "done"]:
			if parsed.get("result") != null:
				return parsed["result"]
			var outputs = parsed.get("outputs")
			if outputs is Array and outputs.size() > 0:
				var url: String = str(outputs[0].get("url", ""))
				if url.length() > 0:
					return await _download_json(url)
			return null
		elif status in ["failed", "error", "cancelled"]:
			return null
	return null


# Presigned URLs are plain HTTPS GETs — no auth header required.
func _download_json(url: String) -> Variant:
	var err := _http.request(url, PackedStringArray(), HTTPClient.METHOD_GET)
	if err != OK:
		return null
	var resp: Array = await _http.request_completed
	if resp[1] != 200:
		return null
	return JSON.parse_string(resp[3].get_string_from_utf8())


# ── Array ↔ height map conversion ───────────────────────────────────────────
#
# The API works with nested arrays (row-major, y outer / x inner). The game
# uses a Dictionary keyed by Vector2i for O(1) lookup. These two helpers
# convert between the two representations.

func _height_to_array(height: Dictionary) -> Array:
	var arr: Array = []
	for y in range(L):
		var row: Array = []
		for x in range(L):
			row.append(height[Vector2i(x, y)])
		arr.append(row)
	return arr


# The API result may be a bare nested array, or a Dictionary wrapping it under
# "values" or "result". We accept all three shapes defensively.
func _extract_height(data: Variant) -> Dictionary:
	var arr: Variant = null
	if data is Array:
		arr = data
	elif data is Dictionary:
		arr = data.get("values", data.get("result", null))
	if not (arr is Array) or arr.size() == 0:
		return {}
	var height: Dictionary = {}
	for y in range(mini(L, arr.size())):
		var row = arr[y]
		for x in range(mini(L, row.size())):
			height[Vector2i(x, y)] = float(row[x])
	return height


# ── Local fallback ───────────────────────────────────────────────────────────
#
# When no API key is set (or the API call fails), we run the same quantum blur
# locally using QuantumBlur, coccoon's built-in statevector simulator.
# QuantumBlur.height2circuit encodes the height map into a quantum circuit;
# rx(PI * 0.125) per qubit applies the blur; circuit2height reads the result
# back out. strength=0.25 in the API maps to this rotation angle.

func _gen_height_local() -> Dictionary:
	var height := _make_initial_height()
	var qc = QuantumBlur.height2circuit(height, L)
	for j in range(qc.num_qubits):
		qc.rx(PI * 0.125, j)
	return QuantumBlur.circuit2height(qc, L, L, true)


# ── Maze construction from height map ────────────────────────────────────────
#
# The blurred height map is thresholded at 0.5: cells above become walls,
# cells below become paths. The border is forced to walls. We then keep only
# the largest connected component of path cells so the maze is always a single
# navigable region, and run a double BFS to find the two farthest points in
# that region — those become start and end. The step limit is the BFS distance
# between them plus a small margin.

func _build_maze(new_height: Dictionary) -> void:
	_maze.clear()
	for x in range(L):
		for y in range(L):
			var pos := Vector2i(x, y)
			if x == 0 or x == L - 1 or y == 0 or y == L - 1:
				_maze[pos] = 1
			else:
				_maze[pos] = 1 if new_height.get(pos, 1.0) > 0.5 else 0

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


# ── Graph helpers ────────────────────────────────────────────────────────────

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


# ── Game loop ────────────────────────────────────────────────────────────────

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
		_status_text.text = "You made it out! Space = new maze."
	else:
		_status_text.text = str(_max_steps - _step) + " steps to reach the exit."

func _process(_delta: float) -> void:
	if _generating:
		_anim_tick += 1
		if _anim_tick % 10 == 0:
			_status_text.text = "Generating quantum maze" + ".".repeat((_anim_tick / 10) % 4)
		return

	if _waiting_for_next:
		_anim_tick += 1
		if _anim_tick % 10 == 0:
			_status_text.text = "Generating quantum maze" + ".".repeat((_anim_tick / 10) % 4)
		if _next_maze_ready:
			_apply_next_maze()
		return

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
			if _next_maze_ready:
				_apply_next_maze()
			else:
				_waiting_for_next = true
				_anim_tick = 0
				_status_text.text = "Generating quantum maze"
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
