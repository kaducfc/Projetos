extends Node2D

## Desenha a grade quadriculada de fundo da tela de combate.

@export var cell_size: int = 64
@export var grid_color: Color = Color(1, 1, 1, 0.08)


func _ready() -> void:
	queue_redraw()


func _draw() -> void:
	var view_size := get_viewport_rect().size
	var x := 0.0
	while x <= view_size.x:
		draw_line(Vector2(x, 0), Vector2(x, view_size.y), grid_color, 1.0)
		x += cell_size
	var y := 0.0
	while y <= view_size.y:
		draw_line(Vector2(0, y), Vector2(view_size.x, y), grid_color, 1.0)
		y += cell_size
