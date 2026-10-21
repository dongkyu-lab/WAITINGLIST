const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('waitingListDesktop',{
  getInfo:()=>ipcRenderer.invoke('desktop:info'),
  setAutoStart:value=>ipcRenderer.invoke('desktop:auto-start',value),
  backup:()=>ipcRenderer.invoke('desktop:backup'),
  openDataFolder:()=>ipcRenderer.invoke('desktop:open-data-folder'),
  googleLogin:()=>ipcRenderer.invoke('desktop:google-login'),
  retryGoogleAccess:()=>ipcRenderer.invoke('desktop:retry-google-access'),
  configureCloud:()=>ipcRenderer.invoke('desktop:configure-cloud'),
  getCloudSetup:()=>ipcRenderer.invoke('desktop:cloud-setup'),
  copyAccessRules:email=>ipcRenderer.invoke('desktop:copy-access-rules',email),
  openOAuthClients:()=>ipcRenderer.invoke('desktop:oauth-clients'),
  openAuthDomains:()=>ipcRenderer.invoke('desktop:auth-domains'),
  openCloudGuide:()=>ipcRenderer.invoke('desktop:cloud-guide')
});
