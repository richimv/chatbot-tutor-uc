/**
 * @fileoverview training-carousel.js (Infinite 2D Hardware-Accelerated Slider)
 * @description Diseño a prueba de balas. Cero lag, bucle infinito real. Sin dots.
 */
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const wrapper = document.getElementById('carouselWrapper') || document.querySelector('.carousel-wrapper');
    if (!wrapper) return;

    const cards = Array.from(wrapper.querySelectorAll('.carousel-card'));
    const prevBtn = wrapper.querySelector('.carousel-prev');
    const nextBtn = wrapper.querySelector('.carousel-next');

    if (cards.length === 0) return;

    let activeIndex = 0; // Empezamos en la primera tarjeta
    let autoPlayTimer = null;
    let startX = 0;
    let isDragging = false;

    function init() {
        updateVisuals();
        attachEvents();
        startAutoPlay();
    }

    function updateVisuals() {
        const isMobile = window.innerWidth <= 768;
        // Separación: 110% en PC (para que se abran), 95% en móvil (para que quepan en pantallas chicas)
        const spread = isMobile ? 95 : 110;

        cards.forEach((card, index) => {
            // Calcular la distancia relativa al centro
            let diff = index - activeIndex;
            const total = cards.length;

            // Truco mágico para el BUCLE INFINITO
            if (diff > Math.floor(total / 2)) diff -= total;
            if (diff < -Math.floor(total / 2)) diff += total;

            if (diff === 0) {
                // TARJETA CENTRAL
                card.style.transform = `translate(-50%, -50%) scale(1)`;
                card.style.opacity = '1';
                card.style.zIndex = '10';
                card.classList.add('carousel-card--active');
                card.style.pointerEvents = 'auto'; // Habilitar clics
            } else if (diff === 1 || diff === -1) {
                // TARJETAS ADYACENTES (Izquierda y Derecha)
                const direction = diff; // 1 = Derecha, -1 = Izquierda
                card.style.transform = `translate(calc(-50% + ${direction * spread}%), -50%) scale(0.85)`;
                card.style.opacity = '0.5'; // Opacas para no distraer
                card.style.zIndex = '5';
                card.classList.remove('carousel-card--active');
                card.style.pointerEvents = 'none'; // Deshabilitar clics para no ir a enlaces por error
            } else {
                // Ocultar tarjetas extra si alguna vez pones más de 3
                card.style.transform = `translate(-50%, -50%) scale(0.5)`;
                card.style.opacity = '0';
                card.style.zIndex = '0';
                card.style.pointerEvents = 'none';
            }
        });
    }

    // ─── NAVEGACIÓN ───
    function goNext() {
        activeIndex = (activeIndex + 1) % cards.length;
        updateVisuals();
        resetAutoPlay();
    }

    function goPrev() {
        activeIndex = (activeIndex - 1 + cards.length) % cards.length;
        updateVisuals();
        resetAutoPlay();
    }

    // ─── EVENTOS (Táctil, Mouse, Teclado) ───
    function attachEvents() {
        if (nextBtn) nextBtn.addEventListener('click', goNext);
        if (prevBtn) prevBtn.addEventListener('click', goPrev);

        // Soporte Táctil (Deslizar dedo)
        wrapper.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
            isDragging = true;
            pauseAutoPlay();
        }, { passive: true });

        wrapper.addEventListener('touchmove', e => {
            if (!isDragging) return;
            const currentX = e.touches[0].clientX;
            const diff = startX - currentX;

            if (Math.abs(diff) > 50) { // Sensibilidad del deslizamiento
                if (diff > 0) goNext();
                else goPrev();
                isDragging = false; // Solo girar una vez por deslizamiento
            }
        }, { passive: true });

        wrapper.addEventListener('touchend', () => isDragging = false);

        // Prevenir locuras al cambiar de pestaña
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) pauseAutoPlay();
            else startAutoPlay();
        });

        // Reajustar si giran el celular
        window.addEventListener('resize', updateVisuals);
    }

    // ─── AUTOPLAY ───
    function startAutoPlay() {
        if (!autoPlayTimer) autoPlayTimer = setInterval(goNext, 5000);
    }

    function pauseAutoPlay() {
        if (autoPlayTimer) {
            clearInterval(autoPlayTimer);
            autoPlayTimer = null;
        }
    }

    function resetAutoPlay() {
        pauseAutoPlay();
        startAutoPlay();
    }

    init();
});