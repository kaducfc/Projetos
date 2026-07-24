extends Node

## Estado persistente do jogo: ouro, estágio atual e upgrades do herói.
## Autoload singleton (registrado em project.godot como "GameState").

signal gold_changed(new_gold: int)
signal stage_changed(new_stage: int)

const ENEMIES_PER_STAGE := 5
const BOSS_STAGE_INTERVAL := 10
const SAVE_PATH := "user://savegame.json"

var gold: int = 0
var current_stage: int = 1
var damage_upgrade_level: int = 0

var hero_base_damage: float = 10.0
var hero_max_hp: float = 100.0


func _ready() -> void:
	load_game()


func hero_damage() -> float:
	return hero_base_damage + damage_upgrade_level * 4.0


func damage_upgrade_cost() -> int:
	return 20 + damage_upgrade_level * 15


func buy_damage_upgrade() -> bool:
	var cost := damage_upgrade_cost()
	if gold < cost:
		return false
	gold -= cost
	damage_upgrade_level += 1
	gold_changed.emit(gold)
	save_game()
	return true


func add_gold(amount: int) -> void:
	gold += amount
	gold_changed.emit(gold)
	save_game()


func is_boss_stage(stage: int) -> bool:
	return stage % BOSS_STAGE_INTERVAL == 0


func advance_stage() -> void:
	current_stage += 1
	stage_changed.emit(current_stage)
	save_game()


func save_game() -> void:
	var data := {
		"gold": gold,
		"current_stage": current_stage,
		"damage_upgrade_level": damage_upgrade_level,
	}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))


func load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not file:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	gold = parsed.get("gold", gold)
	current_stage = parsed.get("current_stage", current_stage)
	damage_upgrade_level = parsed.get("damage_upgrade_level", damage_upgrade_level)
