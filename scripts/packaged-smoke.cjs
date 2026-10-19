const {resolve}=require('node:path');
const binary=resolve(process.platform==='win32'?'release/win-unpacked/Waiting List.exe':'release/linux-unpacked/waitinglist-studio');
require('./run-electron-smoke.cjs')(binary);
