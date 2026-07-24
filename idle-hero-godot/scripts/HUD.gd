extends Control

## Interface: nível/ouro/gemas e menu no topo, trilha de progresso do
## estágio, barra de habilidades (AUTO + slots bloqueados), abas de
## categoria e painel de upgrade dos 4 atributos, navegação inferior.

signal auto_toggled(enabled: bool)

const STAT_DISPLAY := {
	"attack": {"name": "Ataque", "color": Color(0.9, 0.35, 0.25)},
	"hp": {"name": "Vida", "color": Color(0.85, 0.2, 0.25)},
	"regen": {"name": "Regeneração de Vida", "color": Color(0.25, 0.75, 0.35)},
	"speed": {"name": "Velocidade de Ataque", "color": Color(0.9, 0.75, 0.2)},
}

@onready var level_label: Label = $MarginContainer/VBoxContainer/TopBar/PlayerBadge/LevelLabel
@onready var gold_label: Label = $MarginContainer/VBoxContainer/TopBar/GoldRow/GoldLabel
@onready var gems_label: Label = $MarginContainer/VBoxContainer/TopBar/GemsRow/GemsLabel
@onready var stage_label: Label = $MarginContainer/VBoxContainer/StageBanner/StageLabel
@onready var stage_path: StagePath = $MarginContainer/VBoxContainer/StageBanner/StagePath
@onready var enemy_name_label: Label = $MarginContainer/VBoxContainer/StageBanner/EnemyNameLabel
@onready var toast_label: Label = $MarginContainer/VBoxContainer/ToastLabel
@onready var auto_button: Button = $MarginContainer/VBoxContainer/AbilityBar/AutoButton
@onready var stats_panel: VBoxContainer = $MarginContainer/VBoxContainer/BottomSheet/BottomSheetContent/StatsPanel

var _stat_rows: Dictionary = {}
var _toast_tween: Tween = null


func setup() -> void:
	GameState.gold_changed.connect(_on_gold_changed)
	GameState.gems_changed.connect(_on_gems_changed)
	GameState.stage_changed.connect(_on_stage_changed)
	GameState.stat_changed.connect(_on_stat_changed)
	GameState.milestone_reached.connect(_on_milestone_reached)
	auto_button.toggled.connect(func(pressed): auto_toggled.emit(pressed))
	_build_stats_panel()
	stage_path.configure(GameState.ENEMIES_PER_STAGE)
	_on_gold_changed(GameState.gold)
	_on_gems_changed(GameState.gems)
	_on_stage_changed(GameState.current_stage)
	_refresh_level()
	toast_label.modulate.a = 0.0


func on_enemy_spawned(enemy: Node2D) -> void:
	enemy_name_label.text = "Chefe" if enemy.is_boss else "Inimigo"


func update_stage_path(defeated_count: int, is_boss_stage: bool) -> void:
	stage_path.update_progress(defeated_count, is_boss_stage)


func show_toast(text: String) -> void:
	toast_label.text = text
	if _toast_tween:
		_toast_tween.kill()
	toast_label.modulate.a = 1.0
	_toast_tween = create_tween()
	_toast_tween.tween_interval(1.4)
	_toast_tween.tween_property(toast_label, "modulate:a", 0.0, 0.6)


func _build_stats_panel() -> void:
	for key in GameState.STAT_ORDER:
		var display: Dictionary = STAT_DISPLAY[key]
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)

		var icon := ColorRect.new()
		icon.custom_minimum_size = Vector2(28, 28)
		icon.color = display.color
		row.add_child(icon)

		var info := VBoxContainer.new()
		info.size_flags_horizontal = SIZE_EXPAND_FILL
		var name_label := Label.new()
		name_label.text = display.name
		var value_label := Label.new()
		value_label.add_theme_color_override("font_color", display.color)
		info.add_child(name_label)
		info.add_child(value_label)
		row.add_child(info)

		var upgrade_button := Button.new()
		upgrade_button.pressed.connect(_on_upgrade_pressed.bind(key))
		row.add_child(upgrade_button)

		stats_panel.add_child(row)
		_stat_rows[key] = {"value_label": value_label, "button": upgrade_button}

	_refresh_all_stats()


func _refresh_all_stats() -> void:
	for key in GameState.STAT_ORDER:
		_refresh_stat_row(key)


func _refresh_stat_row(key: String) -> void:
	var row: Dictionary = _stat_rows[key]
	var level: int = GameState.stat_levels[key]
	var value: float = GameState.stat_value(key)
	var cost: int = GameState.stat_upgrade_cost(key)
	row.value_label.text = "Lv.%d — %s" % [level, _format_stat_value(key, value)]
	row.button.text = "Melhorar (%d)" % cost
	row.button.disabled = GameState.gold < cost


func _format_stat_value(key: String, value: float) -> String:
	if key == "speed":
		return "%.2f atq/s" % (1.0 + value)
	return str(int(round(value)))


func _refresh_level() -> void:
	level_label.text = "Lv.%d" % GameState.player_level()


func _on_upgrade_pressed(key: String) -> void:
	GameState.buy_stat_upgrade(key)


func _on_stat_changed(_key: String) -> void:
	_refresh_all_stats()
	_refresh_level()


func _on_gold_changed(new_gold: int) -> void:
	gold_label.text = str(new_gold)
	_refresh_all_stats()


func _on_gems_changed(new_gems: int) -> void:
	gems_label.text = str(new_gems)


func _on_stage_changed(new_stage: int) -> void:
	@warning_ignore("integer_division")
	var chapter := (new_stage - 1) / GameState.BOSS_STAGE_INTERVAL + 1
	var substage := (new_stage - 1) % GameState.BOSS_STAGE_INTERVAL + 1
	stage_label.text = "STAGE %d-%d" % [chapter, substage]


func _on_milestone_reached(stat_key: String, level: int, gems_awarded: int) -> void:
	var display: Dictionary = STAT_DISPLAY[stat_key]
	show_toast("%s atinge o nível %d! +%d gemas" % [display.name, level, gems_awarded])
