/**
 * @name AutoReconnectVoice
 * @version 2.0.0
 * @description Automatisches Wiederverbinden zu Voice-Channels bei Verbindungsabbruch. Unterstützt Server-VCs und DM-Calls.
 * @author HeadX
 * @authorId 808385710700494919
 * @invite J6wTJJ5fp
 * @website https://github.com/headxdev/better-discord-plugins-and-themes
 * @source https://github.com/headxdev/better-discord-plugins-and-themes
 * @updateUrl https://raw.githubusercontent.com/headxdev/better-discord-plugins-and-themes/refs/heads/main/plugins/autoreconnect.plugin.js
 */

const { Webpack, Patcher, Data, UI } = BdApi;

module.exports = class AutoReconnectVoice {
  constructor() {
    this.name = "AutoReconnectVoice";
    this.settings = this.getDefaultSettings();
    this.retryCount = 0;
    this._timeoutId = null;
    this._lastVoiceState = null;
    this._isReconnecting = false;
    this._dispatcher = null;
    this._voiceStateStore = null;
    this._selectedChannelStore = null;
    this._voiceModule = null;
  }

  getDefaultSettings() {
    return {
      maxRetries: 50,
      retryDelay: 5000,
      autoReconnectOnDisconnect: true,
      showNotifications: true,
      reconnectServerVC: true,
      reconnectDMCalls: true
    };
  }

  loadSettings() {
    const saved = Data.load(this.name, "settings");
    this.settings = saved ? { ...this.getDefaultSettings(), ...saved } : this.getDefaultSettings();
  }

  saveSettings() {
    Data.save(this.name, "settings", this.settings);
  }

  start() {
    this.loadSettings();
    this.retryCount = 0;
    this._isReconnecting = false;
    
    // Discord Module laden
    try {
      this._dispatcher = Webpack.getByKeys("dispatch", "subscribe");
      this._voiceStateStore = Webpack.getStore("VoiceStateStore");
      this._selectedChannelStore = Webpack.getStore("SelectedChannelStore");
      this._channelStore = Webpack.getStore("ChannelStore");
      this._userStore = Webpack.getStore("UserStore");
      
      // Voice-Modul für Verbindung
      this._voiceModule = Webpack.getByKeys("selectVoiceChannel");
      
      if (!this._voiceModule) {
        // Fallback
        this._voiceModule = Webpack.getModule(m => m?.selectVoiceChannel && typeof m.selectVoiceChannel === 'function');
      }
      
      // Event-Listener für Voice-Disconnect
      if (this._dispatcher) {
        this._handleVoiceStateUpdate = this.handleVoiceStateUpdate.bind(this);
        this._dispatcher.subscribe("VOICE_STATE_UPDATES", this._handleVoiceStateUpdate);
        this._dispatcher.subscribe("RTC_CONNECTION_STATE", this.handleRTCState.bind(this));
      }
      
      this.showToast("AutoReconnectVoice aktiviert", "success");
    } catch (err) {
      console.error("[AutoReconnectVoice] Fehler beim Initialisieren:", err);
      this.showToast("Fehler beim Starten - siehe Konsole", "error");
    }
  }

  stop() {
    this.retryCount = 0;
    this._isReconnecting = false;
    
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
    
    // Event-Listener entfernen
    if (this._dispatcher && this._handleVoiceStateUpdate) {
      this._dispatcher.unsubscribe("VOICE_STATE_UPDATES", this._handleVoiceStateUpdate);
      this._dispatcher.unsubscribe("RTC_CONNECTION_STATE", this.handleRTCState.bind(this));
    }
    
    this._lastVoiceState = null;
    this.showToast("AutoReconnectVoice deaktiviert", "info");
  }

  handleVoiceStateUpdate(event) {
    if (!event?.voiceStates) return;
    
    const currentUser = this._userStore?.getCurrentUser();
    if (!currentUser) return;
    
    const myVoiceState = event.voiceStates.find(vs => vs.userId === currentUser.id);
    
    if (myVoiceState) {
      // Speichere aktuellen Voice-State
      if (myVoiceState.channelId) {
        this._lastVoiceState = {
          channelId: myVoiceState.channelId,
          guildId: myVoiceState.guildId,
          timestamp: Date.now()
        };
        this.retryCount = 0;
        this._isReconnecting = false;
      } else if (this._lastVoiceState && !this._isReconnecting) {
        // User wurde disconnected
        this.handleDisconnect();
      }
    }
  }

  handleRTCState(event) {
    // RTC Verbindungsstatus überwachen
    if (event?.state === "DISCONNECTED" || event?.state === "RTC_DISCONNECTED") {
      if (this._lastVoiceState && !this._isReconnecting) {
        console.log("[AutoReconnectVoice] RTC Disconnect erkannt");
        this.handleDisconnect();
      }
    }
  }

  handleDisconnect() {
    if (!this.settings.autoReconnectOnDisconnect) return;
    if (!this._lastVoiceState) return;
    
    const channel = this._channelStore?.getChannel(this._lastVoiceState.channelId);
    if (!channel) return;
    
    // Prüfe ob DM oder Server
    const isDM = !channel.guild_id;
    
    if (isDM && !this.settings.reconnectDMCalls) return;
    if (!isDM && !this.settings.reconnectServerVC) return;
    
    this._isReconnecting = true;
    this.showToast("Verbindung verloren - versuche Reconnect...", "warning");
    this.attemptReconnect();
  }

  attemptReconnect() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
    }
    
    this._timeoutId = setTimeout(() => {
      if (this.retryCount >= this.settings.maxRetries) {
        this.showToast(`Max. Reconnect-Versuche (${this.settings.maxRetries}) erreicht`, "error");
        this._isReconnecting = false;
        this._lastVoiceState = null;
        return;
      }
      
      this.retryCount++;
      
      if (!this._lastVoiceState) {
        this._isReconnecting = false;
        return;
      }
      
      const channelId = this._lastVoiceState.channelId;
      const channel = this._channelStore?.getChannel(channelId);
      
      if (!channel) {
        this.showToast("Channel nicht mehr verfügbar", "error");
        this._isReconnecting = false;
        this._lastVoiceState = null;
        return;
      }
      
      console.log(`[AutoReconnectVoice] Reconnect-Versuch ${this.retryCount}/${this.settings.maxRetries}`);
      
      try {
        if (this._voiceModule?.selectVoiceChannel) {
          this._voiceModule.selectVoiceChannel(channelId);
          this.showToast(`Reconnect-Versuch ${this.retryCount}...`, "info");
        } else {
          // Alternative Methode
          const voiceActions = Webpack.getByKeys("handleVoiceConnect");
          if (voiceActions?.handleVoiceConnect) {
            voiceActions.handleVoiceConnect(channelId, null);
          }
        }
        
        // Prüfe nach kurzer Zeit ob Reconnect erfolgreich war
        setTimeout(() => {
          const currentChannel = this._selectedChannelStore?.getVoiceChannelId();
          if (currentChannel === channelId) {
            this.showToast("Reconnect erfolgreich!", "success");
            this._isReconnecting = false;
            this.retryCount = 0;
          } else if (this._isReconnecting) {
            // Erneut versuchen
            this.attemptReconnect();
          }
        }, 3000);
        
      } catch (err) {
        console.error("[AutoReconnectVoice] Reconnect-Fehler:", err);
        this.attemptReconnect();
      }
    }, this.settings.retryDelay);
  }

  showToast(message, type = "info") {
    if (!this.settings.showNotifications) return;
    BdApi.showToast(`[AutoReconnect] ${message}`, { type });
  }

  getSettingsPanel() {
    const panel = document.createElement("div");
    panel.style.padding = "10px";
    panel.style.color = "var(--text-normal)";
    
    const settings = [
      { key: "autoReconnectOnDisconnect", label: "Automatisch bei Disconnect verbinden", type: "switch" },
      { key: "reconnectServerVC", label: "Server Voice-Channels reconnecten", type: "switch" },
      { key: "reconnectDMCalls", label: "DM-Calls reconnecten", type: "switch" },
      { key: "showNotifications", label: "Benachrichtigungen anzeigen", type: "switch" },
      { key: "maxRetries", label: "Maximale Reconnect-Versuche", type: "number", min: 1, max: 100 },
      { key: "retryDelay", label: "Verzögerung zwischen Versuchen (ms)", type: "number", min: 1000, max: 30000 }
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
      
      if (setting.type === "switch") {
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.checked = this.settings[setting.key];
        toggle.style.cursor = "pointer";
        toggle.addEventListener("change", () => {
          this.settings[setting.key] = toggle.checked;
          this.saveSettings();
        });
        container.appendChild(toggle);
      } else if (setting.type === "number") {
        const input = document.createElement("input");
        input.type = "number";
        input.value = this.settings[setting.key];
        input.min = setting.min;
        input.max = setting.max;
        input.style.width = "80px";
        input.style.background = "var(--background-secondary)";
        input.style.border = "1px solid var(--background-tertiary)";
        input.style.color = "var(--text-normal)";
        input.style.padding = "5px";
        input.style.borderRadius = "4px";
        input.addEventListener("change", () => {
          this.settings[setting.key] = parseInt(input.value) || setting.min;
          this.saveSettings();
        });
        container.appendChild(input);
      }
      
      panel.appendChild(container);
    });
    
    return panel;
  }
};
