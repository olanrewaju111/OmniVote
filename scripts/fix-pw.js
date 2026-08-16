const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const db = new Database('/home/z/my-project/db/custom.db', { readonly: false });
const hash = bcrypt.hashSync('password', 12);
console.log('Generated hash:', hash.substring(0, 30) + '...');

const users = db.prepare("SELECT id, email FROM User WHERE passwordHash = 'changeme'").all();
console.log(`Found ${users.length} users with plaintext passwordHash`);

const stmt = db.prepare('UPDATE User SET passwordHash = ? WHERE id = ?');
for (const u of users) {
  stmt.run(hash, u.id);
  console.log(`  Fixed: ${u.email}`);
}

db.close();
console.log('Done!');
