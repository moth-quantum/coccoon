extends Node

# Q-Qube — port of pewpew-qube (Oscar Higgott, Qiskit Camp)
# Manipulate a 2-qubit quantum state with gates; visualised as permuted
# 4×4 blocks on the 8×8 LED display.
#
# Menu:  UP=XYZ mode  RIGHT=X+cx  DOWN=H+cx  LEFT=all gates
# Game (standard): directional keys + SPACE apply gates; ESC returns to menu
# Game (XYZ): choose axis then rotation with LEFT/DOWN/RIGHT pairs; UP clears

const OX  = 8
const OY  = 1
const PIX = 2

const IMG_0  = 0
const IMG_1  = 1
const IMG_2  = 2
const IMG_3  = 3
const IMG_BG = 4

# Goal pattern: IBMQ logo (row 0 = top of display)
const IBMQ: Array = [
	[1,1,1,3,3,1,1,1],
	[1,1,3,3,3,3,1,1],
	[1,3,3,0,0,3,3,1],
	[1,3,3,0,0,3,3,1],
	[1,1,3,3,3,3,1,1],
	[1,1,1,3,3,1,1,1],
	[1,1,1,3,3,3,1,1],
	[1,1,1,3,3,3,1,1]
]

# Animated Qiskit logo for menu (4 frames, bright dot orbits the Q)
const QISKIT_FRAMES: Array = [
	[[0,3,3,3,3,3,3,0],[3,2,0,1,1,0,0,3],[3,0,2,0,0,1,0,3],[3,1,0,2,0,0,1,3],
	 [3,3,0,0,2,0,3,3],[3,0,3,3,3,3,0,3],[3,0,0,0,0,0,2,3],[0,3,3,3,3,3,3,0]],
	[[0,3,3,3,3,3,3,0],[3,0,0,2,1,0,0,3],[3,0,1,2,0,1,0,3],[3,1,0,0,2,0,1,3],
	 [3,3,0,0,2,0,3,3],[3,0,3,3,3,3,0,3],[3,0,0,0,0,2,0,3],[0,3,3,3,3,3,3,0]],
	[[0,3,3,3,3,3,3,0],[3,0,0,1,2,0,0,3],[3,0,1,0,2,1,0,3],[3,1,0,2,0,0,1,3],
	 [3,3,0,2,0,0,3,3],[3,0,3,3,3,3,0,3],[3,0,2,0,0,0,0,3],[0,3,3,3,3,3,3,0]],
	[[0,3,3,3,3,3,3,0],[3,0,0,1,1,0,2,3],[3,0,1,0,0,2,0,3],[3,1,0,0,2,0,1,3],
	 [3,3,0,2,0,0,3,3],[3,0,3,3,3,3,0,3],[3,2,0,0,0,0,0,3],[0,3,3,3,3,3,3,0]]
]
const ANIM_SEQ: Array = [0,0,1,1,2,2,3,3,2,2,1,1]

# Expanding-square intro animation
const START_SCREENS: Array = [
	[[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,3,3,0,0,0],
	 [0,0,0,3,3,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]],
	[[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,3,3,3,3,0,0],[0,0,3,2,2,3,0,0],
	 [0,0,3,2,2,3,0,0],[0,0,3,3,3,3,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]],
	[[0,0,0,0,0,0,0,0],[0,3,3,3,3,3,3,0],[0,3,2,2,2,2,3,0],[0,3,2,1,1,2,3,0],
	 [0,3,2,1,1,2,3,0],[0,3,2,2,2,2,3,0],[0,3,3,3,3,3,3,0],[0,0,0,0,0,0,0,0]],
	[[3,3,3,3,3,3,3,3],[3,2,2,2,2,2,2,3],[3,2,1,1,1,1,2,3],[3,2,1,0,0,1,2,3],
	 [3,2,1,0,0,1,2,3],[3,2,1,1,1,1,2,3],[3,2,2,2,2,2,2,3],[3,3,3,3,3,3,3,3]]
]

# Each of the 4 statevector components maps to one 4×4 quadrant [x_off, y_off]
const OFFSETS: Array = [[0,0],[4,0],[0,4],[4,4]]

