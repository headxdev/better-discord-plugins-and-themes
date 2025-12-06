/**
 * @name PluginCompatHelper
 * @author HeadX
 * @description Verbessert die Kompatibilität zwischen BetterDiscord-Plugins und behebt häufige Fehler. Lädt vor anderen Plugins.
 * @version 1.0.0
 * @website https://github.com/headxdev/better-discord-plugins-and-themes
 * @source https://github.com/headxdev/better-discord-plugins-and-themes
 */

const { Webpack, Patcher, Data, DOM } = BdApi;

module.exports = class PluginCompatHelper {
    constructor() {
        this.name = "PluginCompatHelper";
        this.patches = [];
        this.moduleCache = new Map();
        this.settings = {
            enableModuleCache: true,
            enableErrorSuppression: true,
            enableWebpackFixes: true,
            showDebugLogs: false
        };
    }

    loadSettings() {
        const saved = Data.load(this.name, "settings");
        this.settings = saved ? { ...this.settings, ...saved } : this.settings;
    }

    saveSettings() {
        Data.save(this.name, "settings", this.settings);
    }

    log(...args) {
        if (this.settings.showDebugLogs) {
            console.log(`[${this.name}]`, ...args);
        }
    }

    start() {
        this.loadSettings();
        
        // CSS-Fixes für Plugin-Kompatibilität
        this.addCompatStyles();
        
        // Webpack-Module cachen für bessere Performance
        if (this.settings.enableModuleCache) {
            this.setupModuleCache();
        }
        
        // Fehlerbehandlung für häufige Plugin-Probleme
        if (this.settings.enableErrorSuppression) {
            this.setupErrorHandling();
        }
        
        // Webpack-Fixes für ältere Plugins
        if (this.settings.enableWebpackFixes) {
            this.setupWebpackFixes();
        }
        
        // Globale Hilfsfunktionen bereitstellen
        this.setupGlobalHelpers();
        
        this.log("Plugin gestartet");
        BdApi.showToast("PluginCompatHelper aktiviert", { type: "success" });
    }

    addCompatStyles() {
        DOM.addStyle(this.name, `
            /* Grundlegende Kompatibilitätsfixes */
            
            /* VoiceActivity & Voice-Plugins */
            [class*="voiceUser"] {
                position: relative;
            }
            
            /* Timer-Plugins Kompatibilität */
            .voiceTimer, .timeCounter {
                font-family: var(--font-primary);
                font-size: 12px;
                color: var(--text-muted);
            }
            
            /* MessageLogger Kompatibilität */
            .messagelogger-deleted,
            .messagelogger-edited {
                position: relative;
            }
            
            /* Folder-Plugins Fixes */
            [class*="folderContent"] {
                z-index: 100;
            }
            
            /* Modal/Popup Fixes */
            .bd-addon-modal,
            [class*="layerContainer"] {
                z-index: 1000 !important;
            }
            
            /* Tooltip-Fixes */
            [class*="tooltip"] {
                z-index: 10000 !important;
            }
            
            /* Context-Menu Fixes */
            [class*="menu"] {
                z-index: 10001 !important;
            }
            
            /* SpotifyControls Panel Fix */
            [class*="panels"] [class*="spotify"] {
                position: relative;
                z-index: 1;
            }
            
            /* PasscodeLock Overlay Fix */
            .passcode-lock-overlay {
                z-index: 99999 !important;
            }
            
            /* GalaxyBackground Fixes - Falls aktiviert */
            body.galaxy-active [class*="layers"] {
                background: transparent !important;
            }
            
            /* Allgemeine Scrollbar-Fixes */
            ::-webkit-scrollbar {
                width: 8px;
            }
            
            ::-webkit-scrollbar-track {
                background: var(--background-secondary);
            }
            
            ::-webkit-scrollbar-thumb {
                background: var(--background-modifier-accent);
                border-radius: 4px;
            }
        `);
    }

    setupModuleCache() {
        // Häufig verwendete Module cachen
        const commonModules = [
            { name: "Dispatcher", keys: ["dispatch", "subscribe"] },
            { name: "UserStore", store: "UserStore" },
            { name: "GuildStore", store: "GuildStore" },
            { name: "ChannelStore", store: "ChannelStore" },
            { name: "SelectedChannelStore", store: "SelectedChannelStore" },
            { name: "VoiceStateStore", store: "VoiceStateStore" },
            { name: "MediaEngineStore", store: "MediaEngineStore" },
            { name: "RelationshipStore", store: "RelationshipStore" }
        ];

        commonModules.forEach(mod => {
            try {
                let module;
                if (mod.store) {
                    module = Webpack.getStore(mod.store);
                } else if (mod.keys) {
                    module = Webpack.getByKeys(...mod.keys);
                }
                
                if (module) {
                    this.moduleCache.set(mod.name, module);
                    this.log(`Modul gecached: ${mod.name}`);
                }
            } catch (err) {
                this.log(`Fehler beim Cachen von ${mod.name}:`, err);
            }
        });

        // Globalen Zugriff ermöglichen
        window.BDModuleCache = this.moduleCache;
    }

    setupErrorHandling() {
        // Fehler bei fehlenden Modulen abfangen
        const originalGetModule = Webpack.getModule;
        if (originalGetModule) {
            Webpack.getModule = (...args) => {
                try {
                    return originalGetModule.apply(Webpack, args);
                } catch (err) {
                    this.log("Webpack.getModule Fehler abgefangen:", err);
                    return null;
                }
            };
        }

        // Unhandled Promise Rejections abfangen
        window.addEventListener("unhandledrejection", (event) => {
            const error = event.reason;
            if (error?.message?.includes("Cannot read properties of undefined") ||
                error?.message?.includes("Cannot read properties of null") ||
                error?.message?.includes("is not a function")) {
                this.log("Promise-Rejection abgefangen:", error);
                event.preventDefault();
            }
        });
    }

    setupWebpackFixes() {
        // Kompatibilität für ältere Plugin-APIs
        if (!window.WebpackModules) {
            window.WebpackModules = {
                getByProps: (...props) => Webpack.getByKeys(...props),
                getByDisplayName: (name) => Webpack.getModule(m => m?.displayName === name),
                getByString: (str) => Webpack.getModule(m => m?.toString?.().includes(str)),
                find: (filter) => Webpack.getModule(filter),
                findAll: (filter) => Webpack.getModule(filter, { searchExports: true, first: false }) || [],
                getModule: (filter) => Webpack.getModule(filter)
            };
            this.log("WebpackModules Polyfill erstellt");
        }

        // ZeresPluginLibrary Fallback für einfache Plugins
        if (!window.ZeresPluginLibrary && !global.ZeresPluginLibrary) {
            // Minimaler Fallback
            const minimalZLibrary = {
                buildPlugin: (config) => {
                    const Plugin = class {
                        constructor() {
                            this.config = config;
                        }
                        getName() { return config.info?.name || "Unknown"; }
                        getAuthor() { return config.info?.authors?.map(a => a.name).join(", ") || "Unknown"; }
                        getVersion() { return config.info?.version || "0.0.0"; }
                        getDescription() { return config.info?.description || ""; }
                        start() { this.onStart?.(); }
                        stop() { this.onStop?.(); }
                    };
                    
                    const Library = {
                        Patcher: BdApi.Patcher,
                        DiscordModules: {
                            React: BdApi.React,
                            Dispatcher: Webpack.getByKeys("dispatch", "subscribe")
                        },
                        WebpackModules: window.WebpackModules,
                        PluginUtilities: {
                            addStyle: (id, css) => DOM.addStyle(id, css),
                            removeStyle: (id) => DOM.removeStyle(id)
                        }
                    };
                    
                    return [Plugin, Library];
                }
            };
            
            // Nicht als globales ZLibrary setzen, da das echte ZeresPluginLibrary besser ist
            // Dies ist nur ein Fallback für einfache Plugins
            window.MinimalZLibrary = minimalZLibrary;
            this.log("Minimaler ZLibrary-Fallback erstellt");
        }
    }

    setupGlobalHelpers() {
        // Hilfsfunktionen für andere Plugins
        window.BDHelpers = {
            // Modul aus Cache holen
            getModule: (name) => this.moduleCache.get(name),
            
            // Sicherer Patcher
            safePatch: (id, module, method, callback, options = {}) => {
                try {
                    if (!module || !module[method]) {
                        this.log(`SafePatch: Methode ${method} nicht gefunden`);
                        return null;
                    }
                    return Patcher.after(id, module, method, callback);
                } catch (err) {
                    this.log(`SafePatch Fehler:`, err);
                    return null;
                }
            },
            
            // Sicherer Store-Zugriff
            safeGetStore: (name) => {
                try {
                    return Webpack.getStore(name);
                } catch {
                    return null;
                }
            },
            
            // Verzögertes Ausführen
            waitFor: (selector, timeout = 5000) => {
                return new Promise((resolve, reject) => {
                    const element = document.querySelector(selector);
                    if (element) return resolve(element);
                    
                    const observer = new MutationObserver((mutations, obs) => {
                        const el = document.querySelector(selector);
                        if (el) {
                            obs.disconnect();
                            resolve(el);
                        }
                    });
                    
                    observer.observe(document.body, { childList: true, subtree: true });
                    
                    setTimeout(() => {
                        observer.disconnect();
                        reject(new Error(`Timeout waiting for ${selector}`));
                    }, timeout);
                });
            },
            
            // Toast mit Plugin-Präfix
            showToast: (pluginName, message, type = "info") => {
                BdApi.showToast(`[${pluginName}] ${message}`, { type });
            }
        };
        
        this.log("Globale Hilfsfunktionen eingerichtet");
    }

    stop() {
        // Styles entfernen
        DOM.removeStyle(this.name);
        
        // Globale Objekte aufräumen
        delete window.BDModuleCache;
        delete window.BDHelpers;
        
        this.moduleCache.clear();
        
        this.log("Plugin gestoppt");
        BdApi.showToast("PluginCompatHelper deaktiviert", { type: "info" });
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.padding = "15px";
        panel.style.color = "var(--text-normal)";

        const title = document.createElement("h3");
        title.textContent = "Plugin Compatibility Helper";
        title.style.marginBottom = "15px";
        panel.appendChild(title);

        const desc = document.createElement("p");
        desc.textContent = "Dieses Plugin verbessert die Kompatibilität zwischen verschiedenen BetterDiscord-Plugins.";
        desc.style.marginBottom = "20px";
        desc.style.color = "var(--text-muted)";
        panel.appendChild(desc);

        const settings = [
            { key: "enableModuleCache", label: "Modul-Cache aktivieren (verbessert Performance)" },
            { key: "enableErrorSuppression", label: "Fehler-Unterdrückung aktivieren" },
            { key: "enableWebpackFixes", label: "Webpack-Fixes für ältere Plugins" },
            { key: "showDebugLogs", label: "Debug-Logs anzeigen" }
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

        // Info über gecachte Module
        const cacheInfo = document.createElement("div");
        cacheInfo.style.marginTop = "20px";
        cacheInfo.style.padding = "10px";
        cacheInfo.style.background = "var(--background-secondary)";
        cacheInfo.style.borderRadius = "8px";
        
        const cacheTitle = document.createElement("h4");
        cacheTitle.textContent = "Gecachte Module";
        cacheTitle.style.marginBottom = "10px";
        cacheInfo.appendChild(cacheTitle);
        
        const moduleList = document.createElement("ul");
        moduleList.style.margin = "0";
        moduleList.style.paddingLeft = "20px";
        moduleList.style.color = "var(--text-muted)";
        
        this.moduleCache.forEach((_, name) => {
            const li = document.createElement("li");
            li.textContent = name;
            moduleList.appendChild(li);
        });
        
        if (this.moduleCache.size === 0) {
            const li = document.createElement("li");
            li.textContent = "Keine Module gecached";
            moduleList.appendChild(li);
        }
        
        cacheInfo.appendChild(moduleList);
        panel.appendChild(cacheInfo);

        // Hinweis
        const hint = document.createElement("p");
        hint.textContent = "Hinweis: Einige Änderungen erfordern einen Neustart von Discord.";
        hint.style.marginTop = "20px";
        hint.style.fontSize = "12px";
        hint.style.color = "var(--text-muted)";
        panel.appendChild(hint);

        return panel;
    }
};
