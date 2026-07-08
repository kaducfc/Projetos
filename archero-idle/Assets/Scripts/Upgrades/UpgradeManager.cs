using System.Collections.Generic;
using UnityEngine;
using ArcheroIdle.Player;

namespace ArcheroIdle.Upgrades
{
    public class UpgradeManager : MonoBehaviour
    {
        [SerializeField] private List<UpgradeData> allUpgrades = new List<UpgradeData>();

        /// Returns up to `count` distinct random upgrades from the pool (no repeats per call).
        public List<UpgradeData> GetRandomChoices(int count)
        {
            var pool = new List<UpgradeData>(allUpgrades);
            var result = new List<UpgradeData>();

            int pickCount = Mathf.Min(count, pool.Count);
            for (int i = 0; i < pickCount; i++)
            {
                int index = Random.Range(0, pool.Count);
                result.Add(pool[index]);
                pool.RemoveAt(index);
            }
            return result;
        }

        public void ApplyUpgrade(UpgradeData data, PlayerStats stats)
        {
            stats.ApplyUpgrade(data.type, data.value);
        }
    }
}
