using UnityEngine;
using UnityEngine.EventSystems;

namespace ArcheroIdle.Player
{
    /// On-screen drag joystick. Assign `background` and `handle` to two overlapping
    /// UI Images (see SETUP.md for the exact hierarchy).
    public class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        [SerializeField] private RectTransform background;
        [SerializeField] private RectTransform handle;
        [SerializeField] private float handleRange = 100f;

        public Vector2 Direction { get; private set; }

        public void OnPointerDown(PointerEventData eventData)
        {
            OnDrag(eventData);
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (RectTransformUtility.ScreenPointToLocalPointInRectangle(
                    background, eventData.position, eventData.pressEventCamera, out Vector2 localPoint))
            {
                Vector2 clamped = Vector2.ClampMagnitude(localPoint, handleRange);
                handle.anchoredPosition = clamped;
                Direction = clamped / handleRange;
            }
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            handle.anchoredPosition = Vector2.zero;
            Direction = Vector2.zero;
        }
    }
}
