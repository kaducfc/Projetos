using UnityEngine;
using UnityEngine.SceneManagement;
using ArcheroIdle.Combat;

namespace ArcheroIdle.Core
{
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [SerializeField] private Health playerHealth;
        [SerializeField] private GameObject gameOverPanel;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            if (playerHealth != null)
            {
                playerHealth.OnDeath += HandleGameOver;
            }
        }

        private void HandleGameOver()
        {
            Time.timeScale = 0f;
            if (gameOverPanel != null) gameOverPanel.SetActive(true);
        }

        public void RestartRun()
        {
            Time.timeScale = 1f;
            SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
        }
    }
}
