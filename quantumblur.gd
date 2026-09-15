class_name QuantumBlur

# GDScript port of https://github.com/moth-quantum/QuantumBlur
# All functions are static — no instantiation needed.
# Heights are dictionaries keyed by Vector2i(x, y).


static func make_line(length: int) -> Array:
	var n: int = ceili(log(float(length)) / log(2.0))
	var line: Array = ["0", "1"]
	for _j in range(n - 1):
		var rev: Array = line.duplicate()
		rev.reverse()
		line = line + rev
		var half: int = line.size() / 2
		for i in range(half):
			line[i] = line[i] + "0"
		for i in range(half, line.size()):
			line[i] = line[i] + "1"
	return line


static func make_grid(Lx: int, Ly: int = -1) -> Dictionary:
	if Ly < 0:
		Ly = Lx
	var line_x: Array = make_line(Lx)
	var line_y: Array = make_line(Ly)
	var grid: Dictionary = {}
	for x in range(Lx):
		for y in range(Ly):
			grid[line_x[x] + line_y[y]] = Vector2i(x, y)
	return grid


static func _bin_to_int(s: String) -> int:
	var r: int = 0
	for c in s:
		r = r * 2 + (1 if c == "1" else 0)
	return r


static func _normalize(state: Array) -> Array:
	var n: float = 0.0
	for v in state:
		n += float(v) * float(v)
	var sq: float = sqrt(n) if n > 1e-12 else 1.0
	var result: Array = []
	for v in state:
		result.append(float(v) / sq)
	return result


static func height2circuit(height: Dictionary, Lx: int, Ly: int = -1, use_log: bool = false):
	if Ly < 0:
		Ly = Lx
	var grid: Dictionary = make_grid(Lx, Ly)
	var n_bits_x: int = ceili(log(float(Lx)) / log(2.0))
	var n_bits_y: int = ceili(log(float(Ly)) / log(2.0))
	var n_qubits: int = n_bits_x + n_bits_y
	var state: Array = []
	for _i in range(1 << n_qubits):
		state.append(0.0)

	if use_log:
		var max_h: float = 0.0
		for pos in height:
			max_h = maxf(max_h, float(height[pos]))
		if max_h < 1e-12:
			max_h = 1.0
		var eps: float = 0.01
		var min_h: float = 1.0
		for pos in height:
			var h: float = float(height[pos]) / max_h
			if h > eps and h < min_h:
				min_h = h
		var base: float = 1.0 / min_h
		for bs in grid:
			var pos: Vector2i = grid[bs]
			if height.has(pos):
				var h: float = float(height[pos]) / max_h
				if h > 0.0:
					state[_bin_to_int(bs)] = sqrt(pow(base, h / min_h))
	else:
		for bs in grid:
			var pos: Vector2i = grid[bs]
			if height.has(pos):
				var h: float = float(height[pos])
				if h > 0.0:
					state[_bin_to_int(bs)] = sqrt(h)

	state = _normalize(state)
	var qc := MicroMoth.QuantumCircuit.new(n_qubits)
	qc.initialize(state)
	return qc


static func probs2height(probs: Dictionary, Lx: int, Ly: int = -1, use_log: bool = false) -> Dictionary:
	if Ly < 0:
		Ly = Lx
	var grid: Dictionary = make_grid(Lx, Ly)
	var max_h: float = 1e-10
	for bs in probs:
		if float(probs[bs]) > max_h:
			max_h = float(probs[bs])
	var height: Dictionary = {}
	for x in range(Lx):
		for y in range(Ly):
			height[Vector2i(x, y)] = 0.0
	for bs in probs:
		if bs in grid:
			height[grid[bs]] = float(probs[bs]) / max_h

	if use_log:
		var min_h: float = 1.0
		for pos in height:
			var v: float = height[pos]
			if v > 1e-100 and v < min_h:
				min_h = v
		var log_base: float = log(1.0 / min_h)
		for pos in height:
			var v: float = height[pos]
			if v > 1e-100 and log_base > 1e-10:
				height[pos] = maxf(log(v / min_h) / log_base, 0.0)
			else:
				height[pos] = 0.0

	return height


static func circuit2height(qc, Lx: int, Ly: int = -1, use_log: bool = false) -> Dictionary:
	if Ly < 0:
		Ly = Lx
	var probs: Dictionary = MicroMoth.simulate(qc, 1024, "probabilities_dict")
	return probs2height(probs, Lx, Ly, use_log)
