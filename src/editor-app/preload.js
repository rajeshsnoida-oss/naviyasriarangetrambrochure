const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('editorAPI', {
  openProject:  ()              => ipcRenderer.invoke('dialog:openProject'),
  saveProject:  (defaultPath)  => ipcRenderer.invoke('dialog:saveProject', defaultPath),
  writeFile:    (path, data)   => ipcRenderer.invoke('fs:writeFile', path, data),
  readFile:     (path)         => ipcRenderer.invoke('fs:readFile', path),
  openImages:   ()             => ipcRenderer.invoke('dialog:openImages'),
  exportDir:    ()             => ipcRenderer.invoke('dialog:exportDir'),
  copyImages:   (dir, imgs)    => ipcRenderer.invoke('dialog:copyImages', dir, imgs),
  readClipboardText: ()        => ipcRenderer.invoke('clipboard:readText'),
  previewOpen:  (html)         => ipcRenderer.invoke('preview:open', html),
  getSettings:   ()            => ipcRenderer.invoke('settings:get'),
  setSettings:   (obj)         => ipcRenderer.invoke('settings:set', obj),
  writeRecovery: (data)        => ipcRenderer.invoke('recovery:write', data),
  readRecovery:  ()            => ipcRenderer.invoke('recovery:read'),
  clearRecovery: ()            => ipcRenderer.invoke('recovery:clear'),

  // Asset management — images stored as files, referenced by asset://name
  importAsset:    (srcPath)       => ipcRenderer.invoke('asset:import', srcPath),
  importAssetData:(dataUrl, ext)  => ipcRenderer.invoke('asset:importDataUrl', dataUrl, ext),
  readAsset:      (name)          => ipcRenderer.invoke('asset:readDataUrl', name),
  copyAssetsToDir:(names, dir)    => ipcRenderer.invoke('asset:copyToDir', names, dir),
  setAssetDir:    (projectPath)   => ipcRenderer.invoke('asset:setDir', projectPath),
  clearAssetDir:  ()              => ipcRenderer.invoke('asset:clearDir'),

  onMenu: (channel, fn) => {
    const valid = ['menu:new','menu:open','menu:save','menu:save-as','menu:export',
                   'menu:undo','menu:redo','menu:delete','menu:duplicate',
                   'menu:zoom-in','menu:zoom-out','menu:zoom-fit'];
    if (valid.includes(channel)) ipcRenderer.on(channel, fn);
  },
});
