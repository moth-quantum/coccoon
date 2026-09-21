extends Node

# coccoon — quantum game engine, Godot 4 backend

const FPS    := 30
const CELL   := 40
const GRID_W := 32
const GRID_H := 18

var _images: Array = []
var _input_state: Dictionary = {"key_presses": [], "clicks": []}

const _KEY_MAP = {
	KEY_UP:     0,
	KEY_RIGHT:  1,
	KEY_DOWN:   2,
	KEY_LEFT:   3,
	KEY_SPACE:  4,
	KEY_W:      5,
	KEY_A:      6,
	KEY_S:      7,
	KEY_D:      8,
	KEY_ESCAPE: -1,
}

func _ready() -> void:
	Engine.max_fps = FPS
	_print_buffer = Text.new("", 32, 18, 0, 0, 16)
	hide_print()
	if OS.has_feature("web"):
		JavaScriptBridge.eval("var c=document.getElementById('canvas');c.setAttribute('tabindex','0');c.focus();document.body.addEventListener('click',function(){c.focus();});")

func _input(event: InputEvent) -> void:
	if event is InputEventKey and not event.echo:
		for key in _KEY_MAP:
			if event.keycode == key:
				var code: int = _KEY_MAP[key]
				if event.pressed:
					if code not in _input_state["key_presses"]:
						_input_state["key_presses"].append(code)
				else:
					_input_state["key_presses"].erase(code)
		if event.keycode == KEY_ESCAPE and event.pressed:
			var scene: Node = get_tree().current_scene
			if scene and scene.scene_file_path != "res://menu.tscn":
				get_tree().change_scene_to_file("res://menu.tscn")

func update() -> Dictionary:
	return _input_state

func _to_screen(x: float, y: float, size: float) -> Vector2:
	return Vector2(x * CELL, (GRID_H - y - size) * CELL)

func _load_texture(entry) -> Texture2D:
	if entry is Color:
		var img := Image.create(1, 1, false, Image.FORMAT_RGBA8)
		img.set_pixel(0, 0, entry)
		return ImageTexture.create_from_image(img)
	var res_path: String = "res://" + entry
	if ResourceLoader.exists(res_path):
		return load(res_path) as Texture2D
	var img := Image.load_from_file(entry)
	return ImageTexture.create_from_image(img)


# ── ImageList ──────────────────────────────────────────────────────────────

class ImageList extends RefCounted:

	var _filenames: Array

	func _init(filenames: Array) -> void:
		_filenames = filenames
		coccoon._images = filenames

	func __getitem__(i: int):
		return _filenames[i]


# ── Sprite ─────────────────────────────────────────────────────────────────

class Sprite extends RefCounted:

	var _node: Sprite2D
	var _image_id: int
	var _size: float

	var image_id: int:
		get: return _image_id
		set(val):
			_image_id = val
			_refresh_texture()

	var x: float:
		get: return _node.position.x / coccoon.CELL
		set(val): _node.position.x = val * coccoon.CELL

	var y: float:
		get: return coccoon.GRID_H - _node.position.y / coccoon.CELL - _size
		set(val): _node.position.y = (coccoon.GRID_H - val - _size) * coccoon.CELL

	var z: int:
		get: return _node.z_index
		set(val): _node.z_index = val

	var size: float:
		get: return _size
		set(val):
			_size = val
			_refresh_texture()

	var angle: float:
		get: return _node.rotation_degrees
		set(val): _node.rotation_degrees = val

	var flip_h: bool:
		get: return _node.flip_h
		set(val): _node.flip_h = val

	var flip_v: bool:
		get: return _node.flip_v
		set(val): _node.flip_v = val

	func _init(image_id: int, x: float = 0.0, y: float = 0.0, z: int = 0,
			size: float = 1.0, angle: float = 0.0,
			flip_h: bool = false, flip_v: bool = false) -> void:
		_image_id = image_id
		_size = size
		_node = Sprite2D.new()
		_node.centered = false
		_node.position = coccoon._to_screen(x, y, size)
		_node.z_index = z
		_node.rotation_degrees = angle
		_node.flip_h = flip_h
		_node.flip_v = flip_v
		coccoon.add_child(_node)
		_refresh_texture()

	func _refresh_texture() -> void:
		var tex := coccoon._load_texture(coccoon._images[_image_id])
		_node.texture = tex
		var s := _size * coccoon.CELL
		var ts := tex.get_size()
		_node.scale = Vector2(s / ts.x, s / ts.y)


# ── Text ───────────────────────────────────────────────────────────────────

class Text extends RefCounted:

	var _label: Label
	var _bg: ColorRect
	var _height: float
	var _width: float

	var text: String:
		get: return _label.text
		set(val): _label.text = val

	var x: float:
		set(val):
			_label.position.x = val * coccoon.CELL
			_bg.position.x    = val * coccoon.CELL

	var y: float:
		set(val):
			var py := (coccoon.GRID_H - val - _height) * coccoon.CELL
			_label.position.y = py
			_bg.position.y    = py

	func _init(text: String, width: float, height: float,
			x: float = 0.0, y: float = 0.0, font_size: int = 16,
			font_color: Color = Color.BLACK,
			background_color: Color = Color.WHITE) -> void:
		_width = width
		_height = height
		var px := x * coccoon.CELL
		var py := (coccoon.GRID_H - y - height) * coccoon.CELL
		var w  := width  * coccoon.CELL
		var h  := height * coccoon.CELL

		_bg = ColorRect.new()
		_bg.position = Vector2(px, py)
		_bg.size     = Vector2(w, h)
		_bg.color    = background_color
		coccoon.add_child(_bg)

		_label = Label.new()
		_label.position = Vector2(px, py)
		_label.size     = Vector2(w, h)
		_label.text     = text
		_label.autowrap_mode = TextServer.AUTOWRAP_WORD
		_label.add_theme_font_size_override("font_size", font_size)
		_label.add_theme_color_override("font_color", font_color)
		coccoon.add_child(_label)

	func set_font_color(color: Color) -> void:
		_label.add_theme_color_override("font_color", color)

	func set_background_color(color: Color) -> void:
		_bg.color = color

	func set_border_color(_color: Color) -> void:
		pass  # not yet implemented


# ── Not yet implemented ────────────────────────────────────────────────────

class SoundList extends RefCounted:
	func _init(_filenames: Array) -> void:
		pass

class Camera extends RefCounted:
	var x: float = 0.0
	var y: float = 0.0
	var size: float = 8.0
	var angle: float = 0.0

class Sound extends RefCounted:
	var sound_id: int
	var playmode: int = 0
	var volume: float = 1.0
	var pitch: float  = 1.0
	var note: float   = 0.0
	func _init(sid: int) -> void:
		sound_id = sid


# ── Print system ───────────────────────────────────────────────────────────

var _print_buffer: Text

func print(value) -> void:
	var txt := str(value)
	var lines := (_print_buffer.text + "\n" + txt).split("\n")
	if lines.size() > 32:
		lines = lines.slice(lines.size() - 32)
	_print_buffer.text = "\n".join(PackedStringArray(lines))
	show_print()

func show_print() -> void:
	_print_buffer.set_font_color(Color(0.0, 0.0, 0.0, 0.5))
	_print_buffer.set_background_color(Color(1.0, 1.0, 1.0, 0.5))

func hide_print() -> void:
	_print_buffer.set_font_color(Color(0.0, 0.0, 0.0, 0.0))
	_print_buffer.set_background_color(Color(1.0, 1.0, 1.0, 0.0))
