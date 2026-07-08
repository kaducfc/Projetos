using UnityEngine;

namespace ArcheroIdle.Combat
{
    [RequireComponent(typeof(Rigidbody2D))]
    public class Projectile : MonoBehaviour
    {
        [SerializeField] private float speed = 12f;
        [SerializeField] private float lifetime = 3f;
        [SerializeField] private LayerMask hittableLayer;

        private int damage;
        private bool isCrit;
        private int pierceRemaining;
        private Rigidbody2D rb;

        private void Awake()
        {
            rb = GetComponent<Rigidbody2D>();
        }

        public void Launch(Vector2 direction, int damageAmount, bool crit, int pierceCount)
        {
            damage = damageAmount;
            isCrit = crit;
            pierceRemaining = pierceCount;

            if (direction.sqrMagnitude > 0.0001f)
            {
                transform.right = direction;
            }

            rb.linearVelocity = direction * speed;

            Destroy(gameObject, lifetime);
        }

        private void OnTriggerEnter2D(Collider2D other)
        {
            if (((1 << other.gameObject.layer) & hittableLayer) == 0) return;

            Health health = other.GetComponent<Health>();
            if (health != null)
            {
                health.TakeDamage(damage, isCrit);
            }

            if (pierceRemaining > 0)
            {
                pierceRemaining--;
            }
            else
            {
                Destroy(gameObject);
            }
        }
    }
}
