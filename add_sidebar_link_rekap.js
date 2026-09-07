const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/app/admin/**/*.tsx');
let count = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (file.includes('rekap-tahunan/page.tsx') || file.includes('PrintButton.tsx') || file.includes('TutupBukuClient.tsx')) continue;

  const target = '<Link href="/admin/tutup-buku" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Tutup Buku</Link>';
  const replacement = `<Link href="/admin/rekap-tahunan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Rekap Tahunan</Link>\n          ${target}`;

  const target2 = '<Link href="/admin/tutup-buku" className="block px-4 py-3 rounded-lg bg-blue-600 text-white font-medium">Tutup Buku</Link>';
  const replacement2 = `<Link href="/admin/rekap-tahunan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Rekap Tahunan</Link>\n          ${target2}`;

  let modified = false;
  if (content.includes(target) && !content.includes('/admin/rekap-tahunan')) {
    content = content.replace(target, replacement);
    modified = true;
  } else if (content.includes(target2) && !content.includes('/admin/rekap-tahunan')) {
    content = content.replace(target2, replacement2);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    count++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Updated ${count} files.`);
