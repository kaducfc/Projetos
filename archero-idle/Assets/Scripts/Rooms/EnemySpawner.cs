using System;
using UnityEngine;
using ArcheroIdle.Combat;
using ArcheroIdle.Enemies;

namespace ArcheroIdle.Rooms
{
    public class EnemySpawner : MonoBehaviour
    {
        [Header("Prefabs")]
        [SerializeField] private EnemyController meleeEnemyPrefab;
        [SerializeField] private EnemyController rangedEnemyPrefab;
        [SerializeField] private BossController bossPrefab;
        [SerializeField] private Transform[] spawnPoints;

        [Header("Difficulty Scaling")]
        [SerializeField] private int baseEnemyCount = 4;
        [SerializeField] private int maxEnemyCount = 14;
        [SerializeField] private float difficultyStepPerRoom = 0.12f;
        [SerializeField] [Range(0f, 1f)] private float rangedSpawnChance = 0.3f;

        /// Fired once every enemy spawned for the current room has died.
        public event Action OnWaveCleared;

        private int aliveCount;

        public void SpawnWave(int roomIndex, bool isBossRoom)
        {
            aliveCount = 0;
            float multiplier = 1f + roomIndex * difficultyStepPerRoom;

            if (isBossRoom && bossPrefab != null)
            {
                Transform point = spawnPoints[spawnPoints.Length / 2];
                BossController boss = Instantiate(bossPrefab, point.position, Quaternion.identity);
                boss.Init(multiplier);
                RegisterEnemy(boss.GetComponent<Health>());
                return;
            }

            int count = Mathf.Min(maxEnemyCount, baseEnemyCount + roomIndex);

            for (int i = 0; i < count; i++)
            {
                Transform point = spawnPoints[UnityEngine.Random.Range(0, spawnPoints.Length)];
                bool spawnRanged = rangedEnemyPrefab != null && UnityEngine.Random.value < rangedSpawnChance;
                EnemyController prefab = spawnRanged ? rangedEnemyPrefab : meleeEnemyPrefab;

                EnemyController enemy = Instantiate(prefab, point.position, Quaternion.identity);
                enemy.Init(multiplier);
                RegisterEnemy(enemy.GetComponent<Health>());
            }
        }

        private void RegisterEnemy(Health health)
        {
            if (health == null) return;
            aliveCount++;
            health.OnDeath += HandleEnemyDeath;
        }

        private void HandleEnemyDeath()
        {
            aliveCount--;
            if (aliveCount <= 0)
            {
                OnWaveCleared?.Invoke();
            }
        }
    }
}
