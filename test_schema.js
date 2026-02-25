const db = require('./infrastructure/database/db');
db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_question_history'").then(r => {
    console.dir(r.rows);
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
