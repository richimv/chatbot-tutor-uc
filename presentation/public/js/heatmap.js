/**
 * Activity Heatmap Manager
 * Renders a 14-day activity bar chart using pure CSS/JS.
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
        data = data || {};

        // Configuración Gráfico de Barras (Últimos 14 días)
        const daysToShow = 14;
        const maxBarHeight = 120; // px (Altura máxima de la barra visual)

        // 1. Encontrar el "Mejor Día" para escalar las barras (Normalización)
        let maxCount = 1; // Mínimo 1 para evitar división por cero
        for (const date in data) {
            if (data[date] > maxCount) maxCount = data[date];
        }

        // 2. Contenedor Principal del Gráfico
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'flex-end'; // Alinear todo a la base
        wrapper.style.justifyContent = 'space-between';
        wrapper.style.gap = '6px'; // Espacio entre barras
        wrapper.style.height = `${maxBarHeight + 35}px`; // Altura barras + etiquetas
        wrapper.style.padding = '15px 10px 10px 10px';
        wrapper.style.overflowX = 'auto'; // Responsive scroll interno si hace falta
        wrapper.style.position = 'relative'; // Para tooltips flotantes si quisieramos inyectar uno global

        // 3. Generar Fechas (Del pasado reciente hacia Hoy)
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - daysToShow + 1);

        for (let i = 0; i < daysToShow; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);

            // Formato 'YYYY-MM-DD' de la fecha local (para cruzar con la DB sin fallos de TimeZone)
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const count = data[dateStr] || 0;

            // 4. Construir Columna
            const col = document.createElement('div');
            col.style.display = 'flex';
            col.style.flexDirection = 'column';
            col.style.alignItems = 'center';
            col.style.justifyContent = 'flex-end';
            col.style.flex = '1';
            col.style.minWidth = '18px';
            col.style.maxWidth = '40px'; // Para que no se estiren feo en monitores ultra-wide
            col.style.position = 'relative';

            // 5. Tooltip Nativo
            col.title = count === 1 ? `${dateStr}: 1 actividad` : `${dateStr}: ${count} actividades`;

            // 6. Calcular Altura Relativa de la Barra
            // Si es 0, dejamos 4px como base visible. Si no, calculamos el porcentaje respecto al máximo.
            const heightPx = count === 0 ? 4 : Math.max(10, (count / maxCount) * maxBarHeight);

            // 7. Lógica de Color (Estilo Cyan a Violeta - Cyberpunk/Glass)
            let color = 'rgba(255, 255, 255, 0.08)'; // Vacío / Sin actividad
            if (count > 0) {
                // Gradiente simulado por intensidad basada en ratio
                const ratio = count / maxCount;
                if (ratio < 0.3) color = '#3b82f6'; // Azul eléctrico
                else if (ratio < 0.7) color = '#8b5cf6'; // Púrpura
                else color = '#a855f7'; // Rosa/Violeta Intenso
            }

            // 8. Elemento Barra (El relleno)
            const bar = document.createElement('div');
            bar.style.width = '100%';
            bar.style.height = `${heightPx}px`;
            bar.style.backgroundColor = color;
            bar.style.borderRadius = '4px 4px 0 0';
            bar.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            bar.style.cursor = 'pointer';

            // Sombra sutil de neón si hay actividad
            if (count > 0) {
                bar.style.boxShadow = `0 -2px 10px ${color}80`; // 80 es la opacidad en HEX
            }

            // Efecto Hover Interactivo
            bar.onmouseover = () => {
                bar.style.filter = 'brightness(1.3)';
                bar.style.transform = 'scaleY(1.05)';
                bar.style.transformOrigin = 'bottom';
            };
            bar.onmouseout = () => {
                bar.style.filter = 'brightness(1)';
                bar.style.transform = 'scaleY(1)';
            };

            // 9. Etiqueta Inferior del Día (L, M, M, J...)
            const label = document.createElement('span');
            label.style.fontSize = '0.7rem';
            label.style.fontWeight = '600';
            label.style.color = '#94a3b8';
            label.style.marginTop = '8px';
            const daysArr = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
            label.innerText = daysArr[currentDate.getDay()];

            // Destacar si el día recorrido es 'Hoy'
            if (i === daysToShow - 1) {
                label.style.color = 'white';
            }

            // Ensamblar la Columna
            col.appendChild(bar);
            col.appendChild(label);

            // Añadir al Contenedor Global
            wrapper.appendChild(col);
        }

        // Título de la Sección
        const title = document.createElement('div');
        title.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px;">
                <h3 style="margin:0; font-size:1.1rem; color:#f8fafc; display:flex; align-items:center; gap:8px;">
                     <i class="fas fa-chart-line" style="color: #3b82f6;"></i> Retención y Constancia
                </h3>
                <span style="font-size:0.8rem; background: rgba(59, 130, 246, 0.2); color:#60a5fa; padding: 2px 8px; border-radius: 12px; font-weight: 600;">14 Días</span>
            </div>
        `;

        this.container.appendChild(title);
        this.container.appendChild(wrapper);
    }
}

// Global Export
window.ActivityHeatmap = ActivityHeatmap;
