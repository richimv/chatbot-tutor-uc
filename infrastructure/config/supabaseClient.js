
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ ADVERTENCIA: SUPABASE_URL o SUPABASE_KEY no definidos. La subida de archivos fallará.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
