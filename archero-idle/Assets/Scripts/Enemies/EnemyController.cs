using UnityEngine;
using ArcheroIdle.Combat;

namespace ArcheroIdle.Enemies
{
    [RequireComponent(typeof(Rigidbody2D), typeof(Health))]
    public class EnemyController : MonoBehaviour
    {
        [Header("Base Stats (scaled at spawn via Init)")]
        [SerializeField] private int baseHealth = 20;
        [SerializeField] private int baseDamage = 5;
        [SerializeField] private float moveSpeed = 2f;
        [SerializeField] private float attackRange = 1.2f;
        [SerializeField] private float attackCooldown = 1f;

        [Header("Ranged Attack (optional)")]
        [SerializeField] private bool isRanged;
        [SerializeField] private Projectile projectilePrefab;
        [SerializeField] private Transform firePoint;

        private Rigidbody2D rb;
        private Health health;
        private Transform player;
        private float attackTimer;
        private int scaledDamage;

        private void Awake()
        {
            rb = GetComponent<Rigidbody2D>();
            health = GetComponent<Health>();
            scaledDamage = baseDamage;
        }

        private void Start()
        {
            var playerObj = GameObject.FindGameObjectWithTag("Player");
            if (playerObj != null) player = playerObj.transform;
        }

        /// Called by EnemySpawner right after Instantiate to scale stats with room difficulty.
        public void Init(float difficultyMultiplier)
        {
            health.Init(Mathf.RoundToInt(baseHealth * difficultyMultiplier));
            scaledDamage = Mathf.RoundToInt(baseDamage * difficultyMultiplier);
        }

        private void FixedUpdate()
        {
            if (player == null)
            {
                rb.velocity = Vector2.zero;
                return;
            }

            float distance = Vector2.Distance(transform.position, player.position);

            if (distance > attackRange)
            {
                Vector2 direction = (player.position - transform.position).normalized;
                rb.velocity = direction * moveSpeed;
                transform.right = direction;
            }
            else
            {
                rb.velocity = Vector2.zero;
            }
        }

        private void Update()
        {
            if (player == null) return;

            float distance = Vector2.Distance(transform.position, player.position);
            if (distance > attackRange) return;

            attackTimer -= Time.deltaTime;
            if (attackTimer <= 0f)
            {
                Attack();
                attackTimer = attackCooldown;
            }
        }

        private void Attack()
        {
            if (isRanged && projectilePrefab != null && firePoint != null)
            {
                Vector2 direction = (player.position - firePoint.position).normalized;
                Projectile projectile = Instantiate(projectilePrefab, firePoint.position, Quaternion.identity);
                projectile.Launch(direction, scaledDamage, false, 0);
            }
            else
            {
                Health playerHealth = player.GetComponent<Health>();
                if (playerHealth != null)
                {
                    playerHealth.TakeDamage(scaledDamage);
                }
            }
        }
    }
}
