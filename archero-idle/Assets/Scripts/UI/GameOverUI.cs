using UnityEngine;
using UnityEngine.UI;
using ArcheroIdle.Core;

namespace ArcheroIdle.UI
{
    public class GameOverUI : MonoBehaviour
    {
        [SerializeField] private Button restartButton;

        private void Awake()
        {
            restartButton.onClick.AddListener(() =>
            {
                if (GameManager.Instance != null) GameManager.Instance.RestartRun();
            });
        }
    }
}
