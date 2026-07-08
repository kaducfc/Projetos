using UnityEngine;
using ArcheroIdle.Combat;

namespace ArcheroIdle.Player
{
    public enum UpgradeType
    {
        Damage,
        AttackSpeed,
        MoveSpeed,
        MaxHealth,
        ProjectileCount,
        Pierce,
        CritChance,
        CritMultiplier
    }

    public class PlayerStats : MonoBehaviour
    {
        [Header("Base Stats")]
        [SerializeField] private int baseMaxHealth = 100;
        [SerializeField] private float baseMoveSpeed = 4f;
        [SerializeField] private int baseDamage = 5;
        [SerializeField] private float baseAttacksPerSecond = 1.5f;
        [SerializeField] private float baseAttackRange = 6f;

        public int MaxHealth { get; private set; }
        public float MoveSpeed { get; private set; }
        public int Damage { get; private set; }
        public float AttacksPerSecond { get; private set; }
        public float AttackRange { get; private set; }
        public int ProjectileCount { get; private set; } = 1;
        public int Pierce { get; private set; }
        public float CritChance { get; private set; } = 0.05f;
        public float CritMultiplier { get; private set; } = 1.5f;

        private void Awake()
        {
            MaxHealth = baseMaxHealth;
            MoveSpeed = baseMoveSpeed;
            Damage = baseDamage;
            AttacksPerSecond = baseAttacksPerSecond;
            AttackRange = baseAttackRange;
        }

        public void ApplyUpgrade(UpgradeType type, float value)
        {
            switch (type)
            {
                case UpgradeType.Damage:
                    Damage += Mathf.RoundToInt(value);
                    break;
                case UpgradeType.AttackSpeed:
                    AttacksPerSecond += value;
                    break;
                case UpgradeType.MoveSpeed:
                    MoveSpeed += value;
                    break;
                case UpgradeType.MaxHealth:
                    int delta = Mathf.RoundToInt(value);
                    MaxHealth += delta;
                    var health = GetComponent<Health>();
                    if (health != null) health.IncreaseMaxHealth(delta);
                    break;
                case UpgradeType.ProjectileCount:
                    ProjectileCount += Mathf.RoundToInt(value);
                    break;
                case UpgradeType.Pierce:
                    Pierce += Mathf.RoundToInt(value);
                    break;
                case UpgradeType.CritChance:
                    CritChance = Mathf.Clamp01(CritChance + value);
                    break;
                case UpgradeType.CritMultiplier:
                    CritMultiplier += value;
                    break;
            }
        }
    }
}
