const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/app/admin/**/*.tsx');
let count = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Skip the file we just created
  if (file.includes('tutup-buku/page.tsx') || file.includes('TutupBukuClient.tsx')) continue;

  const target = '<Link href="/admin/laporan" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Laporan Bulanan</Link>';
  const replacement = `${target}\n          <Link href="/admin/tutup-buku" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Tutup Buku</Link>`;

  const target2 = '<Link href="/admin/laporan" className="block px-4 py-3 rounded-lg bg-blue-600 text-white font-medium">Laporan Bulanan</Link>';
  const replacement2 = `${target2}\n          <Link href="/admin/tutup-buku" className="block px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition">Tutup Buku</Link>`;

  let modified = false;
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    modified = true;
  } else if (content.includes(target2)) {
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
