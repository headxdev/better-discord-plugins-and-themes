/**
 * @name PluginHealthCheck
 * @author HeadX
 * @authorId 808385710700494919
 * @description Überwacht den Status aller Plugins, zeigt Fehler an und bietet Diagnose-Tools. Hilft bei der Fehlerbehebung.
 * @version 1.0.0
 * @invite J6wTJJ5fp
 * @website https://github.com/headxdev/better-discord-plugins-and-themes
 * @source https://github.com/headxdev/better-discord-plugins-and-themes
 * @updateUrl https://raw.githubusercontent.com/headxdev/better-discord-plugins-and-themes/refs/heads/main/plugins/0PluginHealthCheck.plugin.js
 */

const { Webpack, Patcher, Data, DOM, Plugins, UI } = BdApi;

module.exports = class PluginHealthCheck {
    constructor() {
        this.name = "PluginHealthCheck";
        this.pluginStatus = new Map();
        this.errorLog = [];
        this.checkInterval = null;
        this.settings = {
            autoCheck: true,
            checkIntervalMinutes: 5,
            showNotifications: true,
            logToConsole: true
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
        
        // CSS hinzufügen
        DOM.addStyle(this.name, `
            .plugin-health-status {
                padding: 10px;
                margin: 5px 0;
                border-radius: 8px;
                background: var(--background-secondary);
            }
            .plugin-health-status.healthy {
                border-left: 4px solid var(--status-positive);
            }
            .plugin-health-status.warning {
                border-left: 4px solid var(--status-warning);
            }
            .plugin-health-status.error {
                border-left: 4px solid var(--status-danger);
            }
            .plugin-health-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 5px;
            }
            .plugin-health-name {
                font-weight: 600;
                color: var(--text-normal);
            }
            .plugin-health-version {
                font-size: 12px;
                color: var(--text-muted);
            }
            .plugin-health-message {
                font-size: 13px;
                color: var(--text-muted);
            }
            .health-check-btn {
                padding: 8px 16px;
                background: var(--brand-experiment);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin: 5px;
            }
            .health-check-btn:hover {
                background: var(--brand-experiment-560);
            }
            .health-check-btn.secondary {
                background: var(--background-secondary-alt);
                color: var(--text-normal);
            }
        `);

        // Fehler-Handler einrichten
        this.setupErrorHandler();
        
        // Initial-Check
        setTimeout(() => this.runHealthCheck(), 2000);
        
        // Periodischer Check
        if (this.settings.autoCheck) {
            this.checkInterval = setInterval(
                () => this.runHealthCheck(true), 
                this.settings.checkIntervalMinutes * 60 * 1000
            );
        }
        
        this.log("Plugin gestartet");
    }

    setupErrorHandler() {
        // Globale Fehler abfangen
        this._originalOnError = window.onerror;
        window.onerror = (message, source, lineno, colno, error) => {
            this.handleError({ message, source, lineno, colno, error });
            if (this._originalOnError) {
                return this._originalOnError(message, source, lineno, colno, error);
            }
            return false;
        };

        // Promise-Rejections abfangen
        this._unhandledRejection = (event) => {
            this.handleError({ 
                message: "Unhandled Promise Rejection", 
                error: event.reason 
            });
        };
        window.addEventListener("unhandledrejection", this._unhandledRejection);
    }

    handleError(errorInfo) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            ...errorInfo,
            plugin: this.identifyPluginFromError(errorInfo)
        };
        
        this.errorLog.push(errorEntry);
        
        // Nur die letzten 100 Fehler behalten
        if (this.errorLog.length > 100) {
            this.errorLog.shift();
        }
        
        if (this.settings.logToConsole) {
            console.warn("[PluginHealthCheck] Fehler erkannt:", errorEntry);
        }
    }

    identifyPluginFromError(errorInfo) {
        const source = errorInfo.source || errorInfo.error?.stack || "";
        
        // Versuche Plugin aus Stack-Trace zu identifizieren
        const pluginMatch = source.match(/([A-Za-z0-9]+)\.plugin\.js/);
        if (pluginMatch) {
            return pluginMatch[1];
        }
        
        return "Unbekannt";
    }

    runHealthCheck(silent = false) {
        this.pluginStatus.clear();
        const plugins = Plugins.getAll();
        let issues = 0;
        
        plugins.forEach(plugin => {
            const status = this.checkPlugin(plugin);
            this.pluginStatus.set(plugin.name, status);
            
            if (status.status !== "healthy") {
                issues++;
            }
        });
        
        if (!silent && this.settings.showNotifications) {
            if (issues === 0) {
                BdApi.showToast(`Alle ${plugins.length} Plugins sind gesund`, { type: "success" });
            } else {
                BdApi.showToast(`${issues} Plugin(s) mit Problemen gefunden`, { type: "warning" });
            }
        }
        
        this.log(`Health-Check abgeschlossen: ${plugins.length} Plugins, ${issues} Probleme`);
        
        return { total: plugins.length, issues };
    }

    checkPlugin(plugin) {
        const result = {
            name: plugin.name,
            version: plugin.version || "Unbekannt",
            author: plugin.author || "Unbekannt",
            status: "healthy",
            messages: []
        };
        
        try {
            // Prüfe ob Plugin aktiviert ist
            const isEnabled = Plugins.isEnabled(plugin.name);
            
            if (!isEnabled) {
                result.status = "warning";
                result.messages.push("Plugin ist deaktiviert");
            }
            
            // Prüfe auf fehlende Abhängigkeiten
            if (this.checkDependencies(plugin)) {
                result.messages.push(...this.checkDependencies(plugin));
                if (result.messages.some(m => m.includes("fehlt"))) {
                    result.status = "error";
                }
            }
            
            // Prüfe auf bekannte Probleme
            const knownIssues = this.checkKnownIssues(plugin);
            if (knownIssues.length > 0) {
                result.messages.push(...knownIssues);
                result.status = "warning";
            }
            
            // Prüfe ob Plugin Fehler in den letzten Minuten hatte
            const recentErrors = this.errorLog.filter(
                e => e.plugin === plugin.name && 
                (Date.now() - new Date(e.timestamp).getTime()) < 5 * 60 * 1000
            );
            
            if (recentErrors.length > 0) {
                result.status = "error";
                result.messages.push(`${recentErrors.length} Fehler in den letzten 5 Minuten`);
            }
            
            if (result.status === "healthy" && result.messages.length === 0) {
                result.messages.push("Keine Probleme erkannt");
            }
            
        } catch (err) {
            result.status = "error";
            result.messages.push(`Fehler beim Überprüfen: ${err.message}`);
        }
        
        return result;
    }

    checkDependencies(plugin) {
        const messages = [];
        const content = plugin.source || "";
        
        // Prüfe auf ZeresPluginLibrary
        if (content.includes("ZeresPluginLibrary") || content.includes("ZLibrary")) {
            if (!global.ZeresPluginLibrary && !window.ZeresPluginLibrary) {
                messages.push("ZeresPluginLibrary fehlt - 0PluginLibrary.plugin.js aktivieren");
            }
        }
        
        // Prüfe auf BDFDB
        if (content.includes("BDFDB") || content.includes("window.BDFDB_Global")) {
            if (!window.BDFDB_Global) {
                messages.push("BDFDB Library fehlt - 0BDFDB.plugin.js aktivieren");
            }
        }
        
        // Prüfe auf XenoLib
        if (content.includes("XenoLib")) {
            if (!window.XenoLib) {
                messages.push("XenoLib fehlt - 1XenoLib.plugin.js aktivieren");
            }
        }
        
        return messages;
    }

    checkKnownIssues(plugin) {
        const issues = [];
        const name = plugin.name.toLowerCase();
        
        // Bekannte Kompatibilitätsprobleme
        const knownIssuesList = {
            "messagelog": ["Kann hohe CPU-Last verursachen bei vielen Nachrichten"],
            "showhiddenchannels": ["Kann bei Server-Wechsel kurz hängen"],
            "galaxybackground": ["Erfordert WebGL-Unterstützung", "Kann Performance beeinflussen"],
            "platformindicators": ["Benötigt Neustart nach Discord-Updates"]
        };
        
        for (const [key, problems] of Object.entries(knownIssuesList)) {
            if (name.includes(key)) {
                issues.push(...problems);
            }
        }
        
        return issues;
    }

    log(...args) {
        if (this.settings.logToConsole) {
            console.log(`[${this.name}]`, ...args);
        }
    }

    stop() {
        // Interval stoppen
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        // Error Handler entfernen
        if (this._originalOnError) {
            window.onerror = this._originalOnError;
        }
        if (this._unhandledRejection) {
            window.removeEventListener("unhandledrejection", this._unhandledRejection);
        }
        
        // Styles entfernen
        DOM.removeStyle(this.name);
        
        this.log("Plugin gestoppt");
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.padding = "15px";
        panel.style.color = "var(--text-normal)";

        // Titel
        const title = document.createElement("h2");
        title.textContent = "Plugin Health Check";
        title.style.marginBottom = "20px";
        panel.appendChild(title);

        // Buttons
        const buttonContainer = document.createElement("div");
        buttonContainer.style.marginBottom = "20px";

        const checkBtn = document.createElement("button");
        checkBtn.textContent = "Jetzt prüfen";
        checkBtn.className = "health-check-btn";
        checkBtn.addEventListener("click", () => {
            this.runHealthCheck();
            this.updateStatusDisplay(statusContainer);
        });
        buttonContainer.appendChild(checkBtn);

        const clearLogBtn = document.createElement("button");
        clearLogBtn.textContent = "Fehler-Log leeren";
        clearLogBtn.className = "health-check-btn secondary";
        clearLogBtn.addEventListener("click", () => {
            this.errorLog = [];
            BdApi.showToast("Fehler-Log geleert", { type: "success" });
        });
        buttonContainer.appendChild(clearLogBtn);

        panel.appendChild(buttonContainer);

        // Einstellungen
        const settingsTitle = document.createElement("h3");
        settingsTitle.textContent = "Einstellungen";
        settingsTitle.style.marginBottom = "10px";
        panel.appendChild(settingsTitle);

        const settings = [
            { key: "autoCheck", label: "Automatische Prüfung aktivieren" },
            { key: "showNotifications", label: "Benachrichtigungen anzeigen" },
            { key: "logToConsole", label: "In Konsole loggen" }
        ];

        settings.forEach(setting => {
            const container = document.createElement("div");
            container.style.marginBottom = "10px";
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

        // Status-Container
        const statusTitle = document.createElement("h3");
        statusTitle.textContent = "Plugin-Status";
        statusTitle.style.marginTop = "20px";
        statusTitle.style.marginBottom = "10px";
        panel.appendChild(statusTitle);

        const statusContainer = document.createElement("div");
        statusContainer.id = "plugin-status-container";
        this.updateStatusDisplay(statusContainer);
        panel.appendChild(statusContainer);

        // Fehler-Log
        const errorTitle = document.createElement("h3");
        errorTitle.textContent = `Letzte Fehler (${this.errorLog.length})`;
        errorTitle.style.marginTop = "20px";
        errorTitle.style.marginBottom = "10px";
        panel.appendChild(errorTitle);

        const errorContainer = document.createElement("div");
        errorContainer.style.maxHeight = "200px";
        errorContainer.style.overflowY = "auto";
        errorContainer.style.background = "var(--background-secondary)";
        errorContainer.style.padding = "10px";
        errorContainer.style.borderRadius = "8px";
        errorContainer.style.fontSize = "12px";
        errorContainer.style.fontFamily = "monospace";

        if (this.errorLog.length === 0) {
            errorContainer.textContent = "Keine Fehler aufgezeichnet.";
        } else {
            this.errorLog.slice(-10).reverse().forEach(error => {
                const errorDiv = document.createElement("div");
                errorDiv.style.marginBottom = "10px";
                errorDiv.style.borderBottom = "1px solid var(--background-modifier-accent)";
                errorDiv.style.paddingBottom = "10px";
                
                const time = new Date(error.timestamp).toLocaleTimeString();
                errorDiv.innerHTML = `
                    <strong>${time}</strong> - ${error.plugin || "Unbekannt"}<br>
                    <span style="color: var(--text-danger)">${error.message || "Unbekannter Fehler"}</span>
                `;
                errorContainer.appendChild(errorDiv);
            });
        }
        panel.appendChild(errorContainer);

        return panel;
    }

    updateStatusDisplay(container) {
        container.innerHTML = "";
        
        // Führe Check durch falls noch nicht geschehen
        if (this.pluginStatus.size === 0) {
            this.runHealthCheck(true);
        }

        // Sortiere: Fehler zuerst, dann Warnungen, dann Gesund
        const sorted = [...this.pluginStatus.entries()].sort((a, b) => {
            const order = { error: 0, warning: 1, healthy: 2 };
            return order[a[1].status] - order[b[1].status];
        });

        sorted.forEach(([name, status]) => {
            const statusDiv = document.createElement("div");
            statusDiv.className = `plugin-health-status ${status.status}`;

            statusDiv.innerHTML = `
                <div class="plugin-health-header">
                    <span class="plugin-health-name">${status.name}</span>
                    <span class="plugin-health-version">v${status.version}</span>
                </div>
                <div class="plugin-health-message">${status.messages.join(" | ")}</div>
            `;

            container.appendChild(statusDiv);
        });
    }
};