var _images
var _bg_sprs:  Dictionary = {}
var _led_sprs: Array      = []
var _status_text

var _phase:       String = "menu"
var _level:       int    = 0       # -1=XYZ, 0=X+cx, 1=H+cx, 2=all
var _state:       Array  = []      # 2-qubit statevector: 4×[re,im]
var _goal_screen: Array  = []      # pre-computed scrambled IBMQ goal

var _anim_idx:    int    = 0
var _anim_accum:  float  = 0.0
var _start_frame: int    = 0
var _start_accum: float  = 0.0

var _prev_keys:   Array  = []
var _key_hist:    Array  = []   # XYZ: collects two axis/rotation keys


func _ready() -> void:
	_images = coccoon.ImageList.new([
		Color(0.0,  0.0,  0.0 ),
		Color(0.25, 0.25, 0.25),
		Color(0.6,  0.6,  0.6 ),
		Color(1.0,  1.0,  1.0 ),
		Color(0.05, 0.05, 0.15),
	])

	for cx in range(coccoon.GRID_W):
		for cy in range(coccoon.GRID_H):
			_bg_sprs[Vector2i(cx, cy)] = coccoon.Sprite.new(IMG_BG, float(cx), float(cy), 0)

	for py in range(8):
		for px in range(8):
			var sx := float(OX + px * PIX)
			var sy := float(OY + (7 - py) * PIX)
			_led_sprs.append(coccoon.Sprite.new(IMG_0, sx, sy, 1, float(PIX)))

	_status_text = coccoon.Text.new(
		"", coccoon.GRID_W, 1, 0, 0, 16, Color.WHITE, Color(0.05, 0.05, 0.15))

	_goal_screen = _update_display([[1,0],[0,0],[0,0],[0,0]], IBMQ)
	_enter_menu()


# ── Menu ───────────────────────────────────────────────────────────────────────

func _enter_menu() -> void:
	_phase      = "menu"
	_anim_idx   = 0
	_anim_accum = 0.0
	_status_text.text = "UP=xyz  RT=X+cx  DN=H+cx  LT=all  (esc=back)"
	_set_screen(QISKIT_FRAMES[ANIM_SEQ[0]])


# ── Permute screen (port of permute_screen.py) ─────────────────────────────────

func _perm_map(t: int) -> int:
	match t:
		0:  return 0
		-1: return 1
		-2: return 2
		2:  return 2
		1:  return 3
	return 0


func _state_to_permindices(state: Array) -> Array:
	var result: Array = []
	for c in state:
		var re: float    = c[0]
		var im: float    = c[1]
		var r: float     = sqrt(re * re + im * im)
		var theta: float = atan2(im, re)
		var rperm: int   = roundi(r * r * 4)
		if rperm >= 4:
			rperm = 3
		rperm = rperm % 4
		var tperm: int = _perm_map(roundi(theta / (PI * 0.5)))
		result.append([rperm, tperm])
	return result


func _update_display(values: Array, previous: Array) -> Array:
	var output: Array = []
	for _i in range(8):
		output.append([0, 0, 0, 0, 0, 0, 0, 0])
	for qi in range(4):
		var x_off: int = OFFSETS[qi][0]
		var y_off: int = OFFSETS[qi][1]
		var shift: int = values[qi][0]
		var rot:   int = values[qi][1]
		for y in range(4):
			for x in range(4):
				var a: int = x
				var b: int = y
				for _r in range(rot):
					var na: int = 3 - b
					var nb: int = a
					a = na
					b = nb
				b = (b + shift) % 4
				output[b + y_off][a + x_off] = previous[y + y_off][x + x_off]
	return output


# ── Quantum state helpers ──────────────────────────────────────────────────────

func _apply_gate_to_state(gate: String) -> void:
	var qc := MicroMoth.QuantumCircuit.new(2, 0)
	qc.initialize(_state)
	match gate:
		"x0": qc.x(0)
		"x1": qc.x(1)
		"h0": qc.h(0)
		"h1": qc.h(1)
		"cx": qc.cx(0, 1)
	_state = MicroMoth.simulate(qc, 0, "statevector")


func _level_gates(level: int) -> Array:
	match level:
		0: return ["x0", "x1", "cx"]
		1: return ["h0", "h1", "cx"]
		_: return ["x0", "x1", "h0", "h1", "cx"]


