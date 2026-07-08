using UnityEngine;
using ArcheroIdle.Player;
using ArcheroIdle.UI;
using ArcheroIdle.Upgrades;

namespace ArcheroIdle.Rooms
{
    /// Drives run progression: spawn wave -> wait for clear -> offer upgrade -> next room.
    /// Every `bossRoomInterval` rooms spawns a boss instead of a regular wave.
    public class RoomManager : MonoBehaviour
    {
        [SerializeField] private EnemySpawner spawner;
        [SerializeField] private UpgradeManager upgradeManager;
        [SerializeField] private UpgradeSelectionUI upgradeUI;
        [SerializeField] private PlayerStats playerStats;
        [SerializeField] private int bossRoomInterval = 5;

        public int CurrentRoomIndex { get; private set; }

        private void Start()
        {
            spawner.OnWaveCleared += HandleRoomCleared;
            StartRoom();
        }

        private void OnDestroy()
        {
            if (spawner != null) spawner.OnWaveCleared -= HandleRoomCleared;
        }

        private void StartRoom()
        {
            CurrentRoomIndex++;
            bool isBossRoom = CurrentRoomIndex % bossRoomInterval == 0;
            spawner.SpawnWave(CurrentRoomIndex, isBossRoom);
        }

        private void HandleRoomCleared()
        {
            var choices = upgradeManager.GetRandomChoices(3);
            if (choices.Count == 0)
            {
                StartRoom();
                return;
            }

            upgradeUI.Show(choices, OnUpgradeChosen);
        }

        private void OnUpgradeChosen(UpgradeData chosen)
        {
            upgradeManager.ApplyUpgrade(chosen, playerStats);
            StartRoom();
        }
    }
}
