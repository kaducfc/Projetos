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

            // NOTE: Rigidbody2D.velocity is deprecated in Unity 6 (use linearVelocity there);
            // kept as `velocity` here for compatibility with 2021/2022 LTS.
            rb.velocity = input * stats.MoveSpeed;

            if (input.sqrMagnitude > 0.01f)
            {
                transform.right = input;
            }
        }
    }
}
