extends Node2D

## Herói: ataca automaticamente o alvo atual, regenera vida com o tempo, e
## mantém sua própria barra de vida flutuante acima do personagem.

signal died
signal damaged(amount: float)

var max_hp: float = 100.0
var current_hp: float = 100.0

var _target: Node2D = null
var _can_attack: bool = false

@onready var attack_timer: Timer = $AttackTimer
@onready var regen_timer: Timer = $RegenTimer
@onready var hp_bar: ProgressBar = $HPBar


func _ready() -> void:
	attack_timer.timeout.connect(_on_attack_timer_timeout)
	regen_timer.wait_time = 1.0
	regen_timer.timeout.connect(_on_regen_timer_timeout)
	regen_timer.start()


func reset_stats() -> void:
	max_hp = GameState.hero_max_hp()
	current_hp = max_hp
	_update_hp_bar()


func set_target(target: Node2D) -> void:
	_target = target


func start_combat() -> void:
	_can_attack = true
	attack_timer.wait_time = GameState.hero_attack_interval()
	attack_timer.start()


func stop_combat() -> void:
	_can_attack = false
	attack_timer.stop()


func take_damage(amount: float) -> void:
	current_hp = max(current_hp - amount, 0.0)
	damaged.emit(amount)
	_update_hp_bar()
	if current_hp <= 0.0:
		stop_combat()
		died.emit()


func _update_hp_bar() -> void:
	hp_bar.max_value = max_hp
	hp_bar.value = current_hp


func _on_attack_timer_timeout() -> void:
	if _can_attack and is_instance_valid(_target):
		_target.take_damage(GameState.hero_damage())


func _on_regen_timer_timeout() -> void:
	if current_hp <= 0.0:
		return
	current_hp = min(current_hp + GameState.hero_regen_per_second(), max_hp)
	_update_hp_bar()
