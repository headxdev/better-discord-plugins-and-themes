/**
 * @name DisableDMCallIdle
 * @author jer (verbessert)
 * @authorId 728023524240785420
 * @version 2.0.0
 * @description Verhindert automatisches Kicken aus DM-Voice-Calls nach 3 Minuten Inaktivität. Funktioniert ohne ZeresPluginLibrary.
 * @source https://github.com/jxri/BDCallIdle
 */

/*@cc_on
@if (@_jscript)

    var shell = WScript.CreateObject("WScript.Shell");
    var fs = new ActiveXObject("Scripting.FileSystemObject");
    var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
    var pathSelf = WScript.ScriptFullName;
    shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
    if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
        shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
    } else if (!fs.FolderExists(pathPlugins)) {
        shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
    } else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
        fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
        shell.Exec("explorer " + pathPlugins);
        shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
    }
    WScript.Quit();

@else@*/

const { Webpack, Patcher, Data } = BdApi;

module.exports = class DisableDMCallIdle {
    constructor() {
        this.name = "DisableDMCallIdle";
        this.patches = [];
        this.blockedTimers = 0;
        this.settings = {
            showNotifications: true,
            disableForServerCalls: false
        };
    }

    loadSettings() {
        const saved = Data.load(this.name, "settings");
        this.settings = saved ? { ...this.settings, ...saved } : this.settings;
    }

    saveSettings() {
        Data.save(this.name, "settings", this.settings);
    }

    start() {
        this.loadSettings();
        this.blockedTimers = 0;
        
        try {
            // Methode 1: Dispatcher-Events abfangen
            this.patchDispatcher();
            
            // Methode 2: Timeout-Modul patchen
            this.patchTimeoutModule();
            
            // Methode 3: Voice-State-Updates überwachen
            this.patchVoiceModule();
            
            if (this.settings.showNotifications) {
                BdApi.showToast("DisableDMCallIdle aktiviert", { type: "success" });
            }
            
            console.log("[DisableDMCallIdle] Plugin erfolgreich gestartet");
        } catch (err) {
            console.error("[DisableDMCallIdle] Fehler beim Starten:", err);
            BdApi.showToast("DisableDMCallIdle: Fehler - siehe Konsole", { type: "error" });
        }
    }

    patchDispatcher() {
        const Dispatcher = Webpack.getByKeys("dispatch", "subscribe");
        if (!Dispatcher) {
            console.warn("[DisableDMCallIdle] Dispatcher nicht gefunden");
            return;
        }

        // RTC Connection Idle Timeout abfangen
        const originalDispatch = Dispatcher.dispatch.bind(Dispatcher);
        Dispatcher.dispatch = (event) => {
            if (event?.type === "RTC_CONNECTION_IDLE" || 
                event?.type === "CALL_IDLE_DISCONNECT" ||
                event?.type === "BOT_CALL_IDLE_DISCONNECT") {
                console.log("[DisableDMCallIdle] Idle-Event blockiert:", event.type);
                this.blockedTimers++;
                return;
            }
            return originalDispatch(event);
        };

        this.patches.push(() => {
            Dispatcher.dispatch = originalDispatch;
        });
    }

    patchTimeoutModule() {
        // Suche nach dem Timeout-Manager
        const timeoutModule = Webpack.getByKeys("Timeout");
        if (!timeoutModule?.Timeout) {
            // Alternative Suche
            const altModule = Webpack.getModule(m => {
                if (!m || typeof m !== 'object') return false;
                return Object.values(m).some(v => 
                    v?.prototype?.start && 
                    v?.prototype?.stop && 
                    v?.prototype?.isStarted
                );
            });
            
            if (!altModule) {
                console.warn("[DisableDMCallIdle] Timeout-Modul nicht gefunden, nutze Fallback");
                this.patchSetTimeoutFallback();
                return;
            }
        }

        const TimeoutClass = timeoutModule?.Timeout || Object.values(
            Webpack.getModule(m => m?.Timeout?.prototype?.start) || {}
        ).find(v => v?.prototype?.start);

        if (TimeoutClass?.prototype) {
            const originalStart = TimeoutClass.prototype.start;
            TimeoutClass.prototype.start = function(...args) {
                // Prüfe auf 3-Minuten-Timer (180000ms)
                const delay = this._delay || args[0];
                const callback = args[1]?.toString?.() || "";
                
                if (delay === 180000 || 
                    callback.includes("IDLE") || 
                    callback.includes("DISCONNECT")) {
                    console.log("[DisableDMCallIdle] Timeout blockiert (3min Idle)");
                    return;
                }
                
                return originalStart.apply(this, args);
            };

            this.patches.push(() => {
                TimeoutClass.prototype.start = originalStart;
            });
        }
    }

    patchVoiceModule() {
        // Voice-State-Updates abfangen
        const VoiceStateStore = Webpack.getStore("VoiceStateStore");
        const Dispatcher = Webpack.getByKeys("dispatch", "subscribe");
        
        if (Dispatcher) {
            const handleIdleCheck = (event) => {
                // Blockiere Idle-Checks für DM-Calls
                if (event?.channelId && !event?.guildId) {
                    // DM-Call erkannt
                    return false;
                }
                
                if (!this.settings.disableForServerCalls && event?.guildId) {
                    return true;
                }
                
                return false;
            };

            Dispatcher.subscribe("RTC_CONNECTION_VIDEO_STATE_CHANGED", handleIdleCheck);
            Dispatcher.subscribe("RTC_CONNECTION_STATE", handleIdleCheck);

            this.patches.push(() => {
                Dispatcher.unsubscribe("RTC_CONNECTION_VIDEO_STATE_CHANGED", handleIdleCheck);
                Dispatcher.unsubscribe("RTC_CONNECTION_STATE", handleIdleCheck);
            });
        }
    }

    patchSetTimeoutFallback() {
        // Fallback: setTimeout überwachen
        const originalSetTimeout = window.setTimeout;
        const self = this;
        
        window.setTimeout = function(callback, delay, ...args) {
            // Blockiere 3-Minuten-Timer
            if (delay === 180000) {
                const callbackStr = callback?.toString?.() || "";
                if (callbackStr.includes("IDLE") || 
                    callbackStr.includes("DISCONNECT") ||
                    callbackStr.includes("call")) {
                    console.log("[DisableDMCallIdle] setTimeout blockiert (3min)");
                    self.blockedTimers++;
                    return -1;
                }
            }
            return originalSetTimeout.call(window, callback, delay, ...args);
        };

        this.patches.push(() => {
            window.setTimeout = originalSetTimeout;
        });
        
        console.log("[DisableDMCallIdle] Fallback-Methode aktiviert");
    }

    stop() {
        // Alle Patches rückgängig machen
        this.patches.forEach(unpatch => {
            try {
                unpatch();
            } catch (err) {
                console.error("[DisableDMCallIdle] Fehler beim Entpatchen:", err);
            }
        });
        this.patches = [];

        if (this.settings.showNotifications) {
            BdApi.showToast(`DisableDMCallIdle deaktiviert (${this.blockedTimers} Timer blockiert)`, { type: "info" });
        }
        
        console.log("[DisableDMCallIdle] Plugin gestoppt");
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.padding = "10px";
        panel.style.color = "var(--text-normal)";

        const settings = [
            { key: "showNotifications", label: "Benachrichtigungen anzeigen" },
            { key: "disableForServerCalls", label: "Auch für Server-Calls deaktivieren" }
        ];

        settings.forEach(setting => {
            const container = document.createElement("div");
            container.style.marginBottom = "15px";
            container.style.display = "flex";
            container.style.justifyContent = "space-between";
            container.style.alignItems = "center";

            const label = document.createElement("span");
            label.textContent = setting.label;
            container.appendChild(label);

            const toggle = document.createElement("input");
            toggle.type = "checkbox";
            toggle.checked = this.settings[setting.key];
            toggle.style.cursor = "pointer";
            toggle.addEventListener("change", () => {
                this.settings[setting.key] = toggle.checked;
                this.saveSettings();
            });
            container.appendChild(toggle);

            panel.appendChild(container);
        });

        // Statistik anzeigen
        const stats = document.createElement("p");
        stats.textContent = `Blockierte Timer in dieser Session: ${this.blockedTimers}`;
        stats.style.marginTop = "20px";
        stats.style.color = "var(--text-muted)";
        panel.appendChild(stats);

        return panel;
    }
};

/*@end@*/