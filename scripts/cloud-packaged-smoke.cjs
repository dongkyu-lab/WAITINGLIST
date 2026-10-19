const {resolve}=require('node:path');
require('./run-electron-smoke.cjs')(resolve(process.platform==='win32'?'release/win-unpacked/Waiting List.exe':'release/linux-unpacked/waitinglist-studio'),['--require-google-smoke']);
