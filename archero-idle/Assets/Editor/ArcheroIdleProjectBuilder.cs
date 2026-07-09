using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using ArcheroIdle.Combat;
using ArcheroIdle.Core;
using ArcheroIdle.Enemies;
using ArcheroIdle.Player;
using ArcheroIdle.Rooms;
using ArcheroIdle.UI;
using ArcheroIdle.Upgrades;

namespace ArcheroIdle.EditorTools
{
    /// One-click generator that wires up the whole demo project (layers, placeholder
    /// sprites, prefabs, upgrade assets and a playable scene) from the gameplay scripts.
    /// Run it via the "ArcheroIdle/Build Demo Project" menu after importing this repo's
    /// Assets folder into a fresh Unity 6 2D project. Safe to re-run.
    public static class ArcheroIdleProjectBuilder
    {
        private const string SpritesFolder = "Assets/Sprites";
        private const string PrefabsFolder = "Assets/Prefabs";
        private const string UpgradesFolder = "Assets/Upgrades";
        private const string ScenesFolder = "Assets/Scenes";
        private const string ScenePath = ScenesFolder + "/MainScene.unity";

        private const float ArenaWidth = 16f;
        private const float ArenaHeight = 10f;
        private const int SpawnPointCount = 6;
        private const float SpawnRadius = 4f;

        [MenuItem("ArcheroIdle/Build Demo Project")]
        public static void Build()
        {
            EnsureFolders();
            EnsureLayers();
            EnsureLegacyInputHandling();
            AssetDatabase.SaveAssets();

            var sprites = CreateSprites();
            List<UpgradeData> upgrades = CreateUpgrades();

            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            GameObject playerProjectilePrefab = CreateProjectilePrefab(
                "PlayerProjectile", sprites.Projectile, "Enemy");
            GameObject enemyProjectilePrefab = CreateProjectilePrefab(
                "EnemyProjectile", sprites.Projectile, "Player");
            GameObject slamTelegraphPrefab = CreateSlamTelegraphPrefab(sprites.Telegraph);

            GameObject playerPrefab = CreatePlayerPrefab(sprites.Player, playerProjectilePrefab);
            GameObject meleeEnemyPrefab = CreateEnemyPrefab("MeleeEnemy", sprites.MeleeEnemy, false, null);
            GameObject rangedEnemyPrefab = CreateEnemyPrefab("RangedEnemy", sprites.RangedEnemy, true, enemyProjectilePrefab);
            GameObject bossPrefab = CreateBossPrefab(sprites.Boss, slamTelegraphPrefab);

            BuildScene(sprites, playerPrefab, meleeEnemyPrefab, rangedEnemyPrefab, bossPrefab, upgrades);

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            EditorUtility.DisplayDialog(
                "Archero Idle",
                "Projeto montado em " + ScenePath + ".\n\nAperte Play para testar " +
                "(WASD/setas ou arraste o joystick na tela).",
                "OK");
        }

        // ---------------------------------------------------------------
        // Project setup: folders, layers, input handling
        // ---------------------------------------------------------------

        private static void EnsureFolders()
        {
            CreateFolderIfMissing(SpritesFolder);
            CreateFolderIfMissing(PrefabsFolder);
            CreateFolderIfMissing(UpgradesFolder);
            CreateFolderIfMissing(ScenesFolder);
        }

        private static void CreateFolderIfMissing(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            string parent = Path.GetDirectoryName(path).Replace("\\", "/");
            string newFolder = Path.GetFileName(path);
            AssetDatabase.CreateFolder(parent, newFolder);
        }

        private static void EnsureLayers()
        {
            AddLayer("Player");
            AddLayer("Enemy");
        }

