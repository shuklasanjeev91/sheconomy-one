const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('sheconomyDesktop', {
  platform: process.platform,
  isDesktop: true,
})
