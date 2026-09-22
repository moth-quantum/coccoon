extends Node

var _games: Array = []
var _selected: int = 0
var _labels: Array = []
var _hint_label = null

var _key_entry_active := false
var _key_input := ""

const _API_KEY_SLOT := "_api_key"

func _ready() -> void:
	_scan_games()
	_build_ui()

func _scan_games() -> void:
	var dir := DirAccess.open("res://games")
	if dir:
		dir.list_dir_begin()
		var entry := dir.get_next()
		while entry != "":
			if dir.current_is_dir() and not entry.begins_with("."):
				_games.append(entry)
			entry = dir.get_next()
		dir.list_dir_end()
	_games.sort()
	_games.append(_API_KEY_SLOT)

const _DISPLAY_NAMES := {
	"celeste": "Celeste (Quantum Remix)",
}

func _format_name(s: String) -> String:
	if s == _API_KEY_SLOT:
		var k := coccoon.get_api_key()
		return "Moth API Key  [" + ("set" if k.length() > 0 else "not set") + "]"
	if s in _DISPLAY_NAMES:
		return _DISPLAY_NAMES[s]
	var words: Array = s.split("_")
	var result: Array = []
	for w in words:
		if w.length() > 0:
			result.append(w[0].to_upper() + w.substr(1))
	return " ".join(PackedStringArray(result))

func _build_ui() -> void:
	coccoon._clear_game_nodes()
	coccoon.Text.new("", coccoon.GRID_W, coccoon.GRID_H, 0, 0, 16,
		Color.WHITE, Color(0.05, 0.05, 0.15))

	coccoon.Text.new("COCCOON", coccoon.GRID_W, 3, 0, coccoon.GRID_H - 3,
		48, Color.WHITE, Color(0.08, 0.08, 0.22))

	_hint_label = coccoon.Text.new("Up/Down arrows to navigate   Space to launch   Esc to return",
		coccoon.GRID_W, 1, 0, 0, 14, Color(0.5, 0.5, 0.7), Color(0.05, 0.05, 0.15))

	var label_w: float = 22.0
	var label_x: float = (coccoon.GRID_W - label_w) / 2.0
	var center_y: float = 7.0
	var list_top_y: float = center_y + (_games.size() - 1)

	for i in range(_games.size()):
		var y: float = list_top_y - i * 2
		var is_key_slot: bool = _games[i] == _API_KEY_SLOT
		var fg := Color(0.5, 0.5, 0.6) if is_key_slot else Color(0.7, 0.7, 0.9)
		var bg := Color(0.08, 0.08, 0.2) if is_key_slot else Color(0.1, 0.1, 0.3)
		_labels.append(coccoon.Text.new(
			"  " + _format_name(_games[i]), label_w, 1, label_x, y,
			14 if is_key_slot else 16, fg, bg))

	_refresh()

func _refresh() -> void:
	for i in range(_labels.size()):
		var is_key_slot: bool = _games[i] == _API_KEY_SLOT
		if i == _selected:
			_labels[i].set_background_color(Color(0.5, 0.3, 0.0) if is_key_slot else Color(0.7, 0.45, 0.0))
			_labels[i].set_font_color(Color.WHITE)
		else:
			var fg := Color(0.5, 0.5, 0.6) if is_key_slot else Color(0.7, 0.7, 0.9)
			var bg := Color(0.08, 0.08, 0.2) if is_key_slot else Color(0.1, 0.1, 0.3)
			_labels[i].set_background_color(bg)
			_labels[i].set_font_color(fg)

func _input(event: InputEvent) -> void:
	if _key_entry_active:
		_handle_key_entry(event)
		return
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_UP:
				_selected = max(0, _selected - 1)
				_refresh()
			KEY_DOWN:
				_selected = min(_games.size() - 1, _selected + 1)
				_refresh()
			KEY_SPACE, KEY_ENTER:
				_launch()

func _handle_key_entry(event: InputEvent) -> void:
	if not (event is InputEventKey and event.pressed):
		return
	match event.keycode:
		KEY_ENTER, KEY_KP_ENTER:
			coccoon.save_api_key(_key_input)
			_end_key_entry()
		KEY_ESCAPE:
			_end_key_entry()
		KEY_BACKSPACE:
			if _key_input.length() > 0:
				_key_input = _key_input.left(_key_input.length() - 1)
			_refresh_key_label()
		KEY_V:
			if event.ctrl_pressed or event.meta_pressed:
				_key_input += DisplayServer.clipboard_get()
				_refresh_key_label()
			elif event.unicode > 31:
				_key_input += char(event.unicode)
				_refresh_key_label()
		_:
			if event.unicode > 31:
				_key_input += char(event.unicode)
				_refresh_key_label()

func _refresh_key_label() -> void:
	var display := _key_input
	if display.length() > 19:
		display = "..." + display.right(16)
	_labels[_selected].text = "  " + display + "_"

func _start_key_entry() -> void:
	_key_entry_active = true
	_key_input = coccoon.get_api_key()
	_hint_label.text = "Type key   Enter to save   Esc to cancel"
	_refresh_key_label()

func _end_key_entry() -> void:
	_key_entry_active = false
	_hint_label.text = "Up/Down arrows to navigate   Space to launch   Esc to return"
	_labels[_selected].text = "  " + _format_name(_API_KEY_SLOT)
	_refresh()

const _SCENE_NAMES := {
}

func _find_scene(game: String) -> String:
	var base := "res://games/" + game + "/"
	var stem: String = _SCENE_NAMES.get(game, game)
	for ext: String in [".tscn", ".scn"]:
		var path: String = base + stem + ext
		if ResourceLoader.exists(path):
			return path
	return ""

func _launch() -> void:
	if _games[_selected] == _API_KEY_SLOT:
		_start_key_entry()
		return
	var path: String = _find_scene(_games[_selected])
	if path != "":
		_labels[_selected].text = "  Loading..."
		_labels[_selected].set_background_color(Color(0.15, 0.15, 0.15))
		await get_tree().process_frame
		get_tree().change_scene_to_file(path)
