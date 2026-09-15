extends Node

# Benji the Blob — port of the Pico-8 original by Decodoku
# Quantum terrain generation; lead your pet to food, avoid ticks.

const L   = 16    # world-screen size in cells
const OX  = 8     # x offset of 16x16 game area
const OY  = 1     # y offset (status bar at y=0)

const IMG_LAWN       = 0
const IMG_MEADOW     = 1
const IMG_FOREST     = 2
const IMG_SEA        = 3
const IMG_BEACH      = 4
const IMG_SNOW       = 5
const IMG_ROCK       = 6
const IMG_POND       = 7
const IMG_FRUIT      = 8
const IMG_PLAYER     = 9
const IMG_BENJI_FULL = 10
const IMG_BENJI_MED  = 11
const IMG_BENJI_LOW  = 12
const IMG_BENJI_STAR = 13
const IMG_COR        = 14
const IMG_BG         = 15
const IMG_CLEAR      = 16  # transparent — used for empty entity layer cells

var _images
var _tiles:  Dictionary = {}  # terrain layer z=0, full 32x18
var _etiles: Dictionary = {}  # entity layer  z=1, 16x16 game area only
var _status_text

var _seed:   Array      = []
var _tcache: Dictionary = {}  # Vector2i(wx,wy) -> terrain string

var _sx: int = 0
var _sy: int = 0
var _fruit: Array = []        # {wx, wy, active}
var _cor_active: bool = false
var _cor_wx: int = 0
var _cor_wy: int = 0

var _px: float = 7.0
var _py: float = 7.0
var _jx: float = 6.0
var _jy: float = 8.0
var _j_size: float = 0.67

var _title: bool = true
var _prev_keys: Array = []


func _ready() -> void:
	var img := "games/benji_the_blob/images/"
	_images = coccoon.ImageList.new([
		img + "terrain_lawn.png",    # 0
		img + "terrain_meadow.png",  # 1
		img + "terrain_forest.png",  # 2
		img + "terrain_sea.png",     # 3
		img + "terrain_beach.png",   # 4
		img + "terrain_snow.png",    # 5
		img + "terrain_rock.png",    # 6
		img + "terrain_pond.png",    # 7
		img + "fruit.png",           # 8
		img + "player.png",          # 9
		img + "benji_full.png",      # 10
		img + "benji_med.png",       # 11
		img + "benji_low.png",       # 12
		img + "benji_starving.png",  # 13
		img + "cor.png",             # 14
		Color(0.05, 0.05, 0.10),     # 15 background
		Color(0.0, 0.0, 0.0, 0.0),  # 16 transparent
	])
	# Terrain layer — full grid
	for cx in range(coccoon.GRID_W):
		for cy in range(coccoon.GRID_H):
			_tiles[Vector2i(cx, cy)] = coccoon.Sprite.new(IMG_BG, float(cx), float(cy), 0)
	# Entity layer — game area only, drawn on top
	for gx in range(L):
		for gy in range(L):
			var cx: int = OX + gx
			var cy: int = OY + gy
			_etiles[Vector2i(cx, cy)] = coccoon.Sprite.new(IMG_CLEAR, float(cx), float(cy), 1)
	_status_text = coccoon.Text.new(
		"", coccoon.GRID_W, 1, 0, 0, 16, Color.WHITE, Color(0.05, 0.05, 0.1))
	for i in range(6):
		_seed.append(0.5 + randf())
	_render()


# ── Terrain ──────────────────────────────────────────────────────────────────

func _terrain(wx: int, wy: int) -> String:
	var key := Vector2i(wx, wy)
	if _tcache.has(key):
		return _tcache[key]
	var qc = MicroMoth.QuantumCircuit.new(1)
	var fx: float = float(wx)
	var fy: float = float(wy)
	qc.rx(_seed[0] * (fx + sqrt(abs(fx)) - fy) * PI / 128.0, 0)
	qc.ry(_seed[1] * (fx + fy + sqrt(abs(fy))) * PI / 128.0 + PI, 0)
	qc.rx(_seed[2] * (fx + sqrt(abs(fx)) - fy) * PI / 256.0, 0)
	qc.ry(_seed[3] * (fx + fy + sqrt(abs(fy))) * PI / 256.0 + PI, 0)
	qc.rx(_seed[3] * (fx + sqrt(abs(fx)) - fy) * PI / 512.0, 0)
	qc.ry(_seed[5] * (fx + fy + sqrt(abs(fy))) * PI / 512.0 + PI, 0)
	var probs: Dictionary = MicroMoth.simulate(qc, 1024, "probabilities_dict")
	var pz: float = probs.get("1", 0.0)
	var t: String
	if pz <= 0.25:
		t = "lawn"
	elif pz > 0.75:
		t = "meadow"
	else:
		qc.h(0)
		probs = MicroMoth.simulate(qc, 1024, "probabilities_dict")
		var px_: float = probs.get("1", 0.0)
		if px_ < 0.05:    t = "sea"
		elif px_ <= 0.15: t = "beach"
		elif px_ > 0.95:  t = "snow"
		elif px_ > 0.9:   t = "rock"
		else:
			qc.h(0)
			qc.rx(PI / 4.0, 0)
			probs = MicroMoth.simulate(qc, 1024, "probabilities_dict")
			var py_: float = probs.get("1", 0.0)
			t = "forest" if py_ <= 0.5 else "pond"
	_tcache[key] = t
	return t


