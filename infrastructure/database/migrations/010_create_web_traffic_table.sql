
-- Migración para el sistema de analíticas en tiempo real (Opción B)
CREATE TABLE IF NOT EXISTS web_traffic (
    session_id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    last_ping TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_mobile BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas rápidas de sesiones activas (últimos 5 minutos)
CREATE INDEX IF NOT EXISTS idx_web_traffic_pulse ON web_traffic (last_ping);

-- Índice para contar visitas diarias únicas
CREATE INDEX IF NOT EXISTS idx_web_traffic_daily ON web_traffic (created_at);

-- ✅ SEGURIDAD RLS (Supabase)
ALTER TABLE web_traffic ENABLE ROW LEVEL SECURITY;

-- Política: Permitir inserción/actualización pública (necesario para tracking anónimo)
CREATE POLICY "Permitir registro de pulsos público" 
ON web_traffic FOR ALL 
USING (true) 
WITH CHECK (true);

-- Política: Solo administradores pueden ver los datos de tráfico
CREATE POLICY "Solo admins ven tráfico" 
ON web_traffic FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);
