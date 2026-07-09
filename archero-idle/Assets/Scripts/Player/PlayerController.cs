using UnityEngine;

namespace ArcheroIdle.Player
{
    [RequireComponent(typeof(Rigidbody2D), typeof(PlayerStats))]
    public class PlayerController : MonoBehaviour
    {
        [SerializeField] private VirtualJoystick joystick;

        private Rigidbody2D rb;
        private PlayerStats stats;

        private void Awake()
        {
            rb = GetComponent<Rigidbody2D>();
            stats = GetComponent<PlayerStats>();
        }

        private void FixedUpdate()
        {
            Vector2 input = joystick != null ? joystick.Direction : Vector2.zero;

#if ENABLE_LEGACY_INPUT_MANAGER
            if (input.sqrMagnitude < 0.01f)
            {
                // Keyboard fallback so the game is testable in the Editor without touch input.
                // Compiled out entirely when the project uses the new Input System exclusively.
                input = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical")).normalized;
            }
#endif

            rb.linearVelocity = input * stats.MoveSpeed;

            if (input.sqrMagnitude > 0.01f)
            {
                transform.right = input;
            }
        }
    }
}
