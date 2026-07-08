using System;
using System.Collections.Generic;
using UnityEngine;
using ArcheroIdle.Upgrades;

namespace ArcheroIdle.UI
{
    public class UpgradeSelectionUI : MonoBehaviour
    {
        [SerializeField] private GameObject panel;
        [SerializeField] private UpgradeCardUI[] cards;

        public void Show(List<UpgradeData> choices, Action<UpgradeData> onChosen)
        {
            panel.SetActive(true);
            Time.timeScale = 0f;

            for (int i = 0; i < cards.Length; i++)
            {
                if (i < choices.Count)
                {
                    UpgradeData data = choices[i];
                    cards[i].gameObject.SetActive(true);
                    cards[i].Setup(data, () => Choose(data, onChosen));
                }
                else
                {
                    cards[i].gameObject.SetActive(false);
                }
            }
        }

        private void Choose(UpgradeData data, Action<UpgradeData> onChosen)
        {
            panel.SetActive(false);
            Time.timeScale = 1f;
            onChosen?.Invoke(data);
        }
    }
}
