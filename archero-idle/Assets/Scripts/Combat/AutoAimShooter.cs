using UnityEngine;
using ArcheroIdle.Player;

namespace ArcheroIdle.Combat
{
    [RequireComponent(typeof(PlayerStats))]
    public class AutoAimShooter : MonoBehaviour
    {
        [SerializeField] private Projectile projectilePrefab;
        [SerializeField] private Transform firePoint;
        [SerializeField] private LayerMask enemyLayer;
        [SerializeField] private float spreadAngleDegrees = 12f;

        private PlayerStats stats;
        private float cooldownTimer;
        private Transform currentTarget;

        private void Awake()
        {
            stats = GetComponent<PlayerStats>();
        }

        private void Update()
        {
            currentTarget = FindNearestEnemy();
            if (currentTarget == null) return;

            AimFirePointAt(currentTarget);

            cooldownTimer -= Time.deltaTime;
            if (cooldownTimer <= 0f)
            {
                Shoot(currentTarget);
                cooldownTimer = 1f / Mathf.Max(0.01f, stats.AttacksPerSecond);
            }
        }

        private void AimFirePointAt(Transform target)
        {
            Vector2 dir = (target.position - firePoint.position).normalized;
            float angle = Mathf.Atan2(dir.y, dir.x) * Mathf.Rad2Deg;
            firePoint.rotation = Quaternion.Euler(0f, 0f, angle);
        }

        private Transform FindNearestEnemy()
        {
            Collider2D[] hits = Physics2D.OverlapCircleAll(transform.position, stats.AttackRange, enemyLayer);
            Transform nearest = null;
            float nearestDistSqr = float.MaxValue;

            foreach (var hit in hits)
            {
                float distSqr = (hit.transform.position - transform.position).sqrMagnitude;
                if (distSqr < nearestDistSqr)
                {
                    nearestDistSqr = distSqr;
                    nearest = hit.transform;
                }
            }
            return nearest;
        }

        private void Shoot(Transform target)
        {
            Vector2 baseDirection = (target.position - firePoint.position).normalized;
            int count = Mathf.Max(1, stats.ProjectileCount);
            float startAngle = -(spreadAngleDegrees * (count - 1)) / 2f;

            for (int i = 0; i < count; i++)
            {
                float angle = startAngle + spreadAngleDegrees * i;
                Vector2 direction = Quaternion.Euler(0f, 0f, angle) * baseDirection;

                bool isCrit = Random.value < stats.CritChance;
                int damage = isCrit ? Mathf.RoundToInt(stats.Damage * stats.CritMultiplier) : stats.Damage;

                Projectile projectile = Instantiate(projectilePrefab, firePoint.position, Quaternion.identity);
                projectile.Launch(direction, damage, isCrit, stats.Pierce);
            }
        }
    }
}
