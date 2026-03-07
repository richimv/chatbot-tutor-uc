/**
 * 3D Cylindrical Perspective Carousel (Z=0 HD Fix + Ultra Performance + Panorama)
 * Centro de Entrenamiento — Hub Academia
 */
(function () {
    'use strict';

    // ─── CONFIGURATION ─────────────────────────────────────────
    const CONFIG = {
        lerpFactor: 0.08,
        dragSensitivity: 0.3,
        touchSensitivity: 0.35,
        scrollSensitivity: 0.5,
        inertiaDamping: 0.92,
        snapThreshold: 0.15,
        minCardWidth: 240,
        maxCardWidth: 400, // Ajustado para tus nuevas tarjetas
        cardHeight: 380,   // Ajustado para tus nuevas tarjetas
        perspective: 2000,
        autoPlayDelay: 6000,
    };

    // ─── STATE ──────────────────────────────────────────────────
    let cards = [];
    let n = 0;
    let theta = 0;
    let radius = 0;
    let cardWidth = 0;

    let targetAngle = 0;
    let currentAngle = 0;
    let velocity = 0;
    let isAnimating = false;
    let isDragging = false;
    let isVisible = false;
    let dragStartX = 0;
    let lastDragX = 0;
    let lastDragTime = 0;
    let autoPlayTimer = null;

    let cylinder = null;
    let scene = null;
    let wrapper = null;
    let indicatorsContainer = null;
    let prevBtn = null;
    let nextBtn = null;

    // ─── INIT ───────────────────────────────────────────────────
    function init() {
        wrapper = document.getElementById('carouselWrapper') || document.querySelector('.carousel-wrapper');
        if (!wrapper) return;

        scene = wrapper.querySelector('.carousel-scene');
        cylinder = wrapper.querySelector('.carousel-cylinder');
        cards = Array.from(cylinder.querySelectorAll('.carousel-card'));

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
        setupIntersectionObserver();
        startAutoPlay();
        updateVisuals();
    }

    // ─── PERFORMANCE OPTIMIZATION ───────────────────────────────
    function setupIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                isVisible = entry.isIntersecting;
                if (isVisible && !document.hidden) {
                    if (Math.abs(targetAngle - currentAngle) > 0.01 || Math.abs(velocity) > 0.01) {
                        startAnimationLoop();
                    }
                    startAutoPlay();
                } else {
                    pauseAutoPlay();
                }
            });
        }, { threshold: 0.1 });
        observer.observe(wrapper);
    }

    // ─── MATH & GEOMETRY ────────────────────────────────────────
    function calculateDimensions() {
        const wrapperWidth = wrapper.clientWidth;
        cardWidth = Math.min(CONFIG.maxCardWidth, Math.max(CONFIG.minCardWidth, wrapperWidth * 0.35));

        // 🚨 EL FIX: Tres tamaños de tarjeta según la pantalla
        if (wrapperWidth <= 480) {
            // Celulares: Tarjetas muy compactas (280px)
            cardWidth = Math.min(CONFIG.maxCardWidth, Math.max(220, wrapperWidth * 0.70));
            CONFIG._activeCardHeight = 280;
        } else if (wrapperWidth <= 768) {
            // Tablets: Tarjetas medianas (320px)
            cardWidth = Math.min(CONFIG.maxCardWidth, Math.max(220, wrapperWidth * 0.65));
            CONFIG._activeCardHeight = 320;
        } else {
            // PC: Tarjetas grandes (380px)
            CONFIG._activeCardHeight = CONFIG.cardHeight;
        }

        if (n >= 3) {
            radius = (cardWidth / 2) / Math.tan(Math.PI / n);
        } else if (n === 2) {
            radius = cardWidth * 1.2;
        } else {
            radius = 0;
        }

        radius = Math.max(radius, cardWidth * 1.1);
        radius = Math.round(radius);
        scene.style.perspective = CONFIG.perspective + 'px';
    }

    function positionCards() {
        const activeHeight = CONFIG._activeCardHeight || CONFIG.cardHeight;
        cards.forEach((card) => {
            card.style.width = cardWidth + 'px';
            card.style.height = activeHeight + 'px';
            card.style.left = '50%';
            card.style.top = '50%';
            card.style.marginLeft = -(cardWidth / 2) + 'px';
            card.style.marginTop = -(activeHeight / 2) + 'px';
        });
    }

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
        let normalizedAngle = ((currentAngle % 360) + 360) % 360;
        let index = Math.round(normalizedAngle / theta) % n;
        return (n - index) % n;
    }

    function goToCard(index) {
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
        targetAngle -= theta;
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

    function startAnimationLoop() {
        if (isAnimating || !isVisible) return;
        isAnimating = true;
        requestAnimationFrame(animationFrame);
    }

    function animationFrame() {
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

    // ─── RENDERING (🚨 EXPANSIÓN INTELIGENTE Y RENDIMIENTO MÓVIL 🚨) ───
    function updateVisuals() {
        cylinder.style.transform = `translateZ(${-radius}px)`;
        const slotFloat = currentAngle / theta;

        // Detectores dinámicos
        const isMobile = window.innerWidth <= 768;

        // 🚨 EL SECRETO: Si es PC usamos 58 (panorámico), si es móvil usamos 42 (compacto)
        const VISUAL_SPREAD = isMobile ? 42 : 58;

        cards.forEach((card, i) => {
            let slotDiff = i - slotFloat;
            while (slotDiff > n / 2) slotDiff -= n;
            while (slotDiff < -n / 2) slotDiff += n;

            const visualAngle = slotDiff * VISUAL_SPREAD;
            const absVisualAngle = Math.abs(visualAngle);

            let opacity, blur, scale;

            if (absVisualAngle < 3) {
                opacity = 1;
                blur = 0;
                scale = 1.0;
            } else if (absVisualAngle <= 70) {
                const t = absVisualAngle / 70;
                opacity = 1 - (t * t * 0.05); // Muy visible en costados
                blur = t * 1.5;
                scale = 1.0 - (t * 0.15);
            } else if (absVisualAngle <= 120) {
                const t = (absVisualAngle - 70) / 50;
                opacity = 0.9 * (1 - t * 0.5);
                blur = 2.0 + t * 4;
                scale = 0.85 - (t * 0.1);
            } else {
                opacity = 0;
                blur = 6;
                scale = 0.75;
            }

            const zIndex = Math.round((180 - absVisualAngle) * 10);
            card.style.opacity = opacity;

            // 🚨 OPTIMIZACIÓN EXTREMA DE GPU 🚨
            if (isMobile) {
                card.style.filter = 'none'; // Cero lag en celulares
            } else {
                card.style.filter = (absVisualAngle < 3) ? 'none' : (blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : 'none');
            }

            card.style.zIndex = zIndex;
            card.style.visibility = (absVisualAngle > 120) ? 'hidden' : 'visible';

            card.style.transform = `rotateY(${visualAngle.toFixed(2)}deg) translateZ(${radius}px) rotateY(${-visualAngle.toFixed(2)}deg) scale(${scale.toFixed(3)})`;

            const isActive = absVisualAngle < VISUAL_SPREAD * 0.3;
            card.classList.toggle('carousel-card--active', isActive);
            card.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
        });

        updateIndicators();
    }

    // ─── EVENTS ─────────────────────────────────────────────────
    function bindEvents() {
        if (prevBtn) prevBtn.addEventListener('click', goPrev);
        if (nextBtn) nextBtn.addEventListener('click', goNext);

        document.addEventListener('keydown', (e) => {
            if (!isInViewport(wrapper) || !isVisible || document.hidden) return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); startAnimationLoop(); }
            if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); startAnimationLoop(); }
        });

        // 🚨 PREVENCIÓN TAB-THROTTLING (Ruleta loca al volver de otra pestaña)
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                isAnimating = false;
                pauseAutoPlay();
            } else {
                if (isVisible) {
                    startAutoPlay();
                    startAnimationLoop();
                }
            }
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
    }

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
        if (isVisible && !document.hidden) startAutoPlay();
    }

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
        if (isVisible && !document.hidden) startAutoPlay();
    }

    function onWheel(e) {
        if (!isInViewport(wrapper) || !isVisible || document.hidden) return;
        e.preventDefault();
        targetAngle += e.deltaY * CONFIG.scrollSensitivity;
        velocity = 0;
        clearTimeout(wrapper._scrollSnapTimer);
        wrapper._scrollSnapTimer = setTimeout(() => snapToNearest(), 300);
        resetAutoPlay();
        startAnimationLoop();
    }

    function onResize() {
        calculateDimensions();
        positionCards();
        updateVisuals();
    }

    function startAutoPlay() {
        if (CONFIG.autoPlayDelay <= 0) return;
        if (!autoPlayTimer) {
            autoPlayTimer = setInterval(() => {
                if (!isDragging && isVisible && !document.hidden) goNext();
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
        if (isVisible && !document.hidden) startAutoPlay();
    }

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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();