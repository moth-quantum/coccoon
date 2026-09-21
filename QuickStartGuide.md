# Coccoon Quick Start Guide

Coccoon is a Godot 4 quantum game engine built at [Moth Quantum](https://mothquantum.com). It renders
to a virtual 32×18 cell grid and provides simple quantum circuits through **MicroMoth**, a statevector
simulator written in GDScript that runs entirely inside Godot — no Python, no external dependencies,
no installation beyond the project itself.

This guide assumes you have Godot 4 and the coccoon project open. If you have used **qisge** before,
the key differences are: everything is GDScript instead of Python; the engine and quantum simulator
are Godot autoloads so they are always available by name (`coccoon`, `MicroMoth`); and the y-axis
runs from 0 at the bottom to 17 at the top, matching a mathematical convention rather than screen
pixel order.

---

## Getting Started

Open the project in Godot 4. Press **F5** (or the Play button) to run the demo game — a scrollable
quantum terrain generator controlled with the arrow keys.

To write your own game, create a new folder under `games/`, add a `.tscn` scene file and a `.gd`
script, and point the project's main scene at your scene (or load it from `menu.gd`). The
boilerplate is minimal:

```gdscript
extends Node

func _ready() -> void:
    pass  # set up images and sprites here

func _process(_delta: float) -> void:
    var inp := coccoon.update()  # call every frame
```

`coccoon` and `MicroMoth` are autoloaded — you never import or instantiate them.

---

## Writing Your Game

### Game Structure

Every coccoon game is a Godot `Node` scene with a single GDScript attached. Two lifecycle methods
drive the game:

- `_ready()` — runs once when the scene loads. Create your `ImageList`, `Sprite`s, and `Text`
  nodes here.
- `_process(_delta)` — runs every frame. Call `coccoon.update()` here to read input, then update
  sprite properties to reflect the new game state. Godot will redraw automatically.

You do not call a draw function. Changing a sprite's `image_id`, `x`, `y`, or any other property
takes effect on the next frame.

---

### Images

Before placing sprites you must tell the engine which images are available, by creating an
`ImageList`. The list maps integer indices to image files (or solid colours):

```gdscript
var _images = coccoon.ImageList.new([
    "games/mygame/images/player.png",   # index 0
    "games/mygame/images/wall.png",     # index 1
    Color(0.1, 0.1, 0.5),              # index 2 — solid colour, no file needed
])
```

The indices are positional: whatever is at position 0 in the array is image 0, and so on. You can
list the same file more than once to give it an additional alias index — convenient when a terrain
type logically appears twice. The `ImageList` object itself is only needed to keep the images loaded;
you reference images elsewhere by their integer index.

Image paths are relative to the Godot project root (the folder containing `project.godot`).

---

### Sprites

A sprite is a positioned image on the 32×18 grid:

```gdscript
var spr = coccoon.Sprite.new(image_id, x, y, z)
```

- `image_id` — index into your `ImageList`
- `x` — column, 0 (left) to 31 (right)
- `y` — row, 0 (bottom) to 17 (top)
- `z` — draw order; higher z draws in front. Use `z=0` for background, `z=1` for characters, etc.

Optional additional arguments extend the constructor:

```gdscript
var spr = coccoon.Sprite.new(image_id, x, y, z, size, angle, flip_h, flip_v)
```

The y-axis convention is the one that often surprises newcomers: **y=0 is the bottom row of the
screen**, y=17 is the top. This is the opposite of screen pixel coordinates, where y=0 is the top.
Keep this in mind when mapping game-world positions to sprite positions.

After creation, you can change any property directly:

```gdscript
spr.image_id = 2    # swap the displayed image
spr.x = 10.0
spr.y = 5.0
spr.angle = PI / 4.0
spr.flip_h = true
```

A common pattern for tile-based games is to create one sprite per screen cell at startup and then
scroll the world by changing which world tile each sprite represents, rather than moving sprites
around:

```gdscript
# Create a full-screen grid of sprites once
for dx in range(coccoon.GRID_W):
    for dy in range(coccoon.GRID_H):
        _sprites[Vector2i(dx, dy)] = coccoon.Sprite.new(0, float(dx), float(dy), 0)

# When scrolling, just update image_id — the screen positions stay fixed
func _refresh() -> void:
    for dx in range(coccoon.GRID_W):
        for dy in range(coccoon.GRID_H):
            _sprites[Vector2i(dx, dy)].image_id = _get_tile(_cam_x + dx, _cam_y + dy)
```

This is efficient because Godot never has to reposition nodes — only the displayed texture changes.

---

### Text

For labels, scores, or UI overlays, use `coccoon.Text`:

```gdscript
var label = coccoon.Text.new(text, width, height, x, y, font_size, font_color, background_color)
```

- `text` — the string to display
- `width`, `height` — size of the text box in grid cells
- `x`, `y` — grid position of the top-left corner (same coordinate system as sprites)
- `font_size` — point size
- `font_color`, `background_color` — `Color` values

Update the displayed text at any time:

```gdscript
label.text = "Score: " + str(score)
```

---

### Input

Call `coccoon.update()` once per frame in `_process`. It returns a dictionary with two keys:

```gdscript
var inp := coccoon.update()
var keys: Array = inp["key_presses"]   # list of key codes held this frame
var clicks: Array = inp["clicks"]      # list of mouse click positions
```

A key code appears in `key_presses` for every frame the key is held, not just the frame it was
first pressed. Check for a key with the `in` operator:

```gdscript
if 0 in inp["key_presses"]:   # up arrow held
    player_y += 1
```

Key code table:

| Code | Key     |
|------|---------|
| 0    | Up      |
| 1    | Right   |
| 2    | Down    |
| 3    | Left    |
| 4    | Space   |
| 5    | W       |
| 6    | A       |
| 7    | S       |
| 8    | D       |
| -1   | Escape  |

You can also use the grid constants for layout arithmetic:

```gdscript
coccoon.GRID_W   # 32 — number of columns
coccoon.GRID_H   # 18 — number of rows
coccoon.CELL     # 40 — pixels per cell
```

---

### Quantum Circuits

Quantum computation is provided by `MicroMoth`, a statevector simulator that runs entirely in
GDScript. You do not need Qiskit, Python, or a network connection.

**Creating a circuit:**

```gdscript
var qc := MicroMoth.QuantumCircuit.new(2)  # 2-qubit circuit
```

**Applying gates:**

```gdscript
qc.h(0)           # Hadamard on qubit 0 — creates equal superposition
qc.x(1)           # Pauli-X (bit flip) on qubit 1
qc.cx(0, 1)       # CNOT: control=0, target=1 — creates entanglement
qc.rx(PI/3, 0)    # Rotate qubit 0 around X-axis by π/3
qc.ry(PI/4, 1)    # Rotate qubit 1 around Y-axis by π/4
qc.rz(PI/2, 0)    # Rotate qubit 0 around Z-axis by π/2
qc.z(0)           # Pauli-Z (phase flip)
qc.swap(0, 1)     # Swap qubits 0 and 1
qc.crx(theta, 0, 1)  # Controlled-Rx: applies Rx(theta) to qubit 1 if qubit 0 is |1⟩
```

**Measuring:**

```gdscript
qc.measure(0, 0)   # measure qubit 0 into classical bit 0
qc.measure_all()   # measure every qubit into the corresponding classical bit
```

**Running the simulation:**

```gdscript
var result = MicroMoth.simulate(qc, shots, mode)
```

The `shots` argument says how many times to sample the circuit. The `mode` argument determines
what format the result comes back in:

| Mode | Returns | Use when |
|------|---------|----------|
| `"statevector"` | Array of complex amplitudes | You want the full quantum state |
| `"probabilities_dict"` | Dictionary: outcome string → probability | Exact probabilities, use `shots=1024` |
| `"counts"` | Dictionary: outcome string → integer count | Noisy/sampled results |
| `"memory"` | Array of outcome strings, one per shot | Full shot-by-shot record |

Outcome strings are bitstrings like `"00"`, `"01"`, `"10"`, `"11"` for a 2-qubit circuit, with
qubit 0 at the rightmost position.

**Example — quantum coin flip:**

```gdscript
var qc := MicroMoth.QuantumCircuit.new(1)
qc.h(0)          # superposition: equal probability of 0 or 1
qc.measure(0, 0)
var counts: Dictionary = MicroMoth.simulate(qc, 1, "counts")
if "1" in counts:
    print("heads")
else:
    print("tails")
```

**Example — reading exact probabilities:**

```gdscript
var qc := MicroMoth.QuantumCircuit.new(1)
qc.ry(PI / 3.0, 0)
qc.measure_all()
var probs: Dictionary = MicroMoth.simulate(qc, 1024, "probabilities_dict")
var p0: float = probs.get("0", 0.0)   # probability of measuring |0⟩
var p1: float = probs.get("1", 0.0)   # probability of measuring |1⟩
```

Use `"probabilities_dict"` when you want a deterministic value derived from the quantum state
(e.g. terrain generation). Use `"counts"` or `"memory"` when you want genuine randomness that
varies between runs.

**Tip — rotation gates and the Bloch sphere:**

A single qubit can be thought of as a point on the surface of a sphere (the Bloch sphere). Rx, Ry,
and Rz rotate that point around the three coordinate axes. Using all three with
position-dependent angles is a compact way to map a 2D coordinate `(x, y)` to a smoothly varying
value in [0, 1], which is what the demo's terrain generator does.

---

### The Moth API

If a Moth API key is set in the coccoon menu, your game can call Moth engines — cloud quantum
services that run on real hardware or high-performance simulators. Games that do not use the API
still work: the key is optional, and the pattern below degrades gracefully to a local fallback.

**Retrieving the key:**

The key is stored at the engine level. Retrieve it anywhere with:

```gdscript
var key := coccoon.get_api_key()  # empty string if not set
```

Players enter their key through the coccoon menu — you never handle credentials in game code.

**Making a request:**

The Moth API follows an async job model. You POST a job, receive a `job_id` immediately (HTTP 202),
then poll a second endpoint until the job is complete. Use Godot's `HTTPRequest` node and `await`
to handle this without blocking the game:

```gdscript
var _http: HTTPRequest

func _ready() -> void:
    _http = HTTPRequest.new()
    add_child(_http)
    # ... rest of setup ...
    _generate()

func _generate() -> void:
    var key := coccoon.get_api_key()
    var result: Variant = null
    if key.length() > 0:
        result = await _call_api(key)
    if result == null:
        result = _local_fallback()
    _apply(result)
```

**Submitting a job (blur-core-v1 example):**

`blur-core-v1` takes a 2D array of floats and a `strength` value (0–1), and returns the same array
after quantum blurring. The request body goes inside `params`:

```gdscript
const _API_BASE := "https://api.mothquantum.com"

func _call_api(key: String) -> Variant:
    var body := JSON.stringify({
        "params": {
            "values": my_2d_array,   # nested Array of floats, row-major
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

    var resp: Array = await _http.request_completed
    # resp = [result_code, http_status, headers, body_as_PackedByteArray]
    if resp[1] != 202:
        return null

    var parsed: Variant = JSON.parse_string(resp[3].get_string_from_utf8())
    if not (parsed is Dictionary) or not parsed.has("job_id"):
        return null

    return await _poll(key, parsed["job_id"])
```

**Polling for the result:**

```gdscript
func _poll(key: String, job_id: String) -> Variant:
    var headers := PackedStringArray(["Authorization: Bearer " + key])
    for _i in range(60):   # up to 30 seconds at 0.5 s intervals
        await get_tree().create_timer(0.5).timeout
        var err := _http.request(
            _API_BASE + "/api/v1/jobs/" + job_id,
            headers, HTTPClient.METHOD_GET)
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
            return parsed.get("result")   # inline result — your output data
        elif status in ["failed", "error", "cancelled"]:
            return null
    return null   # timed out
```

When the job is complete, the result is usually returned inline in the `result` field. Some engines
return large outputs via a presigned download URL in the `outputs` array instead — see
`games/quantum_caverns/quantum_caverns.gd` for handling both cases.

**Prefetching:**

If your game generates new content at predictable moments (level transitions, new mazes), start the
next API call as a background coroutine as soon as the player begins the current level. Call the
async function *without* `await` to fire it and continue immediately:

```gdscript
func _start_level() -> void:
    _apply(_ready_data)
    _prefetch()             # fire-and-forget — runs in background

func _prefetch() -> void:
    _next_data = await _call_api(coccoon.get_api_key())
    _next_ready = true
```

The player never waits for generation when the API is fast enough. If they finish before the
prefetch completes, show an animated status message (dots cycling in `_process`) until
`_next_ready` becomes true.

For a complete worked example of all of the above, read
`games/quantum_caverns/quantum_caverns.gd` — it is annotated as a tutorial.

---

### Debugging

Use `coccoon.print(value)` to display a value in a debug overlay on screen:

```gdscript
coccoon.print("pos: " + str(player_x) + "," + str(player_y))
```

This is equivalent to `print()` but the output is visible in the game window, not just the Godot
console. Godot's own `print()` still works and appears in the Output panel.

---

## Key Differences from Qisge

If you are familiar with qisge (the earlier Unity+Python incarnation of this engine), here is what
changes in coccoon:

| Qisge | Coccoon |
|-------|---------|
| Python scripts | GDScript |
| Qiskit quantum circuits | MicroMoth — no external dependency |
| Unity engine | Godot 4 |
| `import qisge` | No import needed — `coccoon` is an autoload |
| y=0 at top | y=0 at bottom |
| Sound support | Not yet supported |

The quantum API is intentionally similar: `QuantumCircuit.new(n)`, gate methods on the circuit
object, and `simulate()` with a mode string. The main difference is that all the output mode names
are the same but the function signature uses positional arguments rather than keyword arguments.

---

## Example: Minimal Game

A sprite that moves with arrow keys:

```gdscript
extends Node

var _images
var _player

func _ready() -> void:
    _images = coccoon.ImageList.new([
        "games/mygame/images/player.png",
    ])
    _player = coccoon.Sprite.new(0, 16.0, 9.0, 1)  # start near centre

func _process(_delta: float) -> void:
    var inp := coccoon.update()
    if 0 in inp["key_presses"]: _player.y = min(_player.y + 1, coccoon.GRID_H - 1)
    if 2 in inp["key_presses"]: _player.y = max(_player.y - 1, 0)
    if 1 in inp["key_presses"]: _player.x = min(_player.x + 1, coccoon.GRID_W - 1)
    if 3 in inp["key_presses"]: _player.x = max(_player.x - 1, 0)
```

Remember: increasing y moves the sprite toward the top of the screen.
