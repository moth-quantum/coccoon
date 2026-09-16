extends Node

# Snake — port of the PewPew original
# 8×8 LED grid, brightness 0–3 (monochrome)

const OX  = 8    # left edge of display in coccoon cells
const OY  = 1    # bottom edge of display in coccoon cells
const PIX = 2    # coccoon cells per LED pixel

const IMG_OFF    = 0   # brightness 0
const IMG_DIM    = 1   # brightness 1  (body)
const IMG_MED    = 2   # brightness 2  (apple)
const IMG_BRIGHT = 3   # brightness 3  (head)
const IMG_BG     = 4   # menu blue (non-game border)

var _images
var _bg_sprs:  Dictionary = {}
var _led_sprs: Array      = []   # 64 entries, row-major (y=0 at top)
var _status_text
var _over_text

# Screen buffer — persists between steps, matches PewPew behaviour
var _screen: Array = []   # _screen[py][px] = brightness 0-3

# Game state
var _snake:      Array = []   # [[x,y], …], [0]=tail, [-1]=head
var _dx:         int   = 1
var _dy:         int   = 0
var _apple_x:    int   = 6
var _apple_y:    int   = 4
var _game_speed: float = 4.0   # steps per second
var _move_accum: float = 0.0

var _alive:      bool  = true
var _prev_keys:  Array = []


func _ready() -> void:
	_images = coccoon.ImageList.new([
		Color(0.0,  0.0,  0.0 ),   # 0 off / black (LED dark)
		Color(0.25, 0.25, 0.25),   # 1 dim  (body)
		Color(0.6,  0.6,  0.6 ),   # 2 mid  (apple)
		Color(1.0,  1.0,  1.0 ),   # 3 bright (head)
		Color(0.05, 0.05, 0.15),   # 4 menu blue (border)
	])

	# Blue background across the whole grid (matches menu)
	for cx in range(coccoon.GRID_W):
		for cy in range(coccoon.GRID_H):
			_bg_sprs[Vector2i(cx, cy)] = coccoon.Sprite.new(IMG_BG, float(cx), float(cy), 0)

	# One sprite per LED, size=PIX so each covers 2×2 cells
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
	_snake      = [[2, 4]]
	_dx         = 1
	_dy         = 0
	_apple_x    = 6
	_apple_y    = 4
	_game_speed = 4.0
	_move_accum = 0.0
	_alive      = true

	_screen = []
	for _i in range(8):
		_screen.append([0, 0, 0, 0, 0, 0, 0, 0])

	_pix(_apple_x, _apple_y, IMG_MED)
	_over_text.set_font_color(Color(0.0, 0.0, 0.0, 0.0))
	_over_text.set_background_color(Color(0.0, 0.0, 0.0, 0.0))
	_render()


func _pix(px: int, py: int, brightness: int) -> void:
	_screen[py][px] = brightness


func _render() -> void:
	for py in range(8):
		for px in range(8):
			_led_sprs[py * 8 + px].image_id = _screen[py][px]
	_status_text.text = "score  " + str(_snake.size() - 1)


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

	# Direction — same priority order as original
	if 0 in keys and _dy == 0:
		_dx = 0;  _dy = -1
	elif 3 in keys and _dx == 0:
		_dx = -1; _dy = 0
	elif 1 in keys and _dx == 0:
		_dx = 1;  _dy = 0
	elif 2 in keys and _dy == 0:
		_dx = 0;  _dy = 1

	_prev_keys = keys.duplicate()

	_move_accum += delta
	if _move_accum < 1.0 / _game_speed:
		return
	_move_accum -= 1.0 / _game_speed

	# Draw current head (bright) and second segment (dim) — matches PewPew render step
	if _snake.size() > 1:
		var prev: Array = _snake[_snake.size() - 2]
		_pix(prev[0], prev[1], IMG_DIM)
	var head: Array = _snake[_snake.size() - 1]
	_pix(head[0], head[1], IMG_BRIGHT)
	_render()

	# Advance head
	var nx: int = wrapi(head[0] + _dx, 0, 8)
	var ny: int = wrapi(head[1] + _dy, 0, 8)

	# Self-collision
	for seg in _snake:
		if seg[0] == nx and seg[1] == ny:
			_alive = false
			_over_text.text = "GAME OVER\n\nscore  " + str(_snake.size() - 1) + "\n\nany key"
			_over_text.set_background_color(Color(0.0, 0.0, 0.0, 0.75))
			_over_text.set_font_color(Color.WHITE)
			return

	_snake.append([nx, ny])

	if nx == _apple_x and ny == _apple_y:
		_pix(_apple_x, _apple_y, IMG_OFF)
		_apple_x = _snake[0][0]
		_apple_y = _snake[0][1]
		while _apple_on_snake():
			_apple_x = randi() % 8
			_apple_y = randi() % 8
		_pix(_apple_x, _apple_y, IMG_MED)
		_game_speed += 0.2
	else:
		var tail: Array = _snake.pop_front()
		_pix(tail[0], tail[1], IMG_OFF)

	_render()


func _apple_on_snake() -> bool:
	for seg in _snake:
		if seg[0] == _apple_x and seg[1] == _apple_y:
			return true
	return false
