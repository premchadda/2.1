import { useRef, useEffect } from 'react';

/**
 * A hook that enables mouse-drag-to-scroll functionality for a horizontal scroll container.
 * @returns {import('react').RefObject<HTMLElement>} ref - The ref to be attached to the scrollable container.
 */
export function useDraggableScroll() {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let isDown = false;
    let startX;
    let scrollLeft;
    let moved = false; // ✅ FIXED: Added missing variable declaration

    let velX = 0;
    let momentumID;

    const onMouseDown = (e) => {
      isDown = true;
      moved = false;
      element.classList.add('cursor-grabbing');
      cancelAnimationFrame(momentumID);
      element.style.scrollBehavior = 'auto'; 
      startX = e.pageX - element.offsetLeft;
      scrollLeft = element.scrollLeft;
      // Debug logging
      // console.log('[DraggableScroll] Mouse down', { startX, scrollLeft });
    };

    const beginMomentum = () => {
      cancelAnimationFrame(momentumID);
      const loop = () => {
        element.scrollLeft += velX;
        velX *= 0.95; // Friction
        if (Math.abs(velX) > 0.5) {
          momentumID = requestAnimationFrame(loop);
        } else {
          element.style.scrollBehavior = ''; // Restore smooth scroll
        }
      };
      momentumID = requestAnimationFrame(loop);
    };

    const onMouseLeave = () => {
      if (isDown) {
        isDown = false;
        element.classList.remove('cursor-grabbing');
        beginMomentum();
      }
    };

    const onMouseUp = (e) => {
      if (!isDown) return;
      isDown = false;
      element.classList.remove('cursor-grabbing');
      
      if (moved) {
        beginMomentum();
        const preventClick = (e) => {
          e.stopImmediatePropagation();
          e.preventDefault();
          element.removeEventListener('click', preventClick, true);
        };
        element.addEventListener('click', preventClick, true);
      } else {
        element.style.scrollBehavior = ''; 
      }
    };

    const onMouseMove = (e) => {
      if (!isDown) return;
      
      const x = e.pageX - element.offsetLeft;
      const walk = (x - startX) * 1.5;
      
      if (Math.abs(walk) > 5) {
        moved = true;
      }

      if (moved) {
        e.preventDefault();
        const prevScrollLeft = element.scrollLeft;
        element.scrollLeft = scrollLeft - walk;
        velX = element.scrollLeft - prevScrollLeft; // Capture velocity
      }
    };

    element.addEventListener('mousedown', onMouseDown);
    element.addEventListener('mouseleave', onMouseLeave);
    element.addEventListener('mouseup', onMouseUp);
    element.addEventListener('mousemove', onMouseMove);

    return () => {
      element.removeEventListener('mousedown', onMouseDown);
      element.removeEventListener('mouseleave', onMouseLeave);
      element.removeEventListener('mouseup', onMouseUp);
      element.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return ref;
}

export default useDraggableScroll;