func _random_initial_state(level: int) -> Array:
	var gates: Array  = _level_gates(level)
	var length: int   = 3 if level == 0 else 11
	var qc := MicroMoth.QuantumCircuit.new(2, 0)
	for _i in range(length):
		match gates[randi() % gates.size()]:
			"x0": qc.x(0)
			"x1": qc.x(1)
			"h0": qc.h(0)
			"h1": qc.h(1)
			"cx": qc.cx(0, 1)
	return MicroMoth.simulate(qc, 0, "statevector")


func _random_xyz_state() -> Array:
	var state: Array   = [[1.0,0.0],[0.0,0.0],[0.0,0.0],[0.0,0.0]]
	var choices: Array = ["xx","xy","xz","yx","yy","yz","zx","zy","zz"]
	for _i in range(5):
		state = _apply_xyz_gate(state, choices[randi() % choices.size()])
	return state


# ── XYZ rotation gates (port of rotations.py) ─────────────────────────────────

func _apply_xyz_gate(state: Array, gate: String) -> Array:
	var qc := MicroMoth.QuantumCircuit.new(2, 0)
	qc.initialize(state)
	var g0: String = gate.substr(0, 1)
	var g1: String = gate.substr(1, 1)
	if   g0 == "x": qc.h(0)
	elif g0 == "y": qc.rx(PI * 0.5, 0)
	if   g1 == "x": qc.h(1)
	elif g1 == "y": qc.rx(PI * 0.5, 1)
	qc.cx(0, 1)
	qc.h(1)
	qc.rx(PI * 0.5, 1)
	qc.h(1)
	qc.cx(0, 1)
	if   g0 == "x": qc.h(0)
	elif g0 == "y": qc.rx(-PI * 0.5, 0)
	if   g1 == "x": qc.h(1)
	elif g1 == "y": qc.rx(-PI * 0.5, 1)
	return MicroMoth.simulate(qc, 0, "statevector")


func _rot90(block: Array) -> Array:
	var res: Array = []
	for i in range(block.size()):
		var row: Array = []
		for col in block:
			row.append(col[i])
		row.reverse()
		res.append(row)
	return res


func _make_block(c_num: Array) -> Array:
	var re: float  = c_num[0]
	var im: float  = c_num[1]
	var amp: float = sqrt(re * re + im * im)
	var phi: float = atan2(im, re) if amp >= 0.01 else 0.0

	var phases: Array    = [0.0, PI*0.25, -PI*0.25, PI*0.5, -PI*0.5,
	                         PI*0.75, -PI*0.75, PI, -PI]
	var scenarios: Array = [1, -1, -2, 4, 2, -4, -3, 3, 3]
	var scenario: int = 0
	for i in range(9):
		var diff: float = phi - phases[i]
		if diff * diff < 0.001:
			scenario = scenarios[i]

	var block: Array
	if amp < 0.25:
		block = [[0,0,0,0],[0,2,2,0],[0,2,2,0],[0,0,0,0]]
	elif amp < 0.6:
		block = [[0,0,2,0],[0,0,0,2],[0,0,0,2],[0,0,2,0]] if scenario > 0 \
		        else [[0,0,0,0],[0,2,2,0],[0,0,2,0],[0,0,0,0]]
	elif amp < 0.9:
		block = [[0,0,0,2],[0,0,2,0],[0,0,2,0],[0,0,0,2]] if scenario > 0 \
		        else [[0,0,2,0],[0,0,2,2],[0,0,0,0],[0,0,0,0]]
	else:
		block = [[0,0,0,2],[0,0,0,2],[0,0,0,2],[0,0,0,2]] if scenario > 0 \
		        else [[0,0,2,2],[0,0,0,2],[0,0,0,0],[0,0,0,0]]

	if scenario != 1 and scenario != -1:
		for _r in range(abs(scenario) - 1):
			block = _rot90(block)

	return block


