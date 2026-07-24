extends Node2D

## Herói: ataca automaticamente o inimigo atual em intervalos regulares.

signal died
signal hp_changed(current_hp: float, max_hp: float)

var max_hp: float = 100.0
var current_hp: float = 100.0
var attack_interval: float = 1.0

var _target: Node2D = null
var _can_attack: bool = false

@onready var attack_timer: Timer = $AttackTimer


func _ready() -> void:
	attack_timer.wait_time = attack_interval
	attack_timer.timeout.connect(_on_attack_timer_timeout)


func reset_stats() -> void:
	max_hp = GameState.hero_max_hp
	current_hp = max_hp
	hp_changed.emit(current_hp, max_hp)


func set_target(target: Node2D) -> void:
	_target = target


func start_combat() -> void:
	_can_attack = true
	attack_timer.start()


func stop_combat() -> void:
	_can_attack = false
	attack_timer.stop()


func take_damage(amount: float) -> void:
	current_hp = max(current_hp - amount, 0.0)
	hp_changed.emit(current_hp, max_hp)
	if current_hp <= 0.0:
		stop_combat()
		died.emit()


func _on_attack_timer_timeout() -> void:
	if _can_attack and is_instance_valid(_target):
		_target.take_damage(GameState.hero_damage())
