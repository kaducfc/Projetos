extends Node

## Estado persistente do jogo: ouro, gemas, estágio atual e os 4 atributos
## upgradáveis do herói (ataque, vida, regeneração, velocidade de ataque).
## Autoload singleton (registrado em project.godot como "GameState").

signal gold_changed(new_gold: int)
signal gems_changed(new_gems: int)
signal stage_changed(new_stage: int)
signal stat_changed(stat_key: String)
signal milestone_reached(stat_key: String, level: int, gems_awarded: int)

const ENEMIES_PER_STAGE := 5
const BOSS_STAGE_INTERVAL := 10
const MILESTONE_INTERVAL := 5
const MILESTONE_GEMS := 5
const SAVE_PATH := "user://savegame.json"

const STAT_ORDER := ["attack", "hp", "regen", "speed"]
const STAT_DEFS := {
	"attack": {"base": 10.0, "per_level": 10.0, "cost_base": 8, "cost_growth": 4},
	"hp": {"base": 50.0, "per_level": 25.0, "cost_base": 6, "cost_growth": 3},
	"regen": {"base": 2.0, "per_level": 1.0, "cost_base": 6, "cost_growth": 3},
	"speed": {"base": 0.0, "per_level": 0.15, "cost_base": 18, "cost_growth": 9},
}

var gold: int = 0
var gems: int = 0
var current_stage: int = 1
var stat_levels: Dictionary = {"attack": 1, "hp": 1, "regen": 1, "speed": 1}


func _ready() -> void:
	load_game()


func stat_value(key: String) -> float:
	var def: Dictionary = STAT_DEFS[key]
	return def.base + def.per_level * (stat_levels[key] - 1)


func stat_upgrade_cost(key: String) -> int:
	var def: Dictionary = STAT_DEFS[key]
	return def.cost_base + def.cost_growth * (stat_levels[key] - 1)


func buy_stat_upgrade(key: String) -> bool:
	var cost := stat_upgrade_cost(key)
	if gold < cost:
		return false
	gold -= cost
	stat_levels[key] += 1
	gold_changed.emit(gold)
	stat_changed.emit(key)
	if stat_levels[key] % MILESTONE_INTERVAL == 0:
		gems += MILESTONE_GEMS
		gems_changed.emit(gems)
		milestone_reached.emit(key, stat_levels[key], MILESTONE_GEMS)
	save_game()
	return true


func hero_damage() -> float:
	return stat_value("attack")


func hero_max_hp() -> float:
	return stat_value("hp")


func hero_regen_per_second() -> float:
	return stat_value("regen")


func hero_attack_interval() -> float:
	return 1.0 / (1.0 + stat_value("speed"))


func player_level() -> int:
	var total := 0
	for key in STAT_ORDER:
		total += stat_levels[key]
	@warning_ignore("integer_division")
	return 1 + total / STAT_ORDER.size()


func add_gold(amount: int) -> void:
	gold += amount
	gold_changed.emit(gold)
	save_game()


func add_gems(amount: int) -> void:
	if amount <= 0:
		return
	gems += amount
	gems_changed.emit(gems)
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
		"gems": gems,
		"current_stage": current_stage,
		"stat_levels": stat_levels,
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
	gems = parsed.get("gems", gems)
	current_stage = parsed.get("current_stage", current_stage)
	var loaded_stats = parsed.get("stat_levels", null)
	if typeof(loaded_stats) == TYPE_DICTIONARY:
		for key in STAT_ORDER:
			stat_levels[key] = loaded_stats.get(key, stat_levels[key])