func _make_xyz_image() -> Array:
	var blocks: Array = []
	for c in _state:
		blocks.append(_make_block(c))
	var image: Array = []
	for _i in range(8):
		image.append([0,0,0,0,0,0,0,0])
	for i in range(2):
		for j in range(4):
			for x in range(4):
				image[4*i+j][x]   = blocks[2*i][j][x]
				image[4*i+j][x+4] = blocks[2*i+1][j][x]
	return image


# ── Game start ─────────────────────────────────────────────────────────────────

func _start_game(level: int) -> void:
	_level       = level
	_key_hist    = []
	_start_frame = 0
	_start_accum = 0.0
	_phase       = "start"
	_set_screen(START_SCREENS[0])

	if level == -1:
		_state = _random_xyz_state()
		_status_text.text = "LT/DN/RT=axis then LT/DN/RT=rot  UP=clear  SPC=restart"
	else:
		_state = _random_initial_state(level)
		match level:
			0: _status_text.text = "UP=X0  DN=X1  SPC=cx"
			1: _status_text.text = "LT=H0  RT=H1  SPC=cx"
			2: _status_text.text = "UP=X0  DN=X1  LT=H0  RT=H1  SPC=cx"


# ── Render ─────────────────────────────────────────────────────────────────────

func _set_screen(data: Array) -> void:
	for py in range(8):
		for px in range(8):
			_led_sprs[py * 8 + px].image_id = data[py][px]


func _render_game() -> void:
	var screen: Array = _make_xyz_image() if _level == -1 \
	                    else _update_display(_state_to_permindices(_state), _goal_screen)
	_set_screen(screen)


# ── Process ────────────────────────────────────────────────────────────────────

func _process(delta: float) -> void:
	var keys: Array = coccoon.update()["key_presses"]
	var just_pressed: Array = []
	for k in keys:
		if k not in _prev_keys:
			just_pressed.append(k)
	_prev_keys = keys.duplicate()

	match _phase:
		"menu":  _process_menu(delta, just_pressed)
		"start": _process_start(delta)
		"game":  _process_game(just_pressed)


func _process_menu(delta: float, just_pressed: Array) -> void:
	for k in just_pressed:
		if k == 0:
			_start_game(-1)
			return
		elif k == 1:
			_start_game(0)
			return
		elif k == 2:
			_start_game(1)
			return
		elif k == 3:
			_start_game(2)
			return

	_anim_accum += delta
	if _anim_accum >= 0.1:
		_anim_accum -= 0.1
		_anim_idx = (_anim_idx + 1) % ANIM_SEQ.size()
		_set_screen(QISKIT_FRAMES[ANIM_SEQ[_anim_idx]])


func _process_start(delta: float) -> void:
	_start_accum += delta
	if _start_accum >= 0.2:
		_start_accum -= 0.2
		_start_frame += 1
		if _start_frame >= START_SCREENS.size():
			_phase = "game"
			_render_game()
		else:
			_set_screen(START_SCREENS[_start_frame])


func _process_game(just_pressed: Array) -> void:
	var changed: bool = _process_xyz(just_pressed) if _level == -1 \
	                    else _process_instruction_set(just_pressed)
	if changed:
		_render_game()


func _process_instruction_set(just_pressed: Array) -> bool:
	var gate_map: Dictionary
	match _level:
		0: gate_map = {0: "x0", 2: "x1", 4: "cx"}
		1: gate_map = {1: "h1", 3: "h0", 4: "cx"}
		_: gate_map = {0: "x0", 2: "x1", 1: "h1", 3: "h0", 4: "cx"}
	for k in just_pressed:
		if k in gate_map:
			_apply_gate_to_state(gate_map[k])
			return true
	return false


func _process_xyz(just_pressed: Array) -> bool:
	for k in just_pressed:
		if k == 0:
			_key_hist = []
			return false
		elif k == 4:
			_state    = _random_xyz_state()
			_key_hist = []
			return true
		elif k in [1, 2, 3]:
			_key_hist.append(k)
			if _key_hist.size() == 2:
				var axis: String = _xyz_label(_key_hist[0])
				var rota: String = _xyz_label(_key_hist[1])
				_state    = _apply_xyz_gate(_state, axis + rota)
				_key_hist = []
				return true
	return false


func _xyz_label(k: int) -> String:
	match k:
		3: return "x"
		2: return "y"
		1: return "z"
	return "z"
