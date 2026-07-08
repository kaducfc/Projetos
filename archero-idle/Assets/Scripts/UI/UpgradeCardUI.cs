using System;
using UnityEngine;
using UnityEngine.UI;
using ArcheroIdle.Upgrades;

namespace ArcheroIdle.UI
{
    public class UpgradeCardUI : MonoBehaviour
    {
        [SerializeField] private Text nameText;
        [SerializeField] private Text descriptionText;
        [SerializeField] private Image iconImage;
        [SerializeField] private Button button;

        public void Setup(UpgradeData data, Action onSelected)
        {
            if (nameText != null) nameText.text = data.upgradeName;
            if (descriptionText != null) descriptionText.text = data.description;
            if (iconImage != null) iconImage.sprite = data.icon;

            button.onClick.RemoveAllListeners();
            button.onClick.AddListener(() => onSelected?.Invoke());
        }
    }
}
