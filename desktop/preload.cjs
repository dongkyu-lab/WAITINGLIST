const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('waitingListDesktop',{
  getInfo:()=>ipcRenderer.invoke('desktop:info'),
  setAutoStart:value=>ipcRenderer.invoke('desktop:auto-start',value),
  backup:()=>ipcRenderer.invoke('desktop:backup'),
  openDataFolder:()=>ipcRenderer.invoke('desktop:open-data-folder')
});
