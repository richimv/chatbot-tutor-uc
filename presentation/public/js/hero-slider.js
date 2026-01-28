document.addEventListener('DOMContentLoaded', () => {
    // SECURITY: Clean up any existing ghost timer from previous navigations
    if (window.__heroSliderInterval) {
        clearInterval(window.__heroSliderInterval);
        window.__heroSliderInterval = null;
        // console.log("🧹 Limpieza: Slider Timer previo eliminado.");
    }

    const sliderFn = () => {
        const slider = document.getElementById('hero-slider');
        if (!slider) return;

        const slides = slider.querySelectorAll('.slide');
        const dots = slider.querySelectorAll('.dot');
        const prevBtn = slider.querySelector('.prev-btn');
        const nextBtn = slider.querySelector('.next-btn');

        // Config
        let currentSlide = 0;
        const INTERVAL_MS = 8000;

        // 1. Initialize State
        const initializeSlider = () => {
            slides.forEach(s => s.classList.remove('active'));
            dots.forEach(d => d.classList.remove('active'));

            if (slides.length > 0) {
                slides[0].classList.add('active');
                if (dots[0]) dots[0].classList.add('active');
            }
        };

        // 2. Robust Timer Management (Global Scope)
        const startGlobalTimer = () => {
            // Safety: Clear again just in case
            if (window.__heroSliderInterval) clearInterval(window.__heroSliderInterval);

            window.__heroSliderInterval = setInterval(() => {
                nextSlide();
            }, INTERVAL_MS);
        };

        const resetGlobalTimer = () => {
            if (window.__heroSliderInterval) clearInterval(window.__heroSliderInterval);
            startGlobalTimer();
        };

        // 3. Navigation Engine
        const goToSlide = (index) => {
            // Check boundaries
            if (slides.length === 0) return;

            // Pause outgoing video
            const oldVideo = slides[currentSlide].querySelector('video');
            if (oldVideo) oldVideo.pause();

            // Deselect Current
            slides[currentSlide].classList.remove('active');
            if (dots[currentSlide]) dots[currentSlide].classList.remove('active');

            // Index Rotation
            currentSlide = (index + slides.length) % slides.length;

            // Select New
            slides[currentSlide].classList.add('active');
            if (dots[currentSlide]) dots[currentSlide].classList.add('active');

            // Play incoming video
            const newVideo = slides[currentSlide].querySelector('video');
            if (newVideo && window.innerWidth > 768) {
                newVideo.currentTime = 0;
                newVideo.play().catch(() => { });
            }
        };

        // 4. Action Handlers
        const nextSlide = () => goToSlide(currentSlide + 1);
        const prevSlide = () => goToSlide(currentSlide - 1);

        const onManualAction = (action) => {
            action();
            resetGlobalTimer(); // User interaction resets the 8s clock
        };

        // 5. Event Binding
        if (nextBtn) nextBtn.onclick = () => onManualAction(nextSlide);
        if (prevBtn) prevBtn.onclick = () => onManualAction(prevSlide);

        dots.forEach((dot, index) => {
            dot.onclick = () => onManualAction(() => goToSlide(index));
        });

        // 6. Hover Logic (Requested feature)
        const stopGlobalTimer = () => {
            if (window.__heroSliderInterval) {
                clearInterval(window.__heroSliderInterval);
                window.__heroSliderInterval = null;
            }
        };

        slider.addEventListener('mouseenter', stopGlobalTimer);
        slider.addEventListener('mouseleave', startGlobalTimer);

        // 7. Touch / Swipe Logic (Mobile)
        let touchStartX = 0;
        let touchEndX = 0;

        slider.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            stopGlobalTimer(); // Pause while interacting
        }, { passive: true });

        slider.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
            startGlobalTimer(); // Resume after swipe
        }, { passive: true });

        const handleSwipe = () => {
            const SWIPE_THRESHOLD = 50;
            if (touchEndX < touchStartX - SWIPE_THRESHOLD) {
                // Swiped Left -> Next Slide
                onManualAction(nextSlide);
            }
            if (touchEndX > touchStartX + SWIPE_THRESHOLD) {
                // Swiped Right -> Prev Slide
                onManualAction(prevSlide);
            }
        };

        // 8. Start Lifecycle
        initializeSlider();
        startGlobalTimer();
    };

    sliderFn();
});
