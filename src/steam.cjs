// === HYDRA STEAM MULTI-ACCOUNT & ACHIEVEMENT BRIDGE (ENGLISH / EVENT-DRIVEN) ===
(function () {
  if (global.__HYDRA_STEAM_BRIDGE_LOADED__) return;
  global.__HYDRA_STEAM_BRIDGE_LOADED__ = true;

  const fs = require("fs");
  const path = require("path");
  const os = require("os");
  const cp = require("child_process");
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
      const p = getConfigPath();
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf8"));
      }
    } catch (e) {
      log("Error loading bindings:", e);
    }
    return {};
  }

  function saveBindings(data) {
    try {
      fs.writeFileSync(getConfigPath(), JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      log("Error saving bindings:", e);
    }
  }

  function getSteamPath() {
    if (process.platform === "win32") {
      try {
        const out = cp.execSync(
          'reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath',
          { encoding: "utf8", windowsHide: true }
        );
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

  function getSteamAccounts() {
    const steamPath = getSteamPath();
    const vdfPath = path.join(steamPath, "config", "loginusers.vdf");
    if (!fs.existsSync(vdfPath)) return [];

    try {
      const content = fs.readFileSync(vdfPath, "utf8");
      const accounts = [];
      const userBlockRegex = /"(\d{17})"\s*\{([^}]*)\}/g;
      let match;
      while ((match = userBlockRegex.exec(content)) !== null) {
        const steamId64 = match[1];
        const body = match[2];
        const getVal = (key) => {
          const r = new RegExp('"' + key + '"\\s+"([^"]*)"', "i");
          const m = body.match(r);
          return m ? m[1] : "";
        };
        const accountName = getVal("AccountName");
        const personaName = getVal("PersonaName") || accountName;
        const mostRecent = getVal("MostRecent") === "1";
        const wantsOffline = getVal("WantsOfflineMode") === "1";
        if (accountName) {
          accounts.push({
            steamId64,
            accountName,
            personaName,
            mostRecent,
            wantsOffline
          });
        }
      }
      return accounts;
    } catch (e) {
      log("Error parsing loginusers.vdf:", e);
      return [];
    }
  }

  function findSteamGameExe(appId) {
    try {
      const steamPath = getSteamPath();
      const libs = [steamPath];
      const libVdf = path.join(steamPath, "steamapps", "libraryfolders.vdf");
      if (fs.existsSync(libVdf)) {
        const txt = fs.readFileSync(libVdf, "utf8");
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
          const acf = fs.readFileSync(manifest, "utf8");
          const m = acf.match(/"installdir"\s+"([^"]+)"/i);
          if (m && m[1]) {
            const gameDir = path.join(lib, "steamapps", "common", m[1]);
            if (fs.existsSync(gameDir)) {
              const exes = findExesInDir(gameDir, 3);
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

  function findExesInDir(dir, maxDepth, currentDepth = 0) {
    let results = [];
    if (currentDepth > maxDepth) return results;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const it of items) {
        const fullPath = path.join(dir, it.name);
        if (it.isDirectory()) {
          results = results.concat(findExesInDir(fullPath, maxDepth, currentDepth + 1));
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
            const st = fs.statSync(fullPath);
            results.push({ fullPath, size: st.size });
          }
        }
      }
    } catch (_) {}
    return results;
  }

  async function switchSteamAccountAndLaunch(targetSteamId64, mode, appId, hasCustomExeInHydra) {
    const steamPath = getSteamPath();
    const steamExe = path.join(steamPath, "steam.exe");
    const vdfPath = path.join(steamPath, "config", "loginusers.vdf");

    if (!fs.existsSync(vdfPath)) {
      throw new Error("Steam loginusers.vdf not found.");
    }

    const accounts = getSteamAccounts();
    const targetAcc = accounts.find((a) => a.steamId64 === targetSteamId64);
    if (!targetAcc) {
      throw new Error("Selected Steam account was not found in loginusers.vdf.");
    }

    const wantOffline = mode === "offline" ? "1" : "0";

    try {
      cp.execSync("taskkill /F /IM steam.exe /T", { windowsHide: true, stdio: "ignore" });
      await new Promise((r) => setTimeout(r, 1800));
    } catch (_) {}

    let vdfContent = fs.readFileSync(vdfPath, "utf8");
    const userBlockRegex = /"(\d{17})"\s*\{([^}]*)\}/g;
    vdfContent = vdfContent.replace(userBlockRegex, (fullBlock, sid, body) => {
      const isTarget = sid === targetSteamId64;
      let newBody = body;

      const setOrAddKey = (text, key, val) => {
        const r = new RegExp('("' + key + '"\\s+)"[^"]*"', "i");
        if (r.test(text)) {
          return text.replace(r, `$1"${val}"`);
        } else {
          return text.trimEnd() + `\n\t\t"${key}"\t\t"${val}"\n\t`;
        }
      };

      newBody = setOrAddKey(newBody, "MostRecent", isTarget ? "1" : "0");
      if (isTarget) {
        newBody = setOrAddKey(newBody, "AllowAutoLogin", "1");
        newBody = setOrAddKey(newBody, "RememberPassword", "1");
        newBody = setOrAddKey(newBody, "WantsOfflineMode", wantOffline);
        newBody = setOrAddKey(newBody, "SkipOfflineModeWarning", "1");
      }
      return `"${sid}"\n\t{${newBody}}`;
    });

    try {
      fs.copyFileSync(vdfPath, vdfPath + ".hydra.bak");
    } catch (_) {}
    fs.writeFileSync(vdfPath, vdfContent, "utf8");

    if (process.platform === "win32") {
      try {
        cp.execSync(
          `reg add "HKCU\\Software\\Valve\\Steam" /v AutoLoginUser /t REG_SZ /d "${targetAcc.accountName}" /f`,
          { windowsHide: true, stdio: "ignore" }
        );
        cp.execSync(
          `reg add "HKCU\\Software\\Valve\\Steam" /v RememberPassword /t REG_DWORD /d 1 /f`,
          { windowsHide: true, stdio: "ignore" }
        );
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
    child.unref();

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
      p.unref();
    } catch (_) {}
  }

  let activeFsWatcher = null;

  function steamId64ToAccountId3(steamId64) {
    try {
      const base = BigInt("76561197960265728");
      const id = BigInt(steamId64);
      return String(id - base);
    } catch (_) {
      return "";
    }
  }

  function syncSteamStatsBinToGoldberg(steamPath, steamId3, appId) {
    try {
      const statsDir = path.join(steamPath, "appcache", "stats");
      const userStatsBin = path.join(statsDir, `UserGameStats_${steamId3}_${appId}.bin`);
      const schemaBin = path.join(statsDir, `UserGameStatsSchema_${appId}.bin`);

      if (!fs.existsSync(userStatsBin)) return;

      const userBuf = fs.readFileSync(userStatsBin);
      const schemaBuf = fs.existsSync(schemaBin) ? fs.readFileSync(schemaBin) : null;

      const unlocked = parseSteamUserGameStats(userBuf, schemaBuf);
      if (!unlocked || Object.keys(unlocked).length === 0) return;

      const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
      const targetDirs = [
        path.join(appData, "Goldberg SteamEmu Saves", String(appId)),
        path.join(appData, "GSE Saves", String(appId))
      ];

      for (const dir of targetDirs) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const achJsonPath = path.join(dir, "achievements.json");
        let current = {};
        if (fs.existsSync(achJsonPath)) {
          try {
            current = JSON.parse(fs.readFileSync(achJsonPath, "utf8"));
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
          fs.writeFileSync(achJsonPath, JSON.stringify(current, null, 2), "utf8");
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

    if (activeFsWatcher) {
      try { activeFsWatcher.close(); } catch (_) {}
      activeFsWatcher = null;
    }

    syncSteamStatsBinToGoldberg(steamPath, steamId3, appId);

    const statsDir = path.join(steamPath, "appcache", "stats");
    const targetFile = `UserGameStats_${steamId3}_${appId}.bin`.toLowerCase();
    if (fs.existsSync(statsDir)) {
      try {
        activeFsWatcher = fs.watch(statsDir, (_eventType, filename) => {
          if (filename && filename.toLowerCase() === targetFile) {
            syncSteamStatsBinToGoldberg(steamPath, steamId3, appId);
          }
        });
      } catch (e) {
        log("fs.watch error:", e);
      }
    }
  }

  const originalHandle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = function (channel, listener) {
    if (channel === "openGame" || channel === "launchGame") {
      return originalHandle(channel, async (event, ...args) => {
        if(global.__HYDRA_NEXUS_ENABLED__?.("steam")===false)return listener(event,...args);
        try {
          let shop = "steam";
          let objectId = "";
          let exePath = "";

          if (args[0] && typeof args[0] === "object") {
            shop = args[0].shop || "steam";
            objectId = String(args[0].objectId || args[0].gameId || "");
            exePath = args[0].executablePath || "";
          } else {
            shop = String(args[0] || "steam");
            objectId = String(args[1] || "");
            exePath = String(args[2] || "");
          }

          const bindings = loadBindings();
          const gameCfg = bindings[objectId] || bindings[`${shop}:${objectId}`];

          if (gameCfg && gameCfg.mode && gameCfg.mode !== "crack" && gameCfg.steamId64) {
            notifyRendererToast(
              `Switching Steam to ${gameCfg.personaName || gameCfg.accountName} (${gameCfg.mode.toUpperCase()})...`
            );
            await switchSteamAccountAndLaunch(
              gameCfg.steamId64,
              gameCfg.mode,
              objectId,
              Boolean(exePath)
            );
          }
        } catch (err) {
          log("Error in pre-launch Steam switch:", err);
          notifyRendererToast("Steam Switch Error: " + (err.message || String(err)), true);
        }

        return await listener(event, ...args);
      });
    }
    return originalHandle(channel, listener);
  };

  function notifyRendererToast(msg, isError = false) {
    if(global.__NEXUS_STEAM_PRIVACY__?.()){for(const a of getSteamAccounts())if(a.accountName)msg=String(msg).split(a.accountName).join("[private]");}
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

  const UI_INJECTION_SCRIPT = "("+require("./steam-ui.js").toString()+")();";

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

    win.webContents.on("did-finish-load", inject);
    win.webContents.on("did-navigate-in-page", inject);

    win.webContents.on("console-message", (...eventArgs) => {
      if(global.__HYDRA_NEXUS_ENABLED__?.("steam")===false || global.__HYDRA_NEXUS_TRUSTED__?.(win)===false)return;
      const details=eventArgs.find(x=>x&&typeof x==="object"&&typeof x.message==="string");
      const message=details?details.message:eventArgs[2];
      if (typeof message === "string" && message.startsWith("__HYDRA_STEAM_IPC__")) {
        try {
          const raw = message.slice("__HYDRA_STEAM_IPC__".length);
          const { action, payload } = JSON.parse(raw);

          if (action === "requestData") {
            const accounts = publicSteam(getSteamAccounts());
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
            const bindings = loadBindings();
            bindings[payload.objectId] = {
              mode: payload.mode,
              steamId64: payload.steamId64,
              accountName: getSteamAccounts().find(a=>a.steamId64===payload.steamId64)?.accountName||"",
              personaName: payload.personaName,
              updatedAt: Date.now()
            };
            saveBindings(bindings);
            const accounts = publicSteam(getSteamAccounts());
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
            const found = findSteamGameExe(payload.objectId);
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
    if (activeFsWatcher) {
      try { activeFsWatcher.close(); } catch (_) {}
      activeFsWatcher = null;
    }
  });
})();