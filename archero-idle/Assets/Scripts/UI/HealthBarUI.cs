using UnityEngine;
using UnityEngine.UI;
using ArcheroIdle.Combat;

namespace ArcheroIdle.UI
{
    /// World-space health bar that follows a target transform (player or enemy).
    public class HealthBarUI : MonoBehaviour
    {
        [SerializeField] private Health health;
        [SerializeField] private Image fillImage;
        [SerializeField] private Transform target;
        [SerializeField] private Vector3 worldOffset = new Vector3(0f, 1f, 0f);

        private void OnEnable()
        {
            if (health != null)
            {
                health.OnHealthChanged += UpdateBar;
                UpdateBar(health.CurrentHealth, health.MaxHealth);
            }
        }

        private void OnDisable()
        {
            if (health != null) health.OnHealthChanged -= UpdateBar;
        }

        private void LateUpdate()
        {
            if (target != null)
            {
                transform.position = target.position + worldOffset;
            }
        }

        private void UpdateBar(int current, int max)
        {
            fillImage.fillAmount = max > 0 ? (float)current / max : 0f;
        }
    }
}
