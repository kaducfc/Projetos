extends Control
class_name StagePath

## Trilha de progresso do estágio: bolinhas conectadas por uma linha,
## a última fica maior/roxa quando o estágio atual tem um chefe.

const NODE_RADIUS := 9.0
const BOSS_NODE_RADIUS := 12.0
const LINE_WIDTH := 3.0

var _total: int = 5
var _defeated: int = 0
var _is_boss_stage: bool = false


func configure(total: int) -> void:
	_total = total
	queue_redraw()


func update_progress(defeated: int, is_boss_stage: bool) -> void:
	_defeated = defeated
	_is_boss_stage = is_boss_stage
	queue_redraw()


func _draw() -> void:
	if _total <= 1:
		return
	var spacing: float = size.x / float(_total - 1)
	var y: float = size.y / 2.0

	draw_line(Vector2(0, y), Vector2(size.x, y), Color(1, 1, 1, 0.2), LINE_WIDTH)
	if _defeated > 0:
		var progress_x: float = spacing * min(_defeated, _total - 1)
		draw_line(Vector2(0, y), Vector2(progress_x, y), Color(0.9, 0.85, 0.2), LINE_WIDTH)

	for i in _total:
		var x: float = spacing * i
		var is_last := i == _total - 1
		var defeated := i < _defeated
		if is_last and _is_boss_stage:
			var color := Color(0.3, 0.05, 0.35) if defeated else Color(0.7, 0.1, 0.8)
			draw_circle(Vector2(x, y), BOSS_NODE_RADIUS, color)
			draw_circle(Vector2(x, y), BOSS_NODE_RADIUS * 0.4, Color(0, 0, 0, 0.6))
		else:
			var color := Color(0.9, 0.85, 0.2) if defeated else Color(1, 1, 1, 0.35)
			draw_circle(Vector2(x, y), NODE_RADIUS, color)
