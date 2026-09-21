extends Node

var _games: Array = []
var _selected: int = 0
var _labels: Array = []

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

func _format_name(s: String) -> String:
	var words: Array = s.split("_")
	var result: Array = []
	for w in words:
		if w.length() > 0:
			result.append(w[0].to_upper() + w.substr(1))
	return " ".join(PackedStringArray(result))

func _build_ui() -> void:
	coccoon.Text.new("", coccoon.GRID_W, coccoon.GRID_H, 0, 0, 16,
		Color.WHITE, Color(0.05, 0.05, 0.15))

	coccoon.Text.new("COCCOON", coccoon.GRID_W, 3, 0, coccoon.GRID_H - 3,
		48, Color.WHITE, Color(0.08, 0.08, 0.22))

	coccoon.Text.new("Up/Down arrows to navigate   Space to launch   Esc to return",
		coccoon.GRID_W, 1, 0, 0, 14, Color(0.5, 0.5, 0.7), Color(0.05, 0.05, 0.15))

	var label_w: float = 22.0
	var label_x: float = (coccoon.GRID_W - label_w) / 2.0
	var center_y: float = 7.0
	var list_top_y: float = center_y + (_games.size() - 1)

	for i in range(_games.size()):
		var y: float = list_top_y - i * 2
		_labels.append(coccoon.Text.new(
			"  " + _format_name(_games[i]), label_w, 1, label_x, y,
			16, Color(0.7, 0.7, 0.9), Color(0.1, 0.1, 0.3)))

	_refresh()

func _refresh() -> void:
	for i in range(_labels.size()):
		if i == _selected:
			_labels[i].set_background_color(Color(0.7, 0.45, 0.0))
			_labels[i].set_font_color(Color.WHITE)
		else:
			_labels[i].set_background_color(Color(0.1, 0.1, 0.3))
			_labels[i].set_font_color(Color(0.7, 0.7, 0.9))

func _input(event: InputEvent) -> void:
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

const _SCENE_NAMES := {
	"benji_the_blob": "benji",
	"deep_space_obrien": "dso",
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
	var path: String = _find_scene(_games[_selected])
	if path != "":
		_labels[_selected].text = "  Loading..."
		_labels[_selected].set_background_color(Color(0.15, 0.15, 0.15))
		await get_tree().process_frame
		get_tree().change_scene_to_file(path)