# ── Screen generation ────────────────────────────────────────────────────────

func _gen_screen() -> void:
	_fruit = []
	for xx in range(L):
		for yy in range(L):
			var wx: int = _sx * L + xx
			var wy: int = _sy * L + yy
			var t: String = _terrain(wx, wy)
			if randf() < 1.0 / 150.0 and t != "sea" and t != "pond":
				_fruit.append({"wx": wx, "wy": wy, "active": true})
	if not _cor_active:
		_cor_active = randf() < 0.3
	else:
		_cor_active = false


# ── Helpers ──────────────────────────────────────────────────────────────────

func _timg(t: String) -> int:
	match t:
		"lawn":   return IMG_LAWN
		"meadow": return IMG_MEADOW
		"forest": return IMG_FOREST
		"sea":    return IMG_SEA
		"beach":  return IMG_BEACH
		"snow":   return IMG_SNOW
		"rock":   return IMG_ROCK
		"pond":   return IMG_POND
	return IMG_BG


func _bimg() -> int:
	if _j_size > 0.75:   return IMG_BENJI_FULL
	elif _j_size > 0.5:  return IMG_BENJI_MED
	elif _j_size > 0.25: return IMG_BENJI_LOW
	return IMG_BENJI_STAR


func _gxy(wx: int, wy: int) -> Vector2i:
	return Vector2i(OX + (wx - _sx * L), OY + (L - 1 - (wy - _sy * L)))


# ── Render ───────────────────────────────────────────────────────────────────

func _render() -> void:
	if _title:
		for key in _tiles:
			_tiles[key].image_id = IMG_MEADOW
		for key in _etiles:
			_etiles[key].image_id = IMG_CLEAR
		_status_text.text = "BENJI THE BLOB  |  lead your pet to food, avoid ticks  |  press any key"
		return

	# Terrain layer
	for cx in range(coccoon.GRID_W):
		for cy in range(coccoon.GRID_H):
			_tiles[Vector2i(cx, cy)].image_id = IMG_BG
	for gx in range(L):
		for gy in range(L):
			var wx: int = _sx * L + gx
			var wy: int = _sy * L + gy
			_tiles[_gxy(wx, wy)].image_id = _timg(_terrain(wx, wy))

	# Entity layer — clear first, then place entities
	for key in _etiles:
		_etiles[key].image_id = IMG_CLEAR

	for f in _fruit:
		if f["active"]:
			_etiles[_gxy(f["wx"], f["wy"])].image_id = IMG_FRUIT

	if _cor_active:
		_etiles[_gxy(_cor_wx, _cor_wy)].image_id = IMG_COR

	if floori(_jx / float(L)) == _sx and floori(_jy / float(L)) == _sy:
		_etiles[_gxy(floori(_jx), floori(_jy))].image_id = _bimg()

	_etiles[_gxy(floori(_px), floori(_py))].image_id = IMG_PLAYER

	_status_text.text = "Benji: " + str(int(_j_size * 100.0)) + "% full"


# ── Process ──────────────────────────────────────────────────────────────────

func _process(_delta: float) -> void:
	var inp: Dictionary = coccoon.update()
	var keys: Array = inp["key_presses"]
	var just_pressed: Array = []
	for k in keys:
		if k not in _prev_keys:
			just_pressed.append(k)
	_prev_keys = keys.duplicate()

	if _title:
		if just_pressed.size() > 0:
			_title = false
			_gen_screen()
			_render()
		return

	var px0: float = _px
	var py0: float = _py
	var spd: float = 0.6
	if 0 in keys:   _py -= spd
	elif 2 in keys: _py += spd
	if 3 in keys:   _px -= spd
	elif 1 in keys: _px += spd

	if _terrain(floori(_px), floori(_py)) in ["sea", "pond"]:
		_px = px0
		_py = py0

	var nsx: int = floori(_px / float(L))
	var nsy: int = floori(_py / float(L))
	if nsx != _sx or nsy != _sy:
		_sx = nsx
		_sy = nsy
		_gen_screen()

	var dx: float = _px - _jx
	var dy: float = _py - _jy
	var md: float = abs(dx) + abs(dy)
	if md > 2.0:
		var pmx: float = _j_size * abs(dx) / md
		var pmy: float = _j_size * abs(dy) / md
		var r: float = randf()
		if r < pmx and dx != 0.0:
			_jx += 0.25 * sign(dx)
		elif r < pmx + pmy and dy != 0.0:
			_jy += 0.25 * sign(dy)
		var jwx: int = floori(_jx)
		var jwy: int = floori(_jy)
		for i in range(_fruit.size()):
			if _fruit[i]["active"] and _fruit[i]["wx"] == jwx and _fruit[i]["wy"] == jwy:
				if _j_size < 0.95:
					_fruit[i]["active"] = false
					_j_size += 0.05

	if _cor_active:
		_cor_wx = _sx * L + randi() % L
		_cor_wy = _sy * L + randi() % L
		if abs(floori(_jx) - _cor_wx) <= 1 and abs(floori(_jy) - _cor_wy) <= 1:
			if _j_size > 0.1:
				_j_size -= 0.1

	_j_size = max(_j_size - 1.0 / 600.0, 0.0)
	_render()
