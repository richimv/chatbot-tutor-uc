const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const d = path.join(__dirname, 'public');
const version = crypto.randomBytes(4).toString('hex');

fs.readdirSync(d).filter(f => f.endsWith('.html')).forEach(f => {
    const p = path.join(d, f);
    let c = fs.readFileSync(p, 'utf8');
    let changed = false;

    // Remove any existing ?v= query string from components.js to avoid ?v=old?v=new
    c = c.replace(/src="js\/ui\/components\.js(\?v=[^"]+)?"/g, `src="js/ui/components.js?v=${version}"`);
    c = c.replace(/src="\/js\/ui\/components\.js(\?v=[^"]+)?"/g, `src="/js/ui/components.js?v=${version}"`);
    
    // Y cache busting general para App.js
    c = c.replace(/src="js\/app\.js(\?v=[^"]+)?"/g, `src="js/app.js?v=${version}"`);
    c = c.replace(/src="\/js\/app\.js(\?v=[^"]+)?"/g, `src="/js/app.js?v=${version}"`);

    fs.writeFileSync(p, c);
    console.log(`Updated ${f} to version ${version}`);
});
