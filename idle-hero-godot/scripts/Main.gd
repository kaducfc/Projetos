extends Node2D

## Orquestra o loop principal: spawn de inimigos vindo da direita, avanço
## de estágio a cada onda derrotada e estágios de chefe a cada N estágios.

const EnemyScene := preload("res://scenes/Enemy.tscn")

@onready var hero: Node2D = $Hero
@onready var enemy_spawn: Marker2D = $EnemySpawnPoint
@onready var engage_point: Marker2D = $EngagePoint
@onready var hud: Control = $HUDLayer/HUD

var _current_enemy: Node2D = null
var _enemy_index: int = 0


func _ready() -> void:
	hero.reset_stats()
	hero.died.connect(_on_hero_died)
	hud.setup(hero)
	_start_stage()


func _start_stage() -> void:
	_enemy_index = 0
	_spawn_next_enemy()


func _spawn_next_enemy() -> void:
	_enemy_index += 1
	var stage := GameState.current_stage
	var is_final_enemy := _enemy_index >= GameState.ENEMIES_PER_STAGE
	var is_boss := is_final_enemy and GameState.is_boss_stage(stage)

	var enemy: Node2D = EnemyScene.instantiate()
	enemy.max_hp = _enemy_hp_for_stage(stage, is_boss)
	enemy.damage = _enemy_damage_for_stage(stage, is_boss)
	enemy.gold_reward = _enemy_gold_for_stage(stage, is_boss)
	enemy.is_boss = is_boss
	enemy.position = enemy_spawn.position
	add_child(enemy)
	_current_enemy = enemy

	enemy.died.connect(_on_enemy_died.bind(is_final_enemy))
	enemy.hp_changed.connect(hud.on_enemy_hp_changed)
	hud.on_enemy_spawned(enemy)

	var tween := create_tween()
	tween.tween_property(enemy, "position", engage_point.position, 1.0)
	tween.tween_callback(_begin_combat.bind(enemy))


func _begin_combat(enemy: Node2D) -> void:
	if not is_instance_valid(enemy):
		return
	hero.set_target(enemy)
	enemy.set_target(hero)
	hero.start_combat()
	enemy.start_combat()


func _on_enemy_died(gold_reward: int, was_final_enemy: bool) -> void:
	GameState.add_gold(gold_reward)
	hero.stop_combat()
	if was_final_enemy:
		GameState.advance_stage()
		_start_stage()
	else:
		_spawn_next_enemy()


func _on_hero_died() -> void:
	if is_instance_valid(_current_enemy):
		_current_enemy.stop_combat()
	hero.reset_stats()
	hero.start_combat()
	if is_instance_valid(_current_enemy):
		_current_enemy.start_combat()


func _enemy_hp_for_stage(stage: int, is_boss: bool) -> float:
	var hp: float = 20.0 * pow(1.15, stage - 1)
	return hp * 5.0 if is_boss else hp


func _enemy_damage_for_stage(stage: int, is_boss: bool) -> float:
	var dmg: float = 4.0 * pow(1.12, stage - 1)
	return dmg * 1.8 if is_boss else dmg


func _enemy_gold_for_stage(stage: int, is_boss: bool) -> int:
	var reward: int = 5 + stage * 2
	return reward * 10 if is_boss else reward
