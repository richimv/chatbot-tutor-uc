/**
 * Activity Heatmap Manager
 * Renders a GitHub-style contribution graph using pure CSS/JS.
 */
class ActivityHeatmap {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.apiUrl = '/api/analytics/heatmap';
        this.token = localStorage.getItem('authToken');
    }

    async init() {
        if (!this.container) return;
        try {
            const data = await this.fetchData();
            this.render(data);
        } catch (error) {
            console.error('Error loading heatmap:', error);
            this.container.innerHTML = '<div style="color:#ef4444; font-size:0.8rem;">Error cargando actividad</div>';
        }
    }

    async fetchData() {
        const res = await fetch(this.apiUrl, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (!res.ok) throw new Error('API Error');
        const json = await res.json();
        return json.heatmap || {};
    }

    render(data) {
        this.container.innerHTML = '';
        data = data || {}; // Safety check

        // Configuration (Smaller Size)
        const squareSize = 10;
        const gap = 3;
        const weeks = 53;
        const daysPerWeek = 7;

        // Wrapper for scroll/layout
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.gap = `${gap}px`;
        wrapper.style.overflowX = 'auto'; // Horizontal Scroll if needed
        wrapper.style.padding = '5px 0';

        // Generate Dates (Last 365 days)
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - (weeks * 7) + 1); // Approx 1 year ago

        for (let w = 0; w < weeks; w++) {
            const weekCol = document.createElement('div');
            weekCol.style.display = 'flex';
            weekCol.style.flexDirection = 'column';
            weekCol.style.gap = `${gap}px`;

            for (let d = 0; d < daysPerWeek; d++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + (w * 7) + d);

                if (currentDate > today) break;

                const dateStr = currentDate.toISOString().split('T')[0];
                const count = data[dateStr] || 0;

                // Color Logic (Tailwind colors approx)
                let color = 'rgba(255, 255, 255, 0.05)'; // Level 0 (bg-slate-800/50 approx)
                if (count > 0) color = '#064e3b'; // Level 1
                if (count > 2) color = '#10b981'; // Level 2 
                if (count > 5) color = '#34d399'; // Level 3
                if (count > 10) color = '#6ee7b7'; // Level 4

                const square = document.createElement('div');
                square.style.width = `${squareSize}px`;
                square.style.height = `${squareSize}px`;
                square.style.borderRadius = '2px';
                square.style.backgroundColor = color;
                square.title = `${dateStr}: ${count} actividades`;

                // Tooltip effect
                square.style.cursor = 'pointer';
                square.onmouseover = () => square.style.opacity = '0.8';
                square.onmouseout = () => square.style.opacity = '1';

                weekCol.appendChild(square);
            }
            wrapper.appendChild(weekCol);
        }

        // Add Legend (Optional) or Title
        const title = document.createElement('div');
        title.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="margin:0; font-size:1rem; color:#f8fafc;">Tu Actividad</h3>
                <span style="font-size:0.8rem; color:#94a3b8;">Último Año</span>
            </div>
        `;

        this.container.appendChild(title);
        this.container.appendChild(wrapper);
    }
}

// Global Export
window.ActivityHeatmap = ActivityHeatmap;
