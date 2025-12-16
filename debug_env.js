const fs = require('fs');
const path = require('path');

console.log('--- raw file check ---');
try {
    const content = fs.readFileSync('.env.local', 'utf8');
    const urlLine = content.split('\n').find(l => l.includes('NEXT_PUBLIC_SUPABASE_URL'));
    const nextLine = content.split('\n')[content.split('\n').indexOf(urlLine) + 1];
    console.log('Line with URL key:', urlLine);
    console.log('Next line:', nextLine);
} catch (e) {
    console.log('Could not read .env.local');
}

console.log('\n--- dotenv parsing verify ---');
require('dotenv').config({ path: '.env.local' });
console.log('Loaded NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
