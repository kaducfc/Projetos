using System.Collections;
using UnityEngine;
using ArcheroIdle.Combat;

namespace ArcheroIdle.Enemies
{
    /// Boss variant with a normal contact attack plus a telegraphed AOE slam,
    /// mirroring Archero's "wait for the red circle, then dodge" boss pattern.
    [RequireComponent(typeof(Rigidbody2D), typeof(Health))]
    public class BossController : MonoBehaviour
    {
        [Header("Base Stats (scaled at spawn via Init)")]
        [SerializeField] private int baseHealth = 200;
        [SerializeField] private int baseContactDamage = 10;
        [SerializeField] private int baseSlamDamage = 25;
        [SerializeField] private float moveSpeed = 1.5f;
        [SerializeField] private float contactRange = 1.5f;
        [SerializeField] private float contactDamageCooldown = 1f;

        [Header("Slam Attack")]
        [SerializeField] private float slamRadius = 3f;
        [SerializeField] private float slamTelegraphTime = 1f;
        [SerializeField] private float slamCooldown = 4f;
        [SerializeField] private GameObject slamTelegraphPrefab;

        private Rigidbody2D rb;
        private Health health;
        private Transform player;
        private int scaledContactDamage;
        private int scaledSlamDamage;
        private float slamTimer;
        private float contactDamageTimer;
        private bool isSlamming;

        private void Awake()
        {
            rb = GetComponent<Rigidbody2D>();
            health = GetComponent<Health>();
            scaledContactDamage = baseContactDamage;
            scaledSlamDamage = baseSlamDamage;
        }

        private void Start()
        {
            var playerObj = GameObject.FindGameObjectWithTag("Player");
            if (playerObj != null) player = playerObj.transform;
            slamTimer = slamCooldown;
        }

        /// Called by EnemySpawner right after Instantiate to scale stats with room difficulty.
        public void Init(float difficultyMultiplier)
        {
            health.Init(Mathf.RoundToInt(baseHealth * difficultyMultiplier));
            scaledContactDamage = Mathf.RoundToInt(baseContactDamage * difficultyMultiplier);
            scaledSlamDamage = Mathf.RoundToInt(baseSlamDamage * difficultyMultiplier);
        }

        private void Update()
        {
            if (player == null || isSlamming) return;

            slamTimer -= Time.deltaTime;
            if (slamTimer <= 0f)
            {
                StartCoroutine(SlamAttack());
                return;
            }

            float distance = Vector2.Distance(transform.position, player.position);
            if (distance <= contactRange)
            {
                contactDamageTimer -= Time.deltaTime;
                if (contactDamageTimer <= 0f)
                {
                    Health playerHealth = player.GetComponent<Health>();
                    if (playerHealth != null) playerHealth.TakeDamage(scaledContactDamage);
                    contactDamageTimer = contactDamageCooldown;
                }
            }
        }

        private void FixedUpdate()
        {
            if (player == null || isSlamming)
            {
                rb.velocity = Vector2.zero;
                return;
            }

            float distance = Vector2.Distance(transform.position, player.position);
            if (distance > contactRange)
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

        private IEnumerator SlamAttack()
        {
            isSlamming = true;
            rb.velocity = Vector2.zero;

            GameObject telegraph = null;
            if (slamTelegraphPrefab != null)
            {
                telegraph = Instantiate(slamTelegraphPrefab, transform.position, Quaternion.identity);
                telegraph.transform.localScale = Vector3.one * slamRadius * 2f;
            }

            yield return new WaitForSeconds(slamTelegraphTime);

            if (telegraph != null) Destroy(telegraph);

            if (player != null)
            {
                float distance = Vector2.Distance(transform.position, player.position);
                if (distance <= slamRadius)
                {
                    Health playerHealth = player.GetComponent<Health>();
                    if (playerHealth != null) playerHealth.TakeDamage(scaledSlamDamage);
                }
            }

            isSlamming = false;
            slamTimer = slamCooldown;
        }
    }
}
