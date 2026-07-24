extends Node2D

## Inimigo: caminha até o ponto de combate e então troca golpes com o herói
## em intervalos regulares, até um dos dois morrer.

signal died(gold_reward: int)
signal hp_changed(current_hp: float, max_hp: float)

var max_hp: float = 20.0
var current_hp: float = 20.0
var damage: float = 5.0
var attack_interval: float = 1.2
var gold_reward: int = 5
var is_boss: bool = false

var _target: Node2D = null
var _can_attack: bool = false

@onready var attack_timer: Timer = $AttackTimer


func _ready() -> void:
	attack_timer.wait_time = attack_interval
	attack_timer.timeout.connect(_on_attack_timer_timeout)
	current_hp = max_hp
	hp_changed.emit(current_hp, max_hp)
	if is_boss:
		scale = Vector2(1.6, 1.6)
		modulate = Color(0.85, 0.2, 0.9)


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
		died.emit(gold_reward)
		queue_free()


func _on_attack_timer_timeout() -> void:
	if _can_attack and is_instance_valid(_target):
		_target.take_damage(damage)
