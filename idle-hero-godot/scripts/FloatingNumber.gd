extends Node2D

## Número de dano que sobe e desaparece sobre quem recebeu o golpe.


@onready var label: Label = $Label


func setup(text: String, color: Color) -> void:
	label.text = text
	label.modulate = color
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(self, "position:y", position.y - 50.0, 0.7).set_trans(Tween.TRANS_SINE)
	tween.tween_property(label, "modulate:a", 0.0, 0.7)
	tween.chain().tween_callback(queue_free)
