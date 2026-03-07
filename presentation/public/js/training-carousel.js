/**
 * 3D Cylindrical Perspective Carousel (Z=0 HD Fix + Performance Optimized)
 * Centro de Entrenamiento — Hub Academia
 * * Vanilla JS (ES6+) engine with:
 * - Dynamic angle/radius calculation (apothem formula)
 * - Lerp-based smooth 60fps animation
 * - Billboarding (face-forward)
 * - Focal arc visibility (front-only with blur/opacity falloff)
 * - Mouse drag, touch swipe (with inertia), scroll wheel, keyboard
 * - Intersection Observer (Pauses engine when off-screen to save battery)
 */
(function () {
    'use strict';

    // ─── CONFIGURATION ─────────────────────────────────────────
    const CONFIG = {
        lerpFactor: 0.08,        // Smoothness (lower = smoother but slower)
        dragSensitivity: 0.3,    // Mouse drag: degrees per pixel
        touchSensitivity: 0.35,  // Touch drag: degrees per pixel
        scrollSensitivity: 0.5,  // Wheel: degrees per delta unit
        inertiaDamping: 0.92,    // Inertia friction (0-1, higher = longer glide)
        snapThreshold: 0.15,     // Snap when velocity is below this (deg/frame)
        minCardWidth: 240,       // Min card width (px)
        maxCardWidth: 380,       // Max card width (px)
        cardHeight: 360,         // Card height (px)
        perspective: 2000,       // Higher perspective = flatter depth = sharper rendering
        focusScale: 1.0,         // IMPORTANT: Scale 1.0 = RAZOR SHARP (no subpixel interpolation)
        autoPlayDelay: 6000,     // Auto-rotate interval (ms), 0 to disable
    };

    // ─── STATE ──────────────────────────────────────────────────
    let cards = [];
    let n = 0;                   // Number of cards
    let theta = 0;               // Angle step (360/n)
    let radius = 0;              // Cylinder radius (apothem)
    let cardWidth = 0;           // Current card width (responsive)

    let targetAngle = 0;         // Where we want to rotate to
    let currentAngle = 0;        // Current displayed angle (lerped)
    let velocity = 0;            // Inertia velocity (deg/frame)
    let isAnimating = false;     // Whether rAF loop is running
    let isDragging = false;      // Is user dragging
    let isVisible = false;       // Visibility state via Intersection Observer
    let dragStartX = 0;         // Drag start X position
    let lastDragX = 0;          // Last drag X (for velocity calc)
    let lastDragTime = 0;       // Last drag timestamp
    let autoPlayTimer = null;

    // DOM references
    let cylinder = null;
    let scene = null;
    let wrapper = null;
    let indicatorsContainer = null;
    let prevBtn = null;
    let nextBtn = null;

    // ─── INIT ───────────────────────────────────────────────────
    function init() {
        // Usa el ID específico para asegurar el arranque
        wrapper = document.getElementById('carouselWrapper') || document.querySelector('.carousel-wrapper');
        if (!wrapper) return;

        scene = wrapper.querySelector('.carousel-scene');
        cylinder = wrapper.querySelector('.carousel-cylinder');
        cards = Array.from(cylinder.querySelectorAll('.carousel-card'));

        // Manejo seguro del contenedor de indicadores
        const parentSection = wrapper.closest('section');
        if (parentSection) {
            indicatorsContainer = parentSection.querySelector('.carousel-indicators');
        }

        prevBtn = wrapper.querySelector('.carousel-prev');
        nextBtn = wrapper.querySelector('.carousel-next');
        n = cards.length;

        if (n === 0) return;

        theta = 360 / n;

        calculateDimensions();
        buildIndicators();
        positionCards();
        bindEvents();
        setupIntersectionObserver(); // Activa el optimizador de recursos
        startAutoPlay();

        // Initial render
        updateVisuals();
    }

    // ─── PERFORMANCE OPTIMIZATION ───────────────────────────────
    function setupIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                isVisible = entry.isIntersecting;
                if (isVisible) {
                    // Reanudar animaciones si es necesario
                    if (Math.abs(targetAngle - currentAngle) > 0.01 || Math.abs(velocity) > 0.01) {
                        startAnimationLoop();
                    }
                    startAutoPlay(); // Reanudar rotación automática si estaba activa
                } else {
                    // Detener auto-rotación para ahorrar batería
                    pauseAutoPlay();
                }
            });
        }, { threshold: 0.1 }); // Se activa/desactiva cuando el 10% está visible

        observer.observe(wrapper);
    }

    // ─── MATH & GEOMETRY ────────────────────────────────────────
    function calculateDimensions() {
        const wrapperWidth = wrapper.clientWidth;
        // Responsive card width
        cardWidth = Math.min(CONFIG.maxCardWidth, Math.max(CONFIG.minCardWidth, wrapperWidth * 0.35));

        // For mobile, further constrain
        if (wrapperWidth < 600) {
            cardWidth = Math.min(CONFIG.maxCardWidth, Math.max(220, wrapperWidth * 0.65));
            // Reduce card height on mobile to prevent vertical clipping
            CONFIG._activeCardHeight = 240;
        } else {
            CONFIG._activeCardHeight = CONFIG.cardHeight;
        }

        // Apothem formula: r = (w/2) / tan(π/n)
        if (n >= 3) {
            radius = (cardWidth / 2) / Math.tan(Math.PI / n);
        } else if (n === 2) {
            radius = cardWidth * 1.2;
        } else {
            radius = 0;
        }

        // Spread radius — larger = side cards pushed further out to the sides
        radius = Math.max(radius, cardWidth * 1.1);

        // FIX: Forzar radio entero para evitar subpíxeles
        radius = Math.round(radius);

        // Update scene perspective
        scene.style.perspective = CONFIG.perspective + 'px';
    }

    function positionCards() {
        const activeHeight = CONFIG._activeCardHeight || CONFIG.cardHeight;
        cards.forEach((card, i) => {
            card.style.width = cardWidth + 'px';
            card.style.height = activeHeight + 'px';
            // Center cards within the cylinder
            card.style.left = '50%';
            card.style.top = '50%';
            card.style.marginLeft = -(cardWidth / 2) + 'px';
            card.style.marginTop = -(activeHeight / 2) + 'px';
        });
    }

    // ─── INDICATORS ─────────────────────────────────────────────
    function buildIndicators() {
        if (!indicatorsContainer) return;
        indicatorsContainer.innerHTML = '';
        cards.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot';
            dot.setAttribute('aria-label', `Ir a tarjeta ${i + 1}`);
            dot.addEventListener('click', () => goToCard(i));
            indicatorsContainer.appendChild(dot);
        });
    }

    function updateIndicators() {
        if (!indicatorsContainer) return;
        const dots = indicatorsContainer.querySelectorAll('.carousel-dot');
        const activeIndex = getActiveIndex();
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === activeIndex);
        });
    }

    function getActiveIndex() {
        // Normalize angle to [0, 360)
        let normalizedAngle = ((currentAngle % 360) + 360) % 360;
        // The card at index i sits at angle i * theta
        // The "front" is at angle 0, so the active card is at:
        let index = Math.round(normalizedAngle / theta) % n;
        // Invertimos el index visual porque el carrusel gira al reves del DOM
        return (n - index) % n;
    }

    // ─── NAVIGATION ─────────────────────────────────────────────
    function goToCard(index) {
        // Compensamos la inversion visual
        let realIndex = (n - index) % n;
        const targetCardAngle = realIndex * theta;
        let normalizedCurrent = ((targetAngle % 360) + 360) % 360;
        let diff = targetCardAngle - normalizedCurrent;

        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        targetAngle += diff;
        velocity = 0;
        resetAutoPlay();
        startAnimationLoop();
    }

    function goNext() {
        targetAngle -= theta; // Invertido para que "Next" vaya a la derecha visual
        velocity = 0;
        resetAutoPlay();
        startAnimationLoop();
    }

    function goPrev() {
        targetAngle += theta;
        velocity = 0;
        resetAutoPlay();
        startAnimationLoop();
    }

    function snapToNearest() {
        const normalizedAngle = ((targetAngle % 360) + 360) % 360;
        const nearestIndex = Math.round(normalizedAngle / theta) % n;
        const nearestAngle = nearestIndex * theta;

        let currentWrapped = ((targetAngle % 360) + 360) % 360;
        let diff = nearestAngle - currentWrapped;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        targetAngle += diff;
        startAnimationLoop();
    }

    // ─── ANIMATION LOOP ─────────────────────────────────────────
    function startAnimationLoop() {
        // Si ya está animando o si no es visible en pantalla, no iniciar el bucle
        if (isAnimating || !isVisible) return;
        isAnimating = true;
        requestAnimationFrame(animationFrame);
    }

    function animationFrame() {
        // Doble validación: si se oculta de la pantalla durante la animación, se detiene
        if (!isAnimating || !isVisible) {
            isAnimating = false;
            return;
        }

        let stillMoving = false;

        if (!isDragging && Math.abs(velocity) > 0.01) {
            targetAngle += velocity;
            velocity *= CONFIG.inertiaDamping;
            stillMoving = true;

            if (Math.abs(velocity) < CONFIG.snapThreshold) {
                velocity = 0;
                snapToNearest();
            }
        }

        const delta = targetAngle - currentAngle;
        if (Math.abs(delta) > 0.01) {
            currentAngle += delta * CONFIG.lerpFactor;
            stillMoving = true;
        } else {
            currentAngle = targetAngle;
        }

        updateVisuals();

        if (stillMoving || isDragging) {
            requestAnimationFrame(animationFrame);
        } else {
            isAnimating = false;
        }
    }

    // ─── RENDERING (🚨 FIX DEFINITIVO 4K 🚨) ──────────────────────────────
    const VISUAL_SPREAD = 42;

    function updateVisuals() {
        // EL TRUCO: El cilindro NO gira. Solo se empuja hacia atrás.
        // Esto crea el "Punto 0" exacto en la pantalla de tu monitor.
        cylinder.style.transform = `translateZ(${-radius}px)`;

        const slotFloat = currentAngle / theta;

        cards.forEach((card, i) => {
            let slotDiff = i - slotFloat;
            while (slotDiff > n / 2) slotDiff -= n;
            while (slotDiff < -n / 2) slotDiff += n;

            // Este es el ángulo vital. Cuando la tarjeta está al medio, esto da 0.
            const visualAngle = slotDiff * VISUAL_SPREAD;
            const absVisualAngle = Math.abs(visualAngle);

            let opacity, blur, scale;

            if (absVisualAngle < 3) {
                opacity = 1;
                blur = 0;
                scale = 1.0;
            } else if (absVisualAngle <= 60) {
                const t = absVisualAngle / 60;
                opacity = 1 - (t * t * 0.25);
                blur = t * 2.0;
                scale = 1.0 - (t * 0.15);
            } else if (absVisualAngle <= 100) {
                const t = (absVisualAngle - 60) / 40;
                opacity = 0.75 * (1 - t * 0.7);
                blur = 2.0 + t * 4;
                scale = 0.85 - (t * 0.1);
            } else {
                opacity = 0;
                blur = 6;
                scale = 0.75;
            }

            const zIndex = Math.round((180 - absVisualAngle) * 10);

            card.style.opacity = opacity;
            card.style.filter = (absVisualAngle < 3) ? 'none' : (blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none');
            card.style.zIndex = zIndex;
            card.style.visibility = (absVisualAngle > 100) ? 'hidden' : 'visible';

            // ALQUIMIA 3D:
            // Al estar en el medio, visualAngle es 0. 
            // La tarjeta ejecuta: rotateY(0) translateZ(radius) rotateY(0).
            // Esto anula el motor 3D y dispara el texto en vectores HD nativos.
            card.style.transform = `rotateY(${visualAngle.toFixed(2)}deg) translateZ(${radius}px) rotateY(${-visualAngle.toFixed(2)}deg) scale(${scale.toFixed(3)})`;

            const isActive = absVisualAngle < VISUAL_SPREAD * 0.3;
            card.classList.toggle('carousel-card--active', isActive);
            card.style.pointerEvents = opacity > 0.1 ? 'auto' : 'none';
        });

        updateIndicators();
    }

    // ─── EVENTS ─────────────────────────────────────────────────
    function bindEvents() {
        if (prevBtn) prevBtn.addEventListener('click', goPrev);
        if (nextBtn) nextBtn.addEventListener('click', goNext);

        document.addEventListener('keydown', (e) => {
            if (!isInViewport(wrapper) || !isVisible) return; // Si no es visible, ignorar
            if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); startAnimationLoop(); }
            if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); startAnimationLoop(); }
        });

        wrapper.addEventListener('mousedown', onDragStart);
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);

        wrapper.addEventListener('touchstart', onTouchStart, { passive: true });
        wrapper.addEventListener('touchmove', onTouchMove, { passive: false });
        wrapper.addEventListener('touchend', onTouchEnd);

        wrapper.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('resize', debounce(onResize, 200));

        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                if (card._wasDragged) {
                    e.preventDefault();
                    card._wasDragged = false;
                }
            });
        });

        // 🚨 NUEVO: DETECTOR DE CAMBIO DE PESTAÑA (TAB SWITCHING)
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                // El usuario se fue a otra pestaña: Apagamos motores y auto-play
                isAnimating = false;
                pauseAutoPlay();
            } else {
                // El usuario volvió: Reanudamos suavemente
                if (isVisible) {
                    startAutoPlay();
                    startAnimationLoop();
                }
            }
        });
    }

    // ── Mouse Drag Handlers ──
    function onDragStart(e) {
        if (e.target.closest('.carousel-nav')) return;
        isDragging = true;
        dragStartX = e.clientX;
        lastDragX = e.clientX;
        lastDragTime = Date.now();
        velocity = 0;
        wrapper.style.cursor = 'grabbing';
        pauseAutoPlay();
        startAnimationLoop();
    }

    function onDragMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const deltaX = e.clientX - lastDragX;
        targetAngle -= deltaX * CONFIG.dragSensitivity;

        const now = Date.now();
        const dt = now - lastDragTime;
        if (dt > 0) {
            velocity = -(deltaX * CONFIG.dragSensitivity) / Math.max(dt / 16, 1);
        }
        lastDragX = e.clientX;
        lastDragTime = now;

        if (Math.abs(e.clientX - dragStartX) > 5) {
            cards.forEach(c => c._wasDragged = true);
        }
    }

    function onDragEnd() {
        if (!isDragging) return;
        isDragging = false;
        wrapper.style.cursor = '';
        if (Math.abs(velocity) < CONFIG.snapThreshold) {
            snapToNearest();
        }
        if (isVisible) startAutoPlay(); // Reanuda autoplay si sigue visible
    }

    // ── Touch Handlers ──
    let touchStartX = 0;

    function onTouchStart(e) {
        touchStartX = e.touches[0].clientX;
        lastDragX = touchStartX;
        lastDragTime = Date.now();
        isDragging = true;
        velocity = 0;
        pauseAutoPlay();
        startAnimationLoop();
    }

    function onTouchMove(e) {
        if (!isDragging) return;
        const currentX = e.touches[0].clientX;
        const deltaX = currentX - lastDragX;

        if (Math.abs(currentX - touchStartX) > 10) {
            e.preventDefault();
        }

        targetAngle -= deltaX * CONFIG.touchSensitivity;
        const now = Date.now();
        const dt = now - lastDragTime;
        if (dt > 0) {
            velocity = -(deltaX * CONFIG.touchSensitivity) / Math.max(dt / 16, 1);
        }
        lastDragX = currentX;
        lastDragTime = now;
        cards.forEach(c => c._wasDragged = true);
    }

    function onTouchEnd() {
        isDragging = false;
        if (Math.abs(velocity) < CONFIG.snapThreshold) {
            snapToNearest();
        }
        setTimeout(() => cards.forEach(c => c._wasDragged = false), 50);
        if (isVisible) startAutoPlay(); // Reanuda autoplay si sigue visible
    }

    // ── Scroll Wheel Handler ──
    function onWheel(e) {
        if (!isInViewport(wrapper) || !isVisible) return;
        e.preventDefault();
        targetAngle += e.deltaY * CONFIG.scrollSensitivity;
        velocity = 0;
        clearTimeout(wrapper._scrollSnapTimer);
        wrapper._scrollSnapTimer = setTimeout(() => snapToNearest(), 300);
        resetAutoPlay();
        startAnimationLoop();
    }

    // ── Resize Handler ──
    function onResize() {
        calculateDimensions();
        positionCards();
        updateVisuals();
    }

    // ─── AUTO-PLAY ──────────────────────────────────────────────
    // ─── AUTO-PLAY ──────────────────────────────────────────────
    function startAutoPlay() {
        if (CONFIG.autoPlayDelay <= 0) return;

        if (!autoPlayTimer) {
            autoPlayTimer = setInterval(() => {
                // 🚨 FIX DE OPTIMIZACIÓN: Solo gira si no arrastras, si es visible en pantalla, 
                // Y si el usuario NO está en otra pestaña (!document.hidden)
                if (!isDragging && isVisible && !document.hidden) {
                    goNext();
                }
            }, CONFIG.autoPlayDelay);
        }
    }

    function pauseAutoPlay() {
        if (autoPlayTimer) {
            clearInterval(autoPlayTimer);
            autoPlayTimer = null;
        }
    }

    function resetAutoPlay() {
        pauseAutoPlay();
        if (isVisible) startAutoPlay();
    }

    // ─── UTILITIES ──────────────────────────────────────────────
    function isInViewport(el) {
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    }

    function debounce(fn, ms) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    // ─── BOOT ───────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();