extends Node

# Q-Snake — port of the Qiskit Camp Europe 2019 hackathon game
# Standard snake with a quantum twist:
#   • hitting the barrier triggers a quantum coin flip — tunnel or die
#   • apple positions chosen with quantum randomness

const OX  = 8
const OY  = 1
const PIX = 2

const IMG_OFF    = 0   # brightness 0
const IMG_DIM    = 1   # brightness 1  (barrier)
const IMG_MED    = 2   # brightness 2  (apple)
const IMG_BRIGHT = 3   # brightness 3  (snake)
const IMG_BG     = 4   # menu blue (border)

# Barrier cells (x, y) — horizontal strip at y=4, x=4..6
const BARRIER = [[4, 4], [5, 4], [6, 4]]

var _images
var _bg_sprs:  Dictionary = {}
var _led_sprs: Array      = []
var _status_text
var _over_text

var _screen: Array = []

var _snake:      Array = []
var _dx:         int   = 1
var _dy:         int   = 0
var _apple_x:    int   = 6
var _apple_y:    int   = 6
var _game_speed: float = 5.0
var _move_accum: float = 0.0
var _points:     int   = 0

var _alive:     bool  = true
var _started:   bool  = false   # waits for first directional input
var _prev_keys: Array = []


func _ready() -> void:
	_images = coccoon.ImageList.new([
		Color(0.0,  0.0,  0.0 ),   # 0 off
		Color(0.25, 0.25, 0.25),   # 1 dim  (barrier)
		Color(0.6,  0.6,  0.6 ),   # 2 mid  (apple)
		Color(1.0,  1.0,  1.0 ),   # 3 bright (snake)
		Color(0.05, 0.05, 0.15),   # 4 menu blue (border)
	])

	for cx in range(coccoon.GRID_W):
		for cy in range(coccoon.GRID_H):
			_bg_sprs[Vector2i(cx, cy)] = coccoon.Sprite.new(IMG_BG, float(cx), float(cy), 0)

	for py in range(8):
		for px in range(8):
			var sx := float(OX + px * PIX)
			var sy := float(OY + (7 - py) * PIX)
			_led_sprs.append(coccoon.Sprite.new(IMG_OFF, sx, sy, 1, float(PIX)))

	_status_text = coccoon.Text.new(
		"", coccoon.GRID_W, 1, 0, 0, 16, Color.WHITE, Color(0.05, 0.05, 0.15))

	_over_text = coccoon.Text.new(
		"", coccoon.GRID_W, coccoon.GRID_H, 0, 0, 28,
		Color(0.0, 0.0, 0.0, 0.0), Color(0.0, 0.0, 0.0, 0.0))

	_start_game()


func _start_game() -> void:
	_snake      = [[3, 3]]
	_dx         = 0
	_dy         = 0
	_started    = false
	_apple_x    = 6
	_apple_y    = 6
	_game_speed = 5.0
	_move_accum = 0.0
	_points     = 0
	_alive      = true

	_screen = []
	for _i in range(8):
		_screen.append([0, 0, 0, 0, 0, 0, 0, 0])

	_pix(_apple_x, _apple_y, IMG_MED)
	_draw_barrier()
	_over_text.set_font_color(Color(0.0, 0.0, 0.0, 0.0))
	_over_text.set_background_color(Color(0.0, 0.0, 0.0, 0.0))
	_render()


func _pix(px: int, py: int, brightness: int) -> void:
	if px < 0 or px >= 8 or py < 0 or py >= 8:
		return
	_screen[py][px] = brightness


func _draw_barrier() -> void:
	for cell in BARRIER:
		_pix(cell[0], cell[1], IMG_DIM)


# Quantum random: n shots of H+measure → n-bit integer (0 to 2^n - 1)
func _qrand(nbits: int) -> int:
	var qc := MicroMoth.QuantumCircuit.new(1, 1)
	qc.h(0)
	qc.measure(0, 0)
	var mem: Array = MicroMoth.simulate(qc, nbits, "memory")
	var result: int = 0
	for i in range(nbits):
		result = result * 2 + mem[i].to_int()
	return result


func _apple_blocked() -> bool:
	for seg in _snake:
		if seg[0] == _apple_x and seg[1] == _apple_y:
			return true
	for cell in BARRIER:
		if cell[0] == _apple_x and cell[1] == _apple_y:
			return true
	return false


func _render() -> void:
	for py in range(8):
		for px in range(8):
			_led_sprs[py * 8 + px].image_id = _screen[py][px]
	_status_text.text = "points  " + str(_points)


func _process(delta: float) -> void:
	var keys: Array = coccoon.update()["key_presses"]

	if not _alive:
		var just_pressed: Array = []
		for k in keys:
			if k not in _prev_keys:
				just_pressed.append(k)
		_prev_keys = keys.duplicate()
		if just_pressed.size() > 0:
			_start_game()
		return

	if 0 in keys and _dy == 0:
		_dx = 0;  _dy = -1;  _started = true
	elif 3 in keys and _dx == 0:
		_dx = -1; _dy = 0;   _started = true
	elif 1 in keys and _dx == 0:
		_dx = 1;  _dy = 0;   _started = true
	elif 2 in keys and _dy == 0:
		_dx = 0;  _dy = 1;   _started = true

	_prev_keys = keys.duplicate()

	if not _started:
		return

	_move_accum += delta
	if _move_accum < 1.0 / _game_speed:
		return
	_move_accum -= 1.0 / _game_speed

	# Redraw barrier each step (it may have been overwritten by snake)
	_draw_barrier()

	var head: Array = _snake[_snake.size() - 1]
	_pix(head[0], head[1], IMG_BRIGHT)
	_render()

	var nx: int = head[0] + _dx
	var ny: int = head[1] + _dy

	# Wall collision
	if nx < 0 or nx > 7 or ny < 0 or ny > 7:
		_die()
		return

	# Self collision
	for seg in _snake:
		if seg[0] == nx and seg[1] == ny:
			_die()
			return

	# Barrier collision — quantum tunneling test
	var on_barrier := false
	for cell in BARRIER:
		if cell[0] == nx and cell[1] == ny:
			on_barrier = true
			break
	if on_barrier and _qrand(3) < 3:
		_die()
		return

	_snake.append([nx, ny])

	if nx == _apple_x and ny == _apple_y:
		_pix(_apple_x, _apple_y, IMG_OFF)
		_apple_x = _snake[0][0]
		_apple_y = _snake[0][1]
		while _apple_blocked():
			_apple_x = _qrand(3)
			_apple_y = _qrand(3)
		_pix(_apple_x, _apple_y, IMG_MED)
		_game_speed += 0.2
		_points += 1
	else:
		var tail: Array = _snake.pop_front()
		_pix(tail[0], tail[1], IMG_OFF)

	# Redraw barrier in case snake body covered it
	_draw_barrier()
	_render()


func _die() -> void:
	for seg in _snake:
		_pix(seg[0], seg[1], IMG_OFF)
	_pix(_apple_x, _apple_y, IMG_OFF)
	_render()
	_alive = false
	_over_text.text = "GAME OVER\n\npoints  " + str(_points) + "\n\nany key"
	_over_text.set_background_color(Color(0.0, 0.0, 0.0, 0.75))
	_over_text.set_font_color(Color.WHITE)
