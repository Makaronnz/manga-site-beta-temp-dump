// scripts/fix-open-next.js
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

async function ensureDir(p){ await fsp.mkdir(p, { recursive: true }).catch(()=>{}); }

async function copyDir(src, dest){
  await ensureDir(dest);
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const e of entries){
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fsp.copyFile(s, d);
  }
}

(async () => {
  const root = ".open-next";
  const worker = path.join(root, "worker.js");
  const workerOut = path.join(root, "_worker.js");
  const serverFns = path.join(root, "server-functions");
  const fnsOut = path.join(root, "functions");

  if (fs.existsSync(worker)) {
    await fsp.copyFile(worker, workerOut);
    console.log("✓ worker.js → _worker.js");
  } else {
    console.warn("! worker.js not found");
  }

  if (fs.existsSync(serverFns)) {
    await copyDir(serverFns, fnsOut);
    console.log("✓ server-functions → functions");
  } else {
    console.warn("! server-functions not found");
  }
})();
