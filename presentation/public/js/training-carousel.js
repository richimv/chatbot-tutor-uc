/**
 * @fileoverview training-carousel.js (Infinite 2D Hardware-Accelerated Slider)
 * @description Diseño estilo Manta: Tarjetas del mismo tamaño, juntas y oscurecidas a los lados.
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

        // 🔥 CLAVE 1: Reducimos la separación. 
        // 103% deja un margen milimétrico entre las tarjetas, manteniéndolas alineadas y pegadas.
        const spread = isMobile ? 102 : 103;

        cards.forEach((card, index) => {
            let diff = index - activeIndex;
            const total = cards.length;

            // Truco mágico para el BUCLE INFINITO
            if (diff > Math.floor(total / 2)) diff -= total;
            if (diff < -Math.floor(total / 2)) diff += total;

            // Transiciones fluidas directas desde JS
            card.style.transition = 'transform 0.5s ease, filter 0.5s ease, opacity 0.5s ease';

            if (diff === 0) {
                // TARJETA CENTRAL
                card.style.transform = `translate(-50%, -50%) scale(1)`;
                card.style.opacity = '1';
                card.style.filter = 'brightness(1)'; // Iluminación total
                card.style.zIndex = '10';
                card.classList.add('carousel-card--active');
                card.style.pointerEvents = 'auto';
            } else if (diff === 1 || diff === -1) {
                // TARJETAS ADYACENTES (Izquierda y Derecha)
                const direction = diff;

                // 🔥 CLAVE 2: scale(1) para que tengan el MISMO tamaño que la del centro
                card.style.transform = `translate(calc(-50% + ${direction * spread}%), -50%) scale(1)`;

                // 🔥 CLAVE 3: 100% de opacidad, pero oscurecidas con brightness (Efecto Manta)
                card.style.opacity = '1';
                // 🔥 CAMBIO: Aumentado para que tengan mejor visibilidad
                card.style.filter = 'brightness(0.7)';

                card.style.zIndex = '5';
                card.classList.remove('carousel-card--active');
                card.style.pointerEvents = 'none';
            } else {
                // Ocultar tarjetas extra
                card.style.transform = `translate(-50%, -50%) scale(1)`;
                card.style.opacity = '0';
                card.style.filter = 'brightness(0)';
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

            if (Math.abs(diff) > 50) {
                if (diff > 0) goNext();
                else goPrev();
                isDragging = false;
            }
        }, { passive: true });

        wrapper.addEventListener('touchend', () => isDragging = false);

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) pauseAutoPlay();
            else startAutoPlay();
        });

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