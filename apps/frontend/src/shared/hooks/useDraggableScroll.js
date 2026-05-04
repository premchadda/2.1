import { useRef, useEffect, useCallback } from 'react';

export function useDraggableScroll(options = {}) {
  const ref = useRef(null);
  
  const {
    momentumFriction = 0.92,
    scrollSpeedMultiplier = 1,
    enableMomentum = true,
    enableTouch = true,
    enableWheel = true,
    enableKeyboard = true,
  } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let isPointerDown = false;
    let startX = 0;
    let startY = 0;
    let scrollLeftAtStart = 0;
    let hasMoved = false;
    let velocityX = 0;
    let lastPointerX = 0;
    let momentumRAF = null;

    const onPointerDown = (e) => {
      isPointerDown = true;
      hasMoved = false;
      velocityX = 0;
      cancelAnimationFrame(momentumRAF);
      
      element.style.scrollBehavior = 'auto';
      element.style.cursor = 'grabbing';
      element.style.userSelect = 'none';
      
      const pageX = e.touches ? e.touches[0].pageX : e.pageX;
      const pageY = e.touches ? e.touches[0].pageY : e.pageY;
      
      startX = pageX;
      startY = pageY;
      lastPointerX = pageX;
      scrollLeftAtStart = element.scrollLeft;
      
      element.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!isPointerDown) return;
      
      const pageX = e.touches ? e.touches[0].pageX : e.pageX;
      const pageY = e.touches ? e.touches[0].pageY : e.pageY;
      
      const deltaX = pageX - lastPointerX;
      velocityX = deltaX;
      
      const totalDeltaX = Math.abs(pageX - startX);
      const totalDeltaY = Math.abs(pageY - startY);
      
      if (totalDeltaX > 3 || (totalDeltaX > totalDeltaY && totalDeltaX > 3)) {
        hasMoved = true;
      }
      
      if (hasMoved) {
        e.preventDefault();
        const walk = (pageX - startX) * scrollSpeedMultiplier;
        element.scrollLeft = scrollLeftAtStart - walk;
        lastPointerX = pageX;
      }
    };

    const onPointerUp = () => {
      if (!isPointerDown) return;
      isPointerDown = false;
      
      element.style.cursor = 'grab';
      element.style.removeProperty('user-select');
      
      if (hasMoved && enableMomentum) {
        const momentumLoop = () => {
          element.scrollLeft += velocityX;
          velocityX *= momentumFriction;
          if (Math.abs(velocityX) > 0.5) {
            momentumRAF = requestAnimationFrame(momentumLoop);
          } else {
            element.style.scrollBehavior = '';
          }
        };
        momentumRAF = requestAnimationFrame(momentumLoop);
      } else {
        element.style.scrollBehavior = '';
      }
      
      if (hasMoved) {
        const preventClick = (e) => {
          e.preventDefault();
          e.stopPropagation();
        };
        element.addEventListener('click', preventClick, { capture: true, once: true });
      }
    };

    const onWheel = (e) => {
      if (!enableWheel) return;
      
      const canScrollLeft = element.scrollLeft > 0;
      const canScrollRight = element.scrollLeft < (element.scrollWidth - element.clientWidth - 1);
      
      if (!canScrollLeft && !canScrollRight) return;
      
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      
      if (e.deltaY !== 0) {
        const atRightEdge = !canScrollRight && e.deltaY > 0;
        const atLeftEdge = !canScrollLeft && e.deltaY < 0;
        
        if (!atRightEdge && !atLeftEdge) {
          e.preventDefault();
          element.scrollLeft += e.deltaY * scrollSpeedMultiplier;
        }
      }
    };

    const onKeyDown = (e) => {
      if (!enableKeyboard) return;
      
      const step = Math.min(300, element.clientWidth * 0.8);
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          element.scrollBy({ left: -step, behavior: 'smooth' });
          break;
        case 'ArrowRight':
          e.preventDefault();
          element.scrollBy({ left: step, behavior: 'smooth' });
          break;
        case 'Home':
          e.preventDefault();
          element.scrollTo({ left: 0, behavior: 'smooth' });
          break;
        case 'End':
          e.preventDefault();
          element.scrollTo({ left: element.scrollWidth, behavior: 'smooth' });
          break;
      }
    };

    element.addEventListener('mousedown', onPointerDown);
    element.addEventListener('mousemove', onPointerMove);
    element.addEventListener('mouseup', onPointerUp);
    element.addEventListener('mouseleave', onPointerUp);
    
    if (enableTouch) {
      element.addEventListener('touchstart', onPointerDown, { passive: false });
      element.addEventListener('touchmove', onPointerMove, { passive: false });
      element.addEventListener('touchend', onPointerUp);
      element.addEventListener('touchcancel', onPointerUp);
    }
    
    if (enableWheel) {
      element.addEventListener('wheel', onWheel, { passive: false });
    }
    
    if (enableKeyboard) {
      element.setAttribute('tabindex', '0');
      element.setAttribute('role', 'region');
      element.setAttribute('aria-label', 'Scrollable area');
      element.addEventListener('keydown', onKeyDown);
    }
    
    element.style.cursor = 'grab';

    return () => {
      element.removeEventListener('mousedown', onPointerDown);
      element.removeEventListener('mousemove', onPointerMove);
      element.removeEventListener('mouseup', onPointerUp);
      element.removeEventListener('mouseleave', onPointerUp);
      element.removeEventListener('touchstart', onPointerDown);
      element.removeEventListener('touchmove', onPointerMove);
      element.removeEventListener('touchend', onPointerUp);
      element.removeEventListener('touchcancel', onPointerUp);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(momentumRAF);
    };
  }, [momentumFriction, scrollSpeedMultiplier, enableMomentum, enableTouch, enableWheel, enableKeyboard]);

  const scrollTo = useCallback((position, behavior = 'smooth') => {
    if (ref.current) {
      ref.current.scrollTo({ left: position, behavior });
    }
  }, []);

  const scrollBy = useCallback((delta, behavior = 'smooth') => {
    if (ref.current) {
      ref.current.scrollBy({ left: delta, behavior });
    }
  }, []);

  return { ref, scrollTo, scrollBy };
}

export default useDraggableScroll;
