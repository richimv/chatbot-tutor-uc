require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // En Render, usa la ANON KEY o la SERVICE_ROLE (ambas funcionan para validar)

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY en el Backend.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;