// Build script para Cloudflare Pages
// Copia o site para a pasta 'build' e gera assets/js/env.local.js com variáveis de ambiente
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'build');

function rmDirIfExists(dir){
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch(e){ console.error('Erro ao limpar build:', e); }
}

function ensureDir(dir){
  try { fs.mkdirSync(dir, { recursive: true }); } catch(e){}
}

function copyRecursive(src, dest){
  const skip = new Set(['.git', 'node_modules', 'build']);
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const base = path.basename(src);
    if (skip.has(base)) return;
    ensureDir(dest);
    for (const name of fs.readdirSync(src)){
      const s = path.join(src, name);
      const d = path.join(dest, name);
      copyRecursive(s, d);
    }
  } else if (stat.isFile()) {
    fs.copyFileSync(src, dest);
  }
}

function writeEnvLocal(destFile){
  const env = {
    USE_SUPABASE: (process.env.USE_SUPABASE === '1' || process.env.USE_SUPABASE === 'true' || !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL),
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  };
  const content = 'window.__ENV = ' + JSON.stringify(env, null, 2) + ';\n';
  ensureDir(path.dirname(destFile));
  fs.writeFileSync(destFile, content, 'utf8');
  console.log('Gerado', destFile);
}

(function main(){
  rmDirIfExists(outDir);
  ensureDir(outDir);
  console.log('Copiando site para', outDir);
  copyRecursive(root, outDir);
  const destFile = path.join(outDir, 'assets', 'js', 'env.local.js');
  writeEnvLocal(destFile);
  console.log('Build finalizado. Use "build" como Output Directory no Cloudflare Pages.');
})();
