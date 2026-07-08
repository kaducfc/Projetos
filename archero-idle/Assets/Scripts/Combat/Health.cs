using System;
using UnityEngine;

namespace ArcheroIdle.Combat
{
    public class Health : MonoBehaviour
    {
        [SerializeField] private int maxHealth = 10;

        public int MaxHealth => maxHealth;
        public int CurrentHealth { get; private set; }

        public event Action<int, int> OnHealthChanged; // current, max
        public event Action<int, bool> OnDamaged;       // amount, isCrit
        public event Action OnDeath;

        private bool isDead;

        private void Awake()
        {
            CurrentHealth = maxHealth;
        }

        /// Sets stats fresh (used by spawners scaling enemy difficulty per room).
        public void Init(int newMaxHealth)
        {
            maxHealth = Mathf.Max(1, newMaxHealth);
            CurrentHealth = maxHealth;
            isDead = false;
            OnHealthChanged?.Invoke(CurrentHealth, maxHealth);
        }

        /// Raises max health and heals by the same delta (used by permanent upgrades).
        public void IncreaseMaxHealth(int amount)
        {
            if (amount <= 0) return;
            maxHealth += amount;
            CurrentHealth += amount;
            OnHealthChanged?.Invoke(CurrentHealth, maxHealth);
        }

        public void TakeDamage(int amount, bool isCrit = false)
        {
            if (isDead || amount <= 0) return;

            CurrentHealth = Mathf.Max(0, CurrentHealth - amount);
            OnDamaged?.Invoke(amount, isCrit);
            OnHealthChanged?.Invoke(CurrentHealth, maxHealth);

            if (CurrentHealth == 0)
            {
                isDead = true;
                OnDeath?.Invoke();
            }
        }

        public void Heal(int amount)
        {
            if (isDead || amount <= 0) return;
            CurrentHealth = Mathf.Min(maxHealth, CurrentHealth + amount);
            OnHealthChanged?.Invoke(CurrentHealth, maxHealth);
        }
    }
}
