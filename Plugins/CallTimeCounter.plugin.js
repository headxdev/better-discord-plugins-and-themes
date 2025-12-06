/**
 * @name CallTimeCounter
 * @source https://github.com/QWERTxD/BetterDiscordPlugins/blob/main/CallTimeCounter/CallTimeCounter.plugin.js
 * @description Zeigt an, wie lange du bereits in einem Voice-Channel bist. Ohne externe Abhängigkeiten.
 * @updateUrl https://raw.githubusercontent.com/QWERTxD/BetterDiscordPlugins/main/CallTimeCounter/CallTimeCounter.plugin.js
 * @website https://github.com/QWERTxD/BetterDiscordPlugins/tree/main/CallTimeCounter
 * @version 1.0.0
 * @author QWERT (verbessert)
 */

const { Webpack, Patcher, React, DOM, Data } = BdApi;

module.exports = class CallTimeCounter {
    constructor() {
        this.name = "CallTimeCounter";
        this.startTime = null;
        this.interval = null;
        this.lastChannelId = null;
        this.timerElement = null;
        this.observer = null;
        this.settings = {
            showSeconds: true,
            compactMode: false,
            showInPanel: true
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
            .voice-timer-container {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-top: 4px;
                font-size: 12px;
                color: var(--text-muted);
                font-weight: 500;
            }
            .voice-timer-container.compact {
                font-size: 10px;
            }
            .voice-timer-icon {
                width: 14px;
                height: 14px;
                fill: var(--text-muted);
            }
            .voice-timer-text {
                font-family: var(--font-primary);
            }
        `);

        // Voice-State überwachen
        this.setupVoiceStateListener();
        
        // Panel beobachten
        this.setupPanelObserver();
        
        BdApi.showToast("CallTimeCounter aktiviert", { type: "success" });
    }

    setupVoiceStateListener() {
        const Dispatcher = Webpack.getByKeys("dispatch", "subscribe");
        const SelectedChannelStore = Webpack.getStore("SelectedChannelStore");
        
        if (!Dispatcher || !SelectedChannelStore) {
            console.error("[CallTimeCounter] Module nicht gefunden");
            return;
        }

        this._handleVoiceState = (event) => {
            const currentChannelId = SelectedChannelStore.getVoiceChannelId();
            
            if (currentChannelId && !this.lastChannelId) {
                // Neu verbunden
                this.startTime = Date.now();
                this.startInterval();
            } else if (!currentChannelId && this.lastChannelId) {
                // Getrennt
                this.stopInterval();
                this.startTime = null;
            } else if (currentChannelId !== this.lastChannelId && currentChannelId) {
                // Channel gewechselt
                this.startTime = Date.now();
            }
            
            this.lastChannelId = currentChannelId;
        };

        Dispatcher.subscribe("VOICE_STATE_UPDATES", this._handleVoiceState);
        Dispatcher.subscribe("RTC_CONNECTION_STATE", this._handleVoiceState);
        
        // Initiale Prüfung
        const currentChannel = SelectedChannelStore.getVoiceChannelId();
        if (currentChannel) {
            this.lastChannelId = currentChannel;
            this.startTime = Date.now();
            this.startInterval();
        }
    }

    setupPanelObserver() {
        this.observer = new MutationObserver(() => {
            this.injectTimer();
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    startInterval() {
        if (this.interval) clearInterval(this.interval);
        
        this.interval = setInterval(() => {
            this.updateTimerDisplay();
        }, 1000);
    }

    stopInterval() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.removeTimerElement();
    }

    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (this.settings.showSeconds) {
            if (hours > 0) {
                return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            }
            return `${minutes}m`;
        }
    }

    injectTimer() {
        if (!this.settings.showInPanel || !this.startTime) return;
        
        // Finde das Voice-Panel
        const panelSelectors = [
            '[class*="voiceChannelName_"]',
            '[class*="rtcConnectionStatus_"]',
            '[class*="connection_"]'
        ];

        let panel = null;
        for (const selector of panelSelectors) {
            panel = document.querySelector(selector);
            if (panel) break;
        }

        if (!panel) return;
        
        // Prüfe ob Timer bereits existiert
        if (document.querySelector('.voice-timer-container')) return;

        const container = document.createElement('div');
        container.className = `voice-timer-container ${this.settings.compactMode ? 'compact' : ''}`;
        
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('class', 'voice-timer-icon');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.innerHTML = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>';
        
        const text = document.createElement('span');
        text.className = 'voice-timer-text';
        text.textContent = this.formatTime(Date.now() - this.startTime);
        
        container.appendChild(icon);
        container.appendChild(text);
        
        this.timerElement = container;
        
        // Füge Timer nach dem Panel-Element ein
        const parent = panel.parentElement;
        if (parent) {
            parent.appendChild(container);
        }
    }

    updateTimerDisplay() {
        if (!this.startTime) return;
        
        const timerText = document.querySelector('.voice-timer-text');
        if (timerText) {
            timerText.textContent = this.formatTime(Date.now() - this.startTime);
        } else {
            this.injectTimer();
        }
    }

    removeTimerElement() {
        const timer = document.querySelector('.voice-timer-container');
        if (timer) timer.remove();
        this.timerElement = null;
    }

    stop() {
        this.stopInterval();
        
        const Dispatcher = Webpack.getByKeys("dispatch", "subscribe");
        if (Dispatcher && this._handleVoiceState) {
            Dispatcher.unsubscribe("VOICE_STATE_UPDATES", this._handleVoiceState);
            Dispatcher.unsubscribe("RTC_CONNECTION_STATE", this._handleVoiceState);
        }
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        DOM.removeStyle(this.name);
        this.removeTimerElement();
        
        BdApi.showToast("CallTimeCounter deaktiviert", { type: "info" });
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.padding = "10px";
        panel.style.color = "var(--text-normal)";

        const settings = [
            { key: "showSeconds", label: "Sekunden anzeigen" },
            { key: "compactMode", label: "Kompakter Modus" },
            { key: "showInPanel", label: "Im Voice-Panel anzeigen" }
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

        // Aktuelle Zeit anzeigen
        if (this.startTime) {
            const timeInfo = document.createElement("p");
            timeInfo.style.marginTop = "20px";
            timeInfo.style.color = "var(--text-muted)";
            timeInfo.textContent = `Aktuelle Call-Zeit: ${this.formatTime(Date.now() - this.startTime)}`;
            panel.appendChild(timeInfo);
        }

        return panel;
    }
};
