using UnityEngine;
using ArcheroIdle.Player;

namespace ArcheroIdle.Upgrades
{
    [CreateAssetMenu(fileName = "UpgradeData", menuName = "ArcheroIdle/Upgrade")]
    public class UpgradeData : ScriptableObject
    {
        public string upgradeName;
        [TextArea] public string description;
        public Sprite icon;
        public UpgradeType type;
        public float value;
    }
}
