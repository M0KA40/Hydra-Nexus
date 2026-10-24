// === HYDRA STEAM MULTI-ACCOUNT & ACHIEVEMENT BRIDGE (ENGLISH / EVENT-DRIVEN) ===
(function () {
  if (global.__HYDRA_STEAM_BRIDGE_LOADED__) return;
  global.__HYDRA_STEAM_BRIDGE_LOADED__ = true;

  const fs = require("fs");
  const path = require("path");
  const os = require("os");
  const cp = require("child_process");
  const vdf = require("./steam-vdf.cjs");
  const electron = require("electron");
  const { app, ipcMain, BrowserWindow } = electron;

  const LOG_PREFIX = "[HydraSteamBridge]";
  function log(...args) {
    try { console.log(LOG_PREFIX, ...args); } catch (_) {}
  }

  function publicSteam(items){return global.__NEXUS_STEAM_PRIVACY__?.()?items.map(a=>({...a,accountName:undefined,personaName:a.personaName===a.accountName?'Steam account':a.personaName})):items;}
  function publicBindings(items){return global.__NEXUS_STEAM_PRIVACY__?.()?Object.fromEntries(Object.entries(items).map(([k,a])=>[k,{...a,accountName:undefined,personaName:a.personaName===a.accountName?'Steam account':a.personaName}])):items;}
  function getConfigPath() {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const hydraDir = path.join(appData, "Hydra");
    if (!fs.existsSync(hydraDir)) {
      fs.mkdirSync(hydraDir, { recursive: true });
    }
    return path.join(hydraDir, "steam-account-bindings.json");
  }

  function loadBindings() {
    try {
      const data=JSON.parse(fs.readFileSync(getConfigPath(), "utf8"));
      if(!data||Array.isArray(data)||typeof data!=="object"||Object.entries(data).some(([key,row])=>!/^(?:steam:)?\d+$/.test(key)||!row||Array.isArray(row)||typeof row!=="object"||!["crack","online","offline"].includes(row.mode)||row.steamId64!=null&&!/^\d{17}$/.test(row.steamId64)||[row.accountName,row.personaName].some(value=>value!=null&&(typeof value!=="string"||value.length>300))))throw Error("Invalid Steam binding data");
      return data;
    } catch (e) {
      if(e.code==='ENOENT')return {};
      log("Error loading bindings:",e);
      throw Error("Steam settings are damaged. The original file was preserved.");
    }
  }

  async function saveBindings(data) {
    try {
      await require("./themes.cjs").atomicText(getConfigPath(),JSON.stringify(data,null,2));
    } catch (e) {
      log("Error saving bindings:", e);throw e;
    }
  }

  let steamPathCache=null,steamPathPending=null,steamAccountsCache=[],bindingsQueue=Promise.resolve();
  const execSteam=(file,args)=>new Promise((resolve,reject)=>cp.execFile(file,args,{encoding:"utf8",windowsHide:true,timeout:10000,maxBuffer:1024*1024},(error,out)=>error?reject(error):resolve(out)));
  async function getSteamPath() {
    if(steamPathCache)return steamPathCache;
    if(steamPathPending)return steamPathPending;
    steamPathPending=resolveSteamPath().then(p=>steamPathCache=p).finally(()=>steamPathPending=null);return steamPathPending;
  }
  async function resolveSteamPath() {
    if (process.platform === "win32") {
      try {
        const out = await execSteam('reg.exe',['query','HKCU\\Software\\Valve\\Steam','/v','SteamPath']);
        const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
        if (m && m[1]) {
          const p = path.normalize(m[1].trim());
          if (fs.existsSync(p)) return p;
        }
      } catch (_) {}
      const candidates = [
        "C:\\Program Files (x86)\\Steam",
        "C:\\Program Files\\Steam",
        "D:\\Steam",
        "E:\\Steam"
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
    }
    return "C:\\Program Files (x86)\\Steam";
  }

  async function getSteamAccounts() {
    const steamPath = await getSteamPath();
    const vdfPath = path.join(steamPath, "config", "loginusers.vdf");
    if (!fs.existsSync(vdfPath)) return [];

    try {
      const content = await fs.promises.readFile(vdfPath, "utf8");
      const accounts = vdf.accountList(content);
      steamAccountsCache=accounts;return accounts;
    } catch (e) {
      log("Error parsing loginusers.vdf:", e);
      return [];
    }
  }

  async function findSteamGameExe(appId) {
    try {
      const steamPath = await getSteamPath();
      const libs = [steamPath];
      const libVdf = path.join(steamPath, "steamapps", "libraryfolders.vdf");
      if (fs.existsSync(libVdf)) {
        const txt = await fs.promises.readFile(libVdf, "utf8");
        const pathRegex = /"path"\s+"([^"]+)"/gi;
        let m;
        while ((m = pathRegex.exec(txt)) !== null) {
          const p = m[1].replace(/\\\\/g, "\\");
          if (fs.existsSync(p) && !libs.includes(p)) libs.push(p);
        }
      }

      for (const lib of libs) {
        const manifest = path.join(lib, "steamapps", `appmanifest_${appId}.acf`);
        if (fs.existsSync(manifest)) {
          const acf = await fs.promises.readFile(manifest, "utf8");
          const m = acf.match(/"installdir"\s+"([^"]+)"/i);
          if (m && m[1]) {
            const gameDir = path.join(lib, "steamapps", "common", m[1]);
            if (fs.existsSync(gameDir)) {
              const exes = await findExesInDir(gameDir, 3);
              if (exes.length > 0) {
                exes.sort((a, b) => b.size - a.size);
                return { gameDir, exePath: exes[0].fullPath, allExes: exes.map(x => x.fullPath) };
              }
            }
          }
        }
      }
    } catch (e) {
      log("findSteamGameExe error:", e);
    }
    return null;
  }

  async function findExesInDir(dir, maxDepth, currentDepth = 0) {
    let results = [];
    if (currentDepth > maxDepth) return results;
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const it of items) {
        const fullPath = path.join(dir, it.name);
        if (it.isDirectory()) {
          results = results.concat(await findExesInDir(fullPath, maxDepth, currentDepth + 1));
        } else if (it.isFile() && it.name.toLowerCase().endsWith(".exe")) {
          const lower = it.name.toLowerCase();
          if (
            !lower.includes("unins") &&
            !lower.includes("crash") &&
            !lower.includes("redist") &&
            !lower.includes("setup") &&
            !lower.includes("dxsetup") &&
            !lower.includes("unitycrash")
          ) {
            const st = await fs.promises.stat(fullPath);
            results.push({ fullPath, size: st.size });
          }
        }
      }
    } catch (_) {}
    return results;
  }

  async function switchSteamAccountAndLaunch(targetSteamId64, mode, appId, hasCustomExeInHydra) {
    const steamPath = await getSteamPath();
    const steamExe = path.join(steamPath, "steam.exe");
    const vdfPath = path.join(steamPath, "config", "loginusers.vdf");

    if (!fs.existsSync(vdfPath)) {
      throw new Error("Steam loginusers.vdf not found.");
    }

    const accounts = await getSteamAccounts();
    const targetAcc = accounts.find((a) => a.steamId64 === targetSteamId64);
    if (!targetAcc) {
      throw new Error("Selected Steam account was not found in loginusers.vdf.");
    }

    const wantOffline = mode === "offline" ? "1" : "0";

    try {
      await execSteam("taskkill.exe",["/F","/IM","steam.exe","/T"]);
      await new Promise((r) => setTimeout(r, 1800));
    } catch (_) {}

    let vdfContent = await fs.promises.readFile(vdfPath, "utf8");
    vdf.assertWellFormed(vdfContent);
    const rewritten = vdf.transformUserBlocks(vdfContent, (sid, body) => {
      const isTarget = sid === targetSteamId64;
      let newBody = body;
      newBody = vdf.setOrAddKey(newBody, "MostRecent", isTarget ? "1" : "0");
      if (isTarget) {
        newBody = vdf.setOrAddKey(newBody, "AllowAutoLogin", "1");
        newBody = vdf.setOrAddKey(newBody, "RememberPassword", "1");
        newBody = vdf.setOrAddKey(newBody, "WantsOfflineMode", wantOffline);
        newBody = vdf.setOrAddKey(newBody, "SkipOfflineModeWarning", "1");
      }
      return `"${sid}"\n\t{${newBody}}`;
    });
    // Re-parse before writing: if the surgery did not survive a round trip, leave the file untouched.
    if (rewritten === null || !vdf.accountList(rewritten).some((a) => a.steamId64 === targetSteamId64)) {
      throw new Error("Steam loginusers.vdf could not be updated safely. No changes were made.");
    }
    vdfContent = rewritten;

    await fs.promises.copyFile(vdfPath, vdfPath + ".hydra.bak");
    await require("./themes.cjs").atomicText(vdfPath, vdfContent);

    if (process.platform === "win32") {
      try {
        await execSteam('reg.exe',['add','HKCU\\Software\\Valve\\Steam','/v','AutoLoginUser','/t','REG_SZ','/d',targetAcc.accountName,'/f']);
        await execSteam('reg.exe',['add','HKCU\\Software\\Valve\\Steam','/v','RememberPassword','/t','REG_DWORD','/d','1','/f']);
      } catch (e) {
        log("Registry update warning:", e);
      }
    }

    startAchievementBridge(steamPath, targetSteamId64, String(appId));

    const args = ["-silent", "-nochatui", "-nofriendsui"];
    if (!hasCustomExeInHydra && appId) {
      args.push("-applaunch", String(appId));
    }

    const child = cp.spawn(steamExe, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    await new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});

    await new Promise((r) => setTimeout(r, 4500));
    hideSteamWindowOnce();
  }

  function hideSteamWindowOnce() {
    if (process.platform !== "win32") return;
    const psScript = `
      Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
        [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
      }
"@
      Get-Process steamwebhelper, steam -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match "Steam|Friends") {
          [Win32]::ShowWindowAsync($_.MainWindowHandle, 0) | Out-Null
        }
      }
    `;
    try {
      const p = cp.spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", psScript], {
        windowsHide: true,
        stdio: "ignore"
      });
      p.once('error',e=>log('Steam window hide skipped:',e.message));
      p.unref();
    } catch (_) {}
  }

  let activeFsWatcher = null,statsTimer=null,statsTask=null;

  function steamId64ToAccountId3(steamId64) {
    try {
      const base = BigInt("76561197960265728");
      const id = BigInt(steamId64);
      return String(id - base);
    } catch (_) {
      return "";
    }
  }

  async function syncSteamStatsBinToGoldberg(steamPath, steamId3, appId) {
    try {
      const statsDir = path.join(steamPath, "appcache", "stats");
      const userStatsBin = path.join(statsDir, `UserGameStats_${steamId3}_${appId}.bin`);
      const schemaBin = path.join(statsDir, `UserGameStatsSchema_${appId}.bin`);

      if (!fs.existsSync(userStatsBin)) return;

      const userBuf = await fs.promises.readFile(userStatsBin);
      const schemaBuf = await fs.promises.readFile(schemaBin).catch(e=>{if(e.code==='ENOENT')return null;throw e;});

      const unlocked = parseSteamUserGameStats(userBuf, schemaBuf);
      if (!unlocked || Object.keys(unlocked).length === 0) return;

      const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
      const targetDirs = [
        path.join(appData, "Goldberg SteamEmu Saves", String(appId)),
        path.join(appData, "GSE Saves", String(appId))
      ];

      for (const dir of targetDirs) {
        if (!fs.existsSync(dir)) {
          await fs.promises.mkdir(dir, { recursive: true });
        }
        const achJsonPath = path.join(dir, "achievements.json");
        let current = {};
        if (fs.existsSync(achJsonPath)) {
          try {
            current = JSON.parse(await fs.promises.readFile(achJsonPath, "utf8"));
          } catch (_) {}
        }

        let changed = false;
        for (const [achName, info] of Object.entries(unlocked)) {
          if (!current[achName] || !current[achName].earned) {
            current[achName] = {
              earned: true,
              earned_time: info.earned_time || Math.floor(Date.now() / 1000)
            };
            changed = true;
          }
        }

        if (changed) {
          await require("./themes.cjs").atomicText(achJsonPath,JSON.stringify(current,null,2));
          log(`Synced unlocked achievements for AppID ${appId}`);
        }
      }
    } catch (e) {
      log("Achievement sync error:", e);
    }
  }

  function parseBinaryVdfBuffer(buf) {
    let offset = 0;
    function readCString() {
      const start = offset;
      while (offset < buf.length && buf[offset] !== 0) offset++;
      const str = buf.toString("utf8", start, offset);
      offset++;
      return str;
    }
    function parseNode() {
      const obj = {};
      while (offset < buf.length) {
        const type = buf[offset++];
        if (type === 0x08) break;
        const key = readCString();
        if (type === 0x00) {
          obj[key] = parseNode();
        } else if (type === 0x01) {
          obj[key] = readCString();
        } else if (type === 0x02) {
          if (offset + 4 <= buf.length) {
            obj[key] = buf.readUInt32LE(offset);
            offset += 4;
          }
        } else if (type === 0x03) {
          if (offset + 4 <= buf.length) {
            obj[key] = buf.readFloatLE(offset);
            offset += 4;
          }
        } else if (type === 0x07) {
          if (offset + 8 <= buf.length) {
            obj[key] = Number(buf.readBigUInt64LE(offset));
            offset += 8;
          }
        } else {
          break;
        }
      }
      return obj;
    }
    try {
      return parseNode();
    } catch (_) {
      return {};
    }
  }

  function parseSteamUserGameStats(userBuf, schemaBuf) {
    const result = {};
    const userTree = parseBinaryVdfBuffer(userBuf);
    const schemaTree = schemaBuf ? parseBinaryVdfBuffer(schemaBuf) : {};

    const bitMap = {};
    function scanSchemaForBits(node) {
      if (!node || typeof node !== "object") return;
      if (node.bits && typeof node.bits === "object" && node.id !== undefined) {
        const statId = String(node.id);
        bitMap[statId] = bitMap[statId] || {};
        for (const [bitKey, bitObj] of Object.entries(node.bits)) {
          if (bitObj && typeof bitObj === "object" && bitObj.name) {
            const bitNum = bitObj.bit !== undefined ? Number(bitObj.bit) : Number(bitKey);
            bitMap[statId][bitNum] = String(bitObj.name);
          }
        }
      }
      for (const val of Object.values(node)) {
        if (val && typeof val === "object") scanSchemaForBits(val);
      }
    }
    scanSchemaForBits(schemaTree);

    function scanUserNode(node) {
      if (!node || typeof node !== "object") return;
      const statsNode = node.stats || node.Stats;
      const achTimes = node.AchievementTimes || node.achievementtimes || {};
      if (statsNode && typeof statsNode === "object") {
        for (const [statId, statObj] of Object.entries(statsNode)) {
          const mask = (statObj && typeof statObj === "object" && statObj.data !== undefined)
            ? Number(statObj.data)
            : (typeof statObj === "number" ? statObj : null);
          if (mask !== null && bitMap[statId]) {
            for (const [bitStr, achName] of Object.entries(bitMap[statId])) {
              const bitIndex = Number(bitStr);
              if ((mask & (1 << bitIndex)) !== 0) {
                const unlockTime =
                  (statObj && statObj.AchievementTimes && statObj.AchievementTimes[bitStr]) ||
                  achTimes[bitStr] ||
                  Math.floor(Date.now() / 1000);
                result[achName] = { earned: true, earned_time: Number(unlockTime) };
              }
            }
          }
        }
      }
      for (const val of Object.values(node)) {
        if (val && typeof val === "object") scanUserNode(val);
      }
    }
    scanUserNode(userTree);
    return result;
  }

  function startAchievementBridge(steamPath, steamId64, appId) {
    const steamId3 = steamId64ToAccountId3(steamId64);
    if (!steamId3 || !appId) return;

    clearTimeout(statsTimer);
    if (activeFsWatcher) {
      try { activeFsWatcher.close(); } catch (_) {}
      activeFsWatcher = null;
    }

    const sync=()=>{const task=(statsTask||Promise.resolve()).then(()=>syncSteamStatsBinToGoldberg(steamPath,steamId3,appId));statsTask=task;task.finally(()=>{if(statsTask===task)statsTask=null;});};
    sync();

    const statsDir = path.join(steamPath, "appcache", "stats");
    const targetFile = `UserGameStats_${steamId3}_${appId}.bin`.toLowerCase();
    if (fs.existsSync(statsDir)) {
      try {
        activeFsWatcher = fs.watch(statsDir, (_eventType, filename) => {
          if (filename && filename.toLowerCase() === targetFile) {
            clearTimeout(statsTimer);statsTimer=setTimeout(sync,250);
          }
        });
      } catch (e) {
        log("fs.watch error:", e);
      }
    }
  }

  // One preparation owns Steam until its native launch callback has finished.
  // Identical clicks share that operation; other requests are rejected, never queued
  // to switch accounts underneath a game that the first request just launched.
  let activeSteamLaunch = null;
  function assertLaunchAllowed() {
    if(global.__NEXUS_UPDATE_BUSY__?.())throw Error('An update operation is already running');
    if(global.__NEXUS_RESTORE_ACTIVE__?.())throw Error('A game backup is being restored. Wait for the restore to finish before launching a game.');
  }
  async function runSteamLaunch(event, args, listener) {
    assertLaunchAllowed();
    const options = args[0] && typeof args[0] === "object" ? args[0] :
      {shop:args[0],objectId:args[1],executablePath:args[2],launchOptions:args[3]};
    const shop = String(options.shop || "steam");
    const objectId = String(options.objectId || options.gameId || "");
    const exePath = options.executablePath || "";
    const bindings = global.__HYDRA_NEXUS_ENABLED__?.("steam") !== false && shop === "steam" ? loadBindings() : {};
    const gameCfg = global.__HYDRA_NEXUS_ENABLED__?.("steam") !== false && shop === "steam" ?
      (bindings[`${shop}:${objectId}`] || bindings[objectId]) : null;
    const switches = !!(gameCfg && gameCfg.mode && gameCfg.mode !== "crack" && gameCfg.steamId64);
    const signature = JSON.stringify([shop,objectId,exePath,options.launchOptions||"",gameCfg?.steamId64,gameCfg?.mode]);
    if (activeSteamLaunch) {
      if (switches && activeSteamLaunch.signature === signature) return activeSteamLaunch.task;
      const error = Error('Another Steam launch is being prepared. Try again shortly.');
      notifyRendererToast(error.message, true);
      throw error;
    }
    if (!switches) return await listener(event, ...args);

    const operation = {signature,task:null};
    activeSteamLaunch = operation;
    operation.task = (async () => {
      try {
        // Do not expose a saved login name while the account cache is still cold.
        const hideLogin = global.__NEXUS_STEAM_PRIVACY__?.();
        const shownName = gameCfg.personaName || gameCfg.accountName || "";
        const account = !shownName || hideLogin && shownName === gameCfg.accountName ? null : shownName;
        // Keep account/mode data raw so an in-flight toast follows live language changes.
        notifyRendererToast({kind:'steam-switch',account,mode:gameCfg.mode});
        await switchSteamAccountAndLaunch(gameCfg.steamId64,gameCfg.mode,objectId,Boolean(exePath));
      } catch (err) {
        log("Error in pre-launch Steam switch:", err);
        notifyRendererToast("Steam Switch Error: " + (err.message || String(err)), true);
        throw err;
      }
      assertLaunchAllowed();
      return await listener(event, ...args);
    })();
    try { return await operation.task; }
    finally { if (activeSteamLaunch === operation) activeSteamLaunch = null; }
  }
  global.__NEXUS_STEAM_NATIVE_LAUNCH__ = (nativeLaunch, options) =>
    runSteamLaunch(null, [options], () => nativeLaunch(options));

  const originalHandle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = function (channel, listener) {
    if (channel === "openGame" || channel === "launchGame") {
      return originalHandle(channel, (event, ...args) => runSteamLaunch(event, args, listener));
    }
    return originalHandle(channel, listener);
  };

  function notifyRendererToast(msg, isError = false) {
    if(global.__NEXUS_STEAM_PRIVACY__?.()){
      const redact=value=>{for(const a of steamAccountsCache)if(a.accountName)value=String(value).split(a.accountName).join("[private]");return value;};
      if(msg?.kind==='steam-switch')msg={...msg,account:msg.account==null?null:redact(msg.account)};
      else msg=redact(msg);
    }
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents
          .executeJavaScript(
            `window.__hydraSteamShowToast && window.__hydraSteamShowToast(${JSON.stringify(msg)}, ${Boolean(isError)});`
          )
          .catch(() => {});
      }
    }
  }

  const UI_INJECTION_SCRIPT = require('./i18n.cjs').rendererScript()+"("+require("./steam-ui.js").toString()+")();";

  function attachToWindow(win) {
    if (!win || win.isDestroyed() || win.__hsbAttached) return;
    win.__hsbAttached = true;

    const inject = () => {
      if (!win.isDestroyed() && global.__HYDRA_NEXUS_TRUSTED__?.(win)!==false) {
        win.webContents.executeJavaScript(UI_INJECTION_SCRIPT).catch((err) => {
          log("UI inject error:", err);
        });
      }
    };

    win.webContents.on("dom-ready", inject);
    win.webContents.on("did-finish-load", inject);
    win.webContents.on("did-navigate-in-page", inject);

    win.webContents.on("console-message", async (...eventArgs) => {
      if(global.__HYDRA_NEXUS_ENABLED__?.("steam")===false || global.__HYDRA_NEXUS_TRUSTED__?.(win)===false)return;
      const details=eventArgs.find(x=>x&&typeof x==="object"&&typeof x.message==="string");
      const message=details?details.message:eventArgs[2];
      if (typeof message === "string" && message.startsWith("__HYDRA_STEAM_IPC__")) {
        try {
          const raw = message.slice("__HYDRA_STEAM_IPC__".length);
          const { action, payload } = JSON.parse(raw);

          if (action === "requestData") {
            const accounts = publicSteam(await getSteamAccounts());
            const bindings = publicBindings(loadBindings());
            win.webContents
              .executeJavaScript(
                `window.__hydraSteamReceive && window.__hydraSteamReceive(${JSON.stringify({
                  accounts,
                  bindings: publicBindings(bindings)
                })});`
              )
              .catch(() => {});
          } else if (action === "saveBinding") {
            if(!/^\d+$/.test(String(payload?.objectId))||!["crack","online","offline"].includes(payload?.mode))throw Error("Invalid Steam binding");
            const change=bindingsQueue.then(async()=>{const bindings=loadBindings();
            bindings[payload.objectId] = {
              mode: payload.mode,
              steamId64: payload.steamId64,
              accountName: (await getSteamAccounts()).find(a=>a.steamId64===payload.steamId64)?.accountName||"",
              personaName: payload.personaName,
              updatedAt: Date.now()
            };
            await saveBindings(bindings);return bindings;});bindingsQueue=change.catch(()=>{});
            let bindings;
            try{bindings=await change;}catch(e){notifyRendererToast('Steam settings were not saved: '+(e.message||'the binding file could not be written'),true);throw e;}
            const accounts = publicSteam(await getSteamAccounts());
            win.webContents
              .executeJavaScript(
                `window.__hydraSteamReceive && window.__hydraSteamReceive(${JSON.stringify({
                  accounts,
                  bindings: publicBindings(bindings)
                })});`
              )
              .catch(() => {});
          } else if (action === "findExe") {
            if(!/^\d+$/.test(String(payload?.objectId)))throw Error("Invalid Steam app ID");
            const found = await findSteamGameExe(payload.objectId);
            win.webContents
              .executeJavaScript(
                `window.__hydraSteamReceive && window.__hydraSteamReceive(${JSON.stringify({
                  currentExeInfo: {
                    appId: payload.objectId,
                    exePath: found ? found.exePath : null
                  }
                })});`
              )
              .catch(() => {});
            if (found && found.exePath) {
              // Clipboard feedback is handled after the renderer confirms the copy.
            }
          }
        } catch (e) {
          log("IPC parse error:", e);
        }
      }
    });
  }

  app.on("browser-window-created", (_event, win) => {
    attachToWindow(win);
  });

  app.whenReady().then(() => {
    for (const win of BrowserWindow.getAllWindows()) {
      attachToWindow(win);
    }
  });

  app.on("before-quit", () => {
    clearTimeout(statsTimer);
    if (activeFsWatcher) {
      try { activeFsWatcher.close(); } catch (_) {}
      activeFsWatcher = null;
    }
  });
})();