        private static void AddLayer(string name)
        {
            var tagManager = new SerializedObject(
                AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/TagManager.asset")[0]);
            var layersProp = tagManager.FindProperty("layers");

            for (int i = 8; i < layersProp.arraySize; i++)
            {
                if (layersProp.GetArrayElementAtIndex(i).stringValue == name) return;
            }

            for (int i = 8; i < layersProp.arraySize; i++)
            {
                var element = layersProp.GetArrayElementAtIndex(i);
                if (string.IsNullOrEmpty(element.stringValue))
                {
                    element.stringValue = name;
                    tagManager.ApplyModifiedProperties();
                    return;
                }
            }

            Debug.LogWarning($"ArcheroIdleProjectBuilder: no free layer slot for '{name}'.");
        }

        /// Forces legacy Input Manager so the built-in EventSystem / StandaloneInputModule
        /// works without requiring the Input System package.
        private static void EnsureLegacyInputHandling()
        {
            var assets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset");
            if (assets == null || assets.Length == 0) return;

            var settings = new SerializedObject(assets[0]);
            var prop = settings.FindProperty("activeInputHandler");
            if (prop != null)
            {
                prop.intValue = 0; // 0 = Input Manager (Old)
                settings.ApplyModifiedProperties();
            }
        }

        // ---------------------------------------------------------------
        // Placeholder sprites
        // ---------------------------------------------------------------

        private class SpriteSet
        {
            public Sprite Player;
            public Sprite MeleeEnemy;
            public Sprite RangedEnemy;
            public Sprite Boss;
            public Sprite Projectile;
            public Sprite Telegraph;
            public Sprite Ground;
        }

        private static SpriteSet CreateSprites()
        {
            return new SpriteSet
            {
                Player = CreateSprite("Player", new Color(0.2f, 0.55f, 1f), 96, true),
                MeleeEnemy = CreateSprite("MeleeEnemy", new Color(0.85f, 0.2f, 0.2f), 80, true),
                RangedEnemy = CreateSprite("RangedEnemy", new Color(0.95f, 0.55f, 0.1f), 80, true),
                Boss = CreateSprite("Boss", new Color(0.55f, 0.15f, 0.75f), 160, true),
                Projectile = CreateSprite("Projectile", new Color(1f, 0.95f, 0.3f), 32, true),
                Telegraph = CreateSprite("Telegraph", new Color(1f, 0.1f, 0.1f, 0.35f), 128, true),
                Ground = CreateSprite("Ground", new Color(0.18f, 0.18f, 0.2f), 64, false),
            };
        }

        private static Sprite CreateSprite(string name, Color color, int size, bool circle)
        {
            string path = $"{SpritesFolder}/{name}.png";
            Sprite existing = AssetDatabase.LoadAssetAtPath<Sprite>(path);
            if (existing != null) return existing;

            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            Vector2 center = new Vector2(size / 2f, size / 2f);
            float radius = size / 2f - 1f;

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    bool inside = true;
                    if (circle)
                    {
                        float dist = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), center);
                        inside = dist <= radius;
                    }
                    tex.SetPixel(x, y, inside ? color : new Color(0f, 0f, 0f, 0f));
                }
            }
            tex.Apply();

            byte[] png = tex.EncodeToPNG();
            Object.DestroyImmediate(tex);
            File.WriteAllBytes(path, png);
            AssetDatabase.ImportAsset(path);

            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = 64;
            importer.filterMode = FilterMode.Bilinear;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            importer.SaveAndReimport();

            return AssetDatabase.LoadAssetAtPath<Sprite>(path);
        }

        // ---------------------------------------------------------------
        // Upgrades
        // ---------------------------------------------------------------

        private static List<UpgradeData> CreateUpgrades()
        {
            var defs = new (string type, string name, string desc, UpgradeType upgradeType, float value)[]
            {
                ("Damage", "Dano +2", "Aumenta o dano dos seus projéteis.", UpgradeType.Damage, 2f),
                ("AttackSpeed", "Velocidade de Ataque +0.3", "Atira mais rápido.", UpgradeType.AttackSpeed, 0.3f),
                ("MoveSpeed", "Velocidade de Movimento +0.5", "Move-se mais rápido.", UpgradeType.MoveSpeed, 0.5f),
                ("MaxHealth", "Vida Máxima +20", "Aumenta sua vida máxima e cura o mesmo tanto.", UpgradeType.MaxHealth, 20f),
                ("ProjectileCount", "Projétil Extra", "Atira um projétil adicional a cada disparo.", UpgradeType.ProjectileCount, 1f),
                ("Pierce", "Perfuração +1", "Seus projéteis atravessam um inimigo a mais.", UpgradeType.Pierce, 1f),
                ("CritChance", "Chance de Crítico +5%", "Aumenta a chance de acerto crítico.", UpgradeType.CritChance, 0.05f),
                ("CritMultiplier", "Multiplicador de Crítico +0.25", "Acertos críticos causam mais dano.", UpgradeType.CritMultiplier, 0.25f),
            };

            var result = new List<UpgradeData>();
            foreach (var d in defs)
            {
                string path = $"{UpgradesFolder}/{d.type}.asset";
                UpgradeData asset = AssetDatabase.LoadAssetAtPath<UpgradeData>(path);
                if (asset == null)
                {
                    asset = ScriptableObject.CreateInstance<UpgradeData>();
                    AssetDatabase.CreateAsset(asset, path);
                }

                asset.upgradeName = d.name;
                asset.description = d.desc;
                asset.type = d.upgradeType;
                asset.value = d.value;
                EditorUtility.SetDirty(asset);
                result.Add(asset);
            }
            return result;
        }

        // ---------------------------------------------------------------
        // Prefabs
        // ---------------------------------------------------------------

        private static GameObject CreateProjectilePrefab(string name, Sprite sprite, string hittableLayer)
        {
            var go = new GameObject(name);

            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;

            var rb = go.AddComponent<Rigidbody2D>();
            rb.gravityScale = 0f;

            var col = go.AddComponent<CircleCollider2D>();
            col.radius = 0.15f;
            col.isTrigger = true;

            var projectile = go.AddComponent<Projectile>();
            SetField(projectile, "hittableLayer", (LayerMask)(1 << LayerMask.NameToLayer(hittableLayer)));

            return SaveAndDestroyTemp(go, $"{PrefabsFolder}/{name}.prefab");
        }

        private static GameObject CreateSlamTelegraphPrefab(Sprite sprite)
        {
            var go = new GameObject("SlamTelegraph");
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = 5;
            return SaveAndDestroyTemp(go, $"{PrefabsFolder}/SlamTelegraph.prefab");
        }

        private static GameObject CreatePlayerPrefab(Sprite sprite, GameObject projectilePrefab)
        {
            var go = new GameObject("Player");
            go.tag = "Player";
            go.layer = LayerMask.NameToLayer("Player");

            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = 10;

            var rb = go.AddComponent<Rigidbody2D>();
            rb.gravityScale = 0f;
            rb.freezeRotation = true;

            var col = go.AddComponent<CircleCollider2D>();
            col.radius = 0.5f;

            var health = go.AddComponent<Health>();
            SetField(health, "maxHealth", 100);

            go.AddComponent<PlayerStats>();

            var firePoint = new GameObject("FirePoint");
            firePoint.transform.SetParent(go.transform);
            firePoint.transform.localPosition = new Vector3(0.5f, 0f, 0f);

            var shooter = go.AddComponent<AutoAimShooter>();
            SetField(shooter, "projectilePrefab", projectilePrefab.GetComponent<Projectile>());
            SetField(shooter, "firePoint", firePoint.transform);
            SetField(shooter, "enemyLayer", (LayerMask)(1 << LayerMask.NameToLayer("Enemy")));

            go.AddComponent<PlayerController>();

            return SaveAndDestroyTemp(go, $"{PrefabsFolder}/Player.prefab");
        }

        private static GameObject CreateEnemyPrefab(string name, Sprite sprite, bool isRanged, GameObject projectilePrefab)
        {
            var go = new GameObject(name);
            go.layer = LayerMask.NameToLayer("Enemy");

            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = 9;

            var rb = go.AddComponent<Rigidbody2D>();
            rb.gravityScale = 0f;
            rb.freezeRotation = true;

            var col = go.AddComponent<CircleCollider2D>();
            col.radius = 0.4f;

            go.AddComponent<Health>();

            var enemy = go.AddComponent<EnemyController>();
            SetField(enemy, "isRanged", isRanged);

            if (isRanged && projectilePrefab != null)
            {
                var firePoint = new GameObject("FirePoint");
                firePoint.transform.SetParent(go.transform);
                firePoint.transform.localPosition = new Vector3(0.4f, 0f, 0f);

                SetField(enemy, "projectilePrefab", projectilePrefab.GetComponent<Projectile>());
                SetField(enemy, "firePoint", firePoint.transform);
            }

            return SaveAndDestroyTemp(go, $"{PrefabsFolder}/{name}.prefab");
        }

        private static GameObject CreateBossPrefab(Sprite sprite, GameObject slamTelegraphPrefab)
        {
            var go = new GameObject("BossEnemy");
            go.layer = LayerMask.NameToLayer("Enemy");

            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = 9;

            var rb = go.AddComponent<Rigidbody2D>();
            rb.gravityScale = 0f;
            rb.freezeRotation = true;

            var col = go.AddComponent<CircleCollider2D>();
            col.radius = 1f;

            go.AddComponent<Health>();

            var boss = go.AddComponent<BossController>();
            SetField(boss, "slamTelegraphPrefab", slamTelegraphPrefab);

            return SaveAndDestroyTemp(go, $"{PrefabsFolder}/BossEnemy.prefab");
        }

        private static GameObject SaveAndDestroyTemp(GameObject go, string path)
        {
            GameObject prefab = PrefabUtility.SaveAsPrefabAsset(go, path);
            Object.DestroyImmediate(go);
            return prefab;
        }

        // ---------------------------------------------------------------
        // Scene assembly
        // ---------------------------------------------------------------

        private static void BuildScene(
            SpriteSet sprites,
            GameObject playerPrefab,
            GameObject meleeEnemyPrefab,
            GameObject rangedEnemyPrefab,
            GameObject bossPrefab,
            List<UpgradeData> upgrades)
        {
            CreateCamera();
            CreateGround(sprites.Ground);
            CreateWalls();
            Transform[] spawnPoints = CreateSpawnPoints();

            GameObject playerInstance = (GameObject)PrefabUtility.InstantiatePrefab(playerPrefab);
            playerInstance.transform.position = Vector3.zero;

            GameObject canvas = CreateCanvas();
            VirtualJoystick joystick = CreateJoystick(canvas.transform);
            UpgradeSelectionUI upgradeUI = CreateUpgradePanel(canvas.transform);
            GameObject gameOverPanel = CreateGameOverPanel(canvas.transform);
            CreatePlayerHealthBar(canvas.transform, playerInstance.GetComponent<Health>());
            CreateEventSystem();

            var playerController = playerInstance.GetComponent<PlayerController>();
            SetField(playerController, "joystick", joystick);

            var spawnerGO = new GameObject("EnemySpawner");
            var spawner = spawnerGO.AddComponent<EnemySpawner>();
            SetField(spawner, "meleeEnemyPrefab", meleeEnemyPrefab.GetComponent<EnemyController>());
            SetField(spawner, "rangedEnemyPrefab", rangedEnemyPrefab.GetComponent<EnemyController>());
            SetField(spawner, "bossPrefab", bossPrefab.GetComponent<BossController>());
            SetFieldArray(spawner, "spawnPoints", spawnPoints);

            var upgradeManagerGO = new GameObject("UpgradeManager");
            var upgradeManager = upgradeManagerGO.AddComponent<UpgradeManager>();
            SetFieldArray(upgradeManager, "allUpgrades", upgrades.ToArray());

            var roomManagerGO = new GameObject("RoomManager");
            var roomManager = roomManagerGO.AddComponent<RoomManager>();
            SetField(roomManager, "spawner", spawner);
            SetField(roomManager, "upgradeManager", upgradeManager);
            SetField(roomManager, "upgradeUI", upgradeUI);
            SetField(roomManager, "playerStats", playerInstance.GetComponent<PlayerStats>());

            var gameManagerGO = new GameObject("GameManager");
            var gameManager = gameManagerGO.AddComponent<GameManager>();
            SetField(gameManager, "playerHealth", playerInstance.GetComponent<Health>());
            SetField(gameManager, "gameOverPanel", gameOverPanel);

            EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene());
            EditorSceneManager.SaveScene(SceneManager.GetActiveScene(), ScenePath);

            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
        }

        private static void CreateCamera()
        {
            var go = new GameObject("Main Camera");
            go.tag = "MainCamera";
            var cam = go.AddComponent<Camera>();
            cam.orthographic = true;
            cam.orthographicSize = 6f;
            cam.backgroundColor = new Color(0.05f, 0.05f, 0.08f);
            cam.clearFlags = CameraClearFlags.SolidColor;
            go.transform.position = new Vector3(0f, 0f, -10f);
        }

        private static void CreateGround(Sprite groundSprite)
        {
            var go = new GameObject("Ground");
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = groundSprite;
            sr.sortingOrder = -10;
            sr.drawMode = SpriteDrawMode.Tiled;
            sr.size = new Vector2(ArenaWidth + 2f, ArenaHeight + 2f);
        }

        private static void CreateWalls()
        {
            var parent = new GameObject("Walls").transform;
            CreateWall(parent, "WallTop", new Vector2(0f, ArenaHeight / 2f + 0.5f), new Vector2(ArenaWidth + 2f, 1f));
            CreateWall(parent, "WallBottom", new Vector2(0f, -ArenaHeight / 2f - 0.5f), new Vector2(ArenaWidth + 2f, 1f));
            CreateWall(parent, "WallLeft", new Vector2(-ArenaWidth / 2f - 0.5f, 0f), new Vector2(1f, ArenaHeight + 2f));
            CreateWall(parent, "WallRight", new Vector2(ArenaWidth / 2f + 0.5f, 0f), new Vector2(1f, ArenaHeight + 2f));
        }

        private static void CreateWall(Transform parent, string name, Vector2 position, Vector2 size)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent);
            go.transform.position = position;
            var col = go.AddComponent<BoxCollider2D>();
            col.size = size;
        }

        private static Transform[] CreateSpawnPoints()
        {
            var parent = new GameObject("SpawnPoints").transform;
            var points = new Transform[SpawnPointCount];
            for (int i = 0; i < SpawnPointCount; i++)
            {
                float angle = i * Mathf.PI * 2f / SpawnPointCount;
                var point = new GameObject($"SpawnPoint_{i}").transform;
                point.SetParent(parent);
                point.position = new Vector3(Mathf.Cos(angle) * SpawnRadius, Mathf.Sin(angle) * SpawnRadius, 0f);
                points[i] = point;
            }
            return points;
        }

        // ---------------------------------------------------------------
        // UI
        // ---------------------------------------------------------------

        private static Font legacyFont;

        private static Font GetLegacyFont()
        {
            if (legacyFont != null) return legacyFont;
            legacyFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            if (legacyFont == null) legacyFont = Resources.GetBuiltinResource<Font>("Arial.ttf");
            return legacyFont;
        }

        private static GameObject CreateCanvas()
        {
            var go = new GameObject("Canvas", typeof(RectTransform));
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080f, 1920f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;

            go.AddComponent<GraphicRaycaster>();
            return go;
        }

        private static void CreateEventSystem()
        {
            var go = new GameObject("EventSystem");
            go.AddComponent<EventSystem>();
            go.AddComponent<StandaloneInputModule>();
        }

        private static RectTransform CreateRect(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax,
            Vector2 pivot, Vector2 sizeDelta, Vector2 anchoredPosition)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.pivot = pivot;
            rt.sizeDelta = sizeDelta;
            rt.anchoredPosition = anchoredPosition;
            return rt;
        }

        private static Image AddImage(RectTransform rt, Color color)
        {
            var image = rt.gameObject.AddComponent<Image>();
            image.color = color;
            return image;
        }

        private static Text AddText(RectTransform rt, string text, int fontSize, Color color)
        {
            var t = rt.gameObject.AddComponent<Text>();
            t.text = text;
            t.font = GetLegacyFont();
            t.fontSize = fontSize;
            t.color = color;
            t.alignment = TextAnchor.MiddleCenter;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            return t;
        }

        private static VirtualJoystick CreateJoystick(Transform canvasTransform)
        {
            RectTransform background = CreateRect("JoystickBackground", canvasTransform,
                Vector2.zero, Vector2.zero, Vector2.zero, new Vector2(220f, 220f), new Vector2(60f, 60f));
            AddImage(background, new Color(1f, 1f, 1f, 0.25f));

            RectTransform handle = CreateRect("JoystickHandle", background,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                new Vector2(100f, 100f), Vector2.zero);
            AddImage(handle, new Color(1f, 1f, 1f, 0.6f));

            var joystick = background.gameObject.AddComponent<VirtualJoystick>();
            SetField(joystick, "background", background);
            SetField(joystick, "handle", handle);
            return joystick;
        }

        private static void CreatePlayerHealthBar(Transform canvasTransform, Health playerHealth)
        {
            RectTransform panel = CreateRect("HealthBarPanel", canvasTransform,
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f),
                new Vector2(420f, 40f), new Vector2(40f, -40f));
            AddImage(panel, new Color(0f, 0f, 0f, 0.5f));

            RectTransform fillRect = CreateRect("Fill", panel, Vector2.zero, Vector2.one, Vector2.zero,
                Vector2.zero, Vector2.zero);
            Image fill = AddImage(fillRect, new Color(0.2f, 0.85f, 0.3f));
            fill.type = Image.Type.Filled;
            fill.fillMethod = Image.FillMethod.Horizontal;
            fill.fillOrigin = (int)Image.OriginHorizontal.Left;

            var healthBar = panel.gameObject.AddComponent<HealthBarUI>();
            SetField(healthBar, "health", playerHealth);
            SetField(healthBar, "fillImage", fill);
        }

        private static UpgradeSelectionUI CreateUpgradePanel(Transform canvasTransform)
        {
            RectTransform panel = CreateRect("UpgradePanel", canvasTransform, Vector2.zero, Vector2.one,
                new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            AddImage(panel, new Color(0f, 0f, 0f, 0.75f));

            var cards = new UpgradeCardUI[3];
            float[] xOffsets = { -340f, 0f, 340f };
            for (int i = 0; i < 3; i++)
            {
                cards[i] = CreateUpgradeCard(panel, $"Card_{i}", xOffsets[i]);
            }

            panel.gameObject.SetActive(false);

            var upgradeUI = panel.gameObject.AddComponent<UpgradeSelectionUI>();
            SetField(upgradeUI, "panel", panel.gameObject);
            SetFieldArray(upgradeUI, "cards", cards);
            return upgradeUI;
        }

        private static UpgradeCardUI CreateUpgradeCard(RectTransform parent, string name, float xOffset)
        {
            RectTransform card = CreateRect(name, parent, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                new Vector2(0.5f, 0.5f), new Vector2(300f, 420f), new Vector2(xOffset, 0f));
            AddImage(card, new Color(0.15f, 0.15f, 0.2f, 0.95f));

            RectTransform nameRect = CreateRect("Name", card, new Vector2(0f, 1f), new Vector2(1f, 1f),
                new Vector2(0.5f, 1f), new Vector2(-20f, 90f), new Vector2(0f, -20f));
            Text nameText = AddText(nameRect, "Upgrade", 32, Color.white);

            RectTransform descRect = CreateRect("Description", card, new Vector2(0f, 0f), new Vector2(1f, 1f),
                new Vector2(0.5f, 0.5f), new Vector2(-30f, -140f), new Vector2(0f, 10f));
            Text descText = AddText(descRect, "Descrição", 24, new Color(0.85f, 0.85f, 0.85f));

            RectTransform iconRect = CreateRect("Icon", card, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0.5f, 1f), new Vector2(64f, 64f), new Vector2(0f, -160f));
            Image icon = AddImage(iconRect, new Color(1f, 1f, 1f, 0f));

            RectTransform buttonRect = CreateRect("ChooseButton", card, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0.5f, 0f), new Vector2(240f, 70f), new Vector2(0f, 30f));
            Image buttonImage = AddImage(buttonRect, new Color(0.25f, 0.55f, 0.95f));
            Button button = buttonRect.gameObject.AddComponent<Button>();
            button.targetGraphic = buttonImage;

            RectTransform buttonTextRect = CreateRect("Text", buttonRect, Vector2.zero, Vector2.one,
                new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            AddText(buttonTextRect, "Escolher", 26, Color.white);

            var cardUI = card.gameObject.AddComponent<UpgradeCardUI>();
            SetField(cardUI, "nameText", nameText);
            SetField(cardUI, "descriptionText", descText);
            SetField(cardUI, "iconImage", icon);
            SetField(cardUI, "button", button);
            return cardUI;
        }

        private static GameObject CreateGameOverPanel(Transform canvasTransform)
        {
            RectTransform panel = CreateRect("GameOverPanel", canvasTransform, Vector2.zero, Vector2.one,
                new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            AddImage(panel, new Color(0f, 0f, 0f, 0.85f));

            RectTransform titleRect = CreateRect("Title", panel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                new Vector2(0.5f, 0.5f), new Vector2(600f, 100f), new Vector2(0f, 100f));
            AddText(titleRect, "Game Over", 60, Color.white);

            RectTransform buttonRect = CreateRect("RestartButton", panel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                new Vector2(0.5f, 0.5f), new Vector2(280f, 80f), new Vector2(0f, -60f));
            Image buttonImage = AddImage(buttonRect, new Color(0.25f, 0.55f, 0.95f));
            Button button = buttonRect.gameObject.AddComponent<Button>();
            button.targetGraphic = buttonImage;

            RectTransform buttonTextRect = CreateRect("Text", buttonRect, Vector2.zero, Vector2.one,
                new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            AddText(buttonTextRect, "Reiniciar", 30, Color.white);

            var gameOverUI = panel.gameObject.AddComponent<GameOverUI>();
            SetField(gameOverUI, "restartButton", button);

            panel.gameObject.SetActive(false);
            return panel.gameObject;
        }

        // ---------------------------------------------------------------
        // Reflection helpers (SerializedObject-based so Undo/serialization stay correct)
        // ---------------------------------------------------------------

        private static void SetField(Object target, string fieldName, object value)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(fieldName);
            if (prop == null)
            {
                Debug.LogWarning($"ArcheroIdleProjectBuilder: field '{fieldName}' not found on {target.GetType().Name}.");
                return;
            }

            switch (value)
            {
                case int i:
                    prop.intValue = i;
                    break;
                case float f:
                    prop.floatValue = f;
                    break;
                case bool b:
                    prop.boolValue = b;
                    break;
                case string s:
                    prop.stringValue = s;
                    break;
                case LayerMask lm:
                    prop.intValue = lm.value;
                    break;
                case Object o:
                    prop.objectReferenceValue = o;
                    break;
                default:
                    Debug.LogWarning($"ArcheroIdleProjectBuilder: unsupported value type for '{fieldName}'.");
                    break;
            }
            so.ApplyModifiedProperties();
        }

        private static void SetFieldArray(Object target, string fieldName, Object[] values)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(fieldName);
            if (prop == null)
            {
                Debug.LogWarning($"ArcheroIdleProjectBuilder: field '{fieldName}' not found on {target.GetType().Name}.");
                return;
            }

            prop.arraySize = values.Length;
            for (int i = 0; i < values.Length; i++)
            {
                prop.GetArrayElementAtIndex(i).objectReferenceValue = values[i];
            }
            so.ApplyModifiedProperties();
        }
    }
}
