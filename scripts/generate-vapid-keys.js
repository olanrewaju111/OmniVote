const webPush = require('web-push');
const fs = require('fs');
const path = require('path');

const vapidKeys = webPush.generateVAPIDKeys();

const keysFile = path.join(__dirname, '..', '.vapid-keys.json');
fs.writeFileSync(keysFile, JSON.stringify(vapidKeys, null, 2));

console.log('VAPID keys generated and saved to .vapid-keys.json');
console.log('');
console.log('Add the following to your .env file:');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@omnivote.ng`);
console.log('');
console.log('NOTE: Never commit .vapid-keys.json to version control.');
