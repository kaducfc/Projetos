extends Control

## Interface: estágio, ouro, barras de vida do herói/inimigo e upgrade.

@onready var stage_label: Label = $MarginContainer/VBoxContainer/TopBar/StageLabel
@onready var gold_label: Label = $MarginContainer/VBoxContainer/TopBar/GoldLabel
@onready var hero_hp_bar: ProgressBar = $MarginContainer/VBoxContainer/HeroHPBar
@onready var enemy_name_label: Label = $MarginContainer/VBoxContainer/EnemyNameLabel
@onready var enemy_hp_bar: ProgressBar = $MarginContainer/VBoxContainer/EnemyHPBar
@onready var upgrade_button: Button = $MarginContainer/VBoxContainer/UpgradeButton


func setup(hero: Node2D) -> void:
	hero.hp_changed.connect(_on_hero_hp_changed)
	GameState.gold_changed.connect(_on_gold_changed)
	GameState.stage_changed.connect(_on_stage_changed)
	upgrade_button.pressed.connect(_on_upgrade_pressed)
	_on_gold_changed(GameState.gold)
	_on_stage_changed(GameState.current_stage)
	_refresh_upgrade_button()


func on_enemy_spawned(enemy: Node2D) -> void:
	enemy_name_label.text = "Chefe" if enemy.is_boss else "Inimigo"


func on_enemy_hp_changed(current_hp: float, max_hp: float) -> void:
	enemy_hp_bar.max_value = max_hp
	enemy_hp_bar.value = current_hp


func _on_hero_hp_changed(current_hp: float, max_hp: float) -> void:
	hero_hp_bar.max_value = max_hp
	hero_hp_bar.value = current_hp


func _on_gold_changed(new_gold: int) -> void:
	gold_label.text = "Ouro: %d" % new_gold
	_refresh_upgrade_button()


func _on_stage_changed(new_stage: int) -> void:
	stage_label.text = "Estágio %d" % new_stage


func _on_upgrade_pressed() -> void:
	GameState.buy_damage_upgrade()


func _refresh_upgrade_button() -> void:
	var cost := GameState.damage_upgrade_cost()
	upgrade_button.text = "Upgrade Dano (%d ouro)" % cost
	upgrade_button.disabled = GameState.gold < cost
