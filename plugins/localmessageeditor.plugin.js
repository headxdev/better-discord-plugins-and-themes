/**
 * @name LocalMessageEditor
 * @author HeadX
 * @authorId 808385710700494919
 * @description Ermöglicht das lokale Bearbeiten von Nachrichten anderer Nutzer (sieht aus wie offizielle Bearbeitung)
 * @version 1.0.0
 * @invite J6wTJJ5fp
 * @website https://github.com/headxdev/better-discord-plugins-and-themes
 * @source https://github.com/headxdev/better-discord-plugins-and-themes
 * @updateUrl https://raw.githubusercontent.com/headxdev/better-discord-plugins-and-themes/refs/heads/main/plugins/localmessageeditor.plugin.js
 */

module.exports = (() => {
    const config = {
        info: {
            name: "LocalMessageEditor",
            authors: [{
                name: "HeadX",
                discord_id: "0"
            }],
            version: "1.0.0",
            description: "Ermöglicht das lokale Bearbeiten von Nachrichten anderer Nutzer (sieht aus wie offizielle Bearbeitung)"
        },
        defaultConfig: [
            {
                type: "category",
                id: "general",
                name: "Allgemeine Einstellungen",
                collapsible: true,
                shown: true,
                settings: [
                    {
                        type: "switch",
                        id: "autoSave",
                        name: "Automatisches Speichern",
                        note: "Speichert Bearbeitungen automatisch während der Eingabe",
                        value: true
                    },
                    {
                        type: "switch",
                        id: "showEditedIndicator",
                        name: "'Bearbeitet'-Indikator anzeigen",
                        note: "Zeigt '(bearbeitet)' bei lokal bearbeiteten Nachrichten an",
                        value: true
                    },
                    {
                        type: "number",
                        id: "maxStoredEdits",
                        name: "Maximale Anzahl gespeicherter Bearbeitungen",
                        note: "Ältere Bearbeitungen werden automatisch gelöscht (0 = unbegrenzt)",
                        value: 1000,
                        min: 0,
                        max: 10000
                    }
                ]
            },
            {
                type: "category",
                id: "storage",
                name: "Gespeicherte Bearbeitungen",
                collapsible: true,
                shown: false,
                settings: [
                    {
                        type: "textbox",
                        id: "editedMessages",
                        name: "Bearbeitete Nachrichten (JSON)",
                        note: "Hier werden alle bearbeiteten Nachrichten gespeichert. Nicht manuell bearbeiten!",
                        value: "{}",
                        placeholder: "{}"
                    },
                    {
                        type: "button",
                        id: "clearAllEdits",
                        name: "Alle Bearbeitungen löschen",
                        note: "ACHTUNG: Dies löscht alle gespeicherten Bearbeitungen unwiderruflich!",
                        action: () => {
                            BdApi.showConfirmationModal("Alle Bearbeitungen löschen?", 
                                "Möchtest du wirklich alle gespeicherten Nachrichtenbearbeitungen löschen? Diese Aktion kann nicht rückgängig gemacht werden!", {
                                confirmText: "Löschen",
                                cancelText: "Abbrechen",
                                danger: true,
                                onConfirm: () => {
                                    const plugin = BdApi.Plugins.get("LocalMessageEditor");
                                    if (plugin && plugin.instance) {
                                        plugin.instance.clearAllEdits();
                                    }
                                }
                            });
                        }
                    },
                    {
                        type: "button",
                        id: "exportEdits",
                        name: "Bearbeitungen exportieren",
                        note: "Exportiert alle Bearbeitungen als JSON-Datei",
                        action: () => {
                            const plugin = BdApi.Plugins.get("LocalMessageEditor");
                            if (plugin && plugin.instance) {
                                plugin.instance.exportEdits();
                            }
                        }
                    },
                    {
                        type: "button",
                        id: "importEdits",
                        name: "Bearbeitungen importieren",
                        note: "Importiert Bearbeitungen aus einer JSON-Datei",
                        action: () => {
                            const plugin = BdApi.Plugins.get("LocalMessageEditor");
                            if (plugin && plugin.instance) {
                                plugin.instance.importEdits();
                            }
                        }
                    }
                ]
            }
        ]
    };

    return !global.ZeresPluginLibrary ? class {
        constructor() { this._config = config; }
        getName() { return config.info.name; }
        getAuthor() { return config.info.authors.map(a => a.name).join(", "); }
        getDescription() { return config.info.description; }
        getVersion() { return config.info.version; }
        load() {
            BdApi.showConfirmationModal("Library Missing", `Das ZeresPluginLibrary Plugin ist erforderlich für ${config.info.name}. Klicke auf Download um es automatisch zu installieren.`, {
                confirmText: "Download",
                cancelText: "Cancel",
                onConfirm: () => {
                    require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (error, response, body) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                    });
                }
            });
        }
        start() { }
        stop() { }
    } : (([Plugin, Api]) => {
        const plugin = (Plugin, Library) => {
            const { DiscordModules, WebpackModules, Patcher, ReactTools, Utilities } = Library;
            
            class LocalMessageEditor extends Plugin {
                constructor() {
                    super();
                    this.editedMessages = new Map(); // Speichert bearbeitete Nachrichten
                    this.editingStates = new Map(); // Tracks welche Nachrichten gerade bearbeitet werden
                    this.messageModule = null;
                    this.settings = BdApi.Data.load(this.getName(), "settings") || {};
                }

                onStart() {
                    this.loadEditedMessages();
                    this.findMessageModule();
                    this.patchMessageContent();
                    this.addContextMenuOption();
                    this.addStyles();
                }

                onStop() {
                    Patcher.unpatchAll();
                    this.removeStyles();
                    this.saveEditedMessages();
                }

                getSettingsPanel() {
                    return this.buildSettingsPanel().getElement();
                }

                onSettingChange(category, setting, value) {
                    if (setting === "editedMessages") {
                        try {
                            const parsed = JSON.parse(value);
                            this.editedMessages = new Map(Object.entries(parsed));
                            this.forceUpdateAllMessages();
                        } catch (error) {
                            BdApi.showToast("Ungültiges JSON-Format!", {type: "error"});
                        }
                    } else if (setting === "maxStoredEdits") {
                        this.cleanupOldEdits();
                    }
                }

                clearAllEdits() {
                    this.editedMessages.clear();
                    this.saveEditedMessages();
                    this.forceUpdateAllMessages();
                    BdApi.showToast("Alle Bearbeitungen wurden gelöscht!", {type: "success"});
                }

                exportEdits() {
                    const data = Object.fromEntries(this.editedMessages);
                    const jsonString = JSON.stringify(data, null, 2);
                    const blob = new Blob([jsonString], {type: "application/json"});
                    const url = URL.createObjectURL(blob);
                    
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `message-edits-${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    BdApi.showToast("Bearbeitungen erfolgreich exportiert!", {type: "success"});
                }

                importEdits() {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".json";
                    input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            try {
                                const data = JSON.parse(event.target.result);
                                const imported = new Map(Object.entries(data));
                                
                                // Merge with existing edits
                                for (const [key, value] of imported) {
                                    this.editedMessages.set(key, value);
                                }
                                
                                this.saveEditedMessages();
                                this.forceUpdateAllMessages();
                                BdApi.showToast(`${imported.size} Bearbeitungen erfolgreich importiert!`, {type: "success"});
                            } catch (error) {
                                BdApi.showToast("Fehler beim Importieren: Ungültige Datei!", {type: "error"});
                            }
                        };
                        reader.readAsText(file);
                    };
                    input.click();
                }

                cleanupOldEdits() {
                    const maxEdits = this.settings.maxStoredEdits || 1000;
                    if (maxEdits === 0) return; // Unbegrenzt
                    
                    if (this.editedMessages.size > maxEdits) {
                        const entries = Array.from(this.editedMessages.entries());
                        const toKeep = entries.slice(-maxEdits);
                        this.editedMessages = new Map(toKeep);
                        this.saveEditedMessages();
                    }
                }

                forceUpdateAllMessages() {
                    // Force update all visible messages
                    const messagesContainer = document.querySelector('[data-list-id="chat-messages"]');
                    if (messagesContainer) {
                        const reactInstance = ReactTools.getReactInstance(messagesContainer);
                        if (reactInstance) {
                            this.forceUpdateReactComponent(reactInstance);
                        }
                    }
                }

                findMessageModule() {
                    // Finde das Message-Modul für Discord's native "edited" styling
                    this.messageModule = WebpackModules.getModule(m => m?.default?.displayName?.includes?.("Message"));
                }

                loadEditedMessages() {
                    try {
                        // Load from config
                        const configValue = this.settings.editedMessages;
                        if (configValue && configValue !== "{}") {
                            const parsed = JSON.parse(configValue);
                            this.editedMessages = new Map(Object.entries(parsed));
                        }
                        
                        // Fallback: Load from old storage location
                        const oldSaved = BdApi.Data.load(this.getName(), "editedMessages");
                        if (oldSaved && this.editedMessages.size === 0) {
                            this.editedMessages = new Map(Object.entries(oldSaved));
                            this.saveEditedMessages(); // Migrate to config
                            BdApi.Data.delete(this.getName(), "editedMessages"); // Clean up old storage
                        }
                    } catch (error) {
                        console.error("Fehler beim Laden der bearbeiteten Nachrichten:", error);
                        this.editedMessages = new Map();
                    }
                }

                saveEditedMessages() {
                    try {
                        const toSave = Object.fromEntries(this.editedMessages);
                        
                        // Save to config
                        this.settings.editedMessages = JSON.stringify(toSave);
                        BdApi.Data.save(this.getName(), "settings", this.settings);
                        
                        // Update the settings panel if it's open
                        this.updateSettingsPanel();
                        
                        // Cleanup old edits if necessary
                        this.cleanupOldEdits();
                    } catch (error) {
                        console.error("Fehler beim Speichern der bearbeiteten Nachrichten:", error);
                    }
                }

                updateSettingsPanel() {
                    // Update the textbox in settings panel with current data
                    const settingsPanel = document.querySelector(`#${this.getName()}-settings`);
                    if (settingsPanel) {
                        const textbox = settingsPanel.querySelector('textarea[placeholder="{}"]');
                        if (textbox) {
                            textbox.value = this.settings.editedMessages || "{}";
                        }
                    }
                }

                addStyles() {
                    const css = `
                        .local-edit-input {
                            background: var(--input-background);
                            border: 1px solid var(--input-border);
                            border-radius: 3px;
                            color: var(--text-normal);
                            padding: 8px;
                            width: 100%;
                            font-family: inherit;
                            font-size: inherit;
                            resize: vertical;
                            min-height: 44px;
                        }
                        .local-edit-buttons {
                            display: flex;
                            gap: 8px;
                            margin-top: 8px;
                        }
                        .local-edit-btn {
                            padding: 4px 12px;
                            border-radius: 3px;
                            border: none;
                            font-size: 12px;
                            font-weight: 500;
                            cursor: pointer;
                        }
                        .local-edit-save {
                            background: #5865f2;
                            color: white;
                        }
                        .local-edit-cancel {
                            background: transparent;
                            color: var(--text-normal);
                            border: 1px solid var(--background-modifier-accent);
                        }
                        .local-edit-reset {
                            background: #ed4245;
                            color: white;
                        }
                        /* Mimic Discord's native edited message styling */
                        .fake-edited-message .timestamp_f9f2ca::after {
                            content: " (bearbeitet)";
                            font-size: 0.75rem;
                            color: var(--text-muted);
                            font-style: normal;
                        }
                        .fake-edited-tooltip {
                            position: relative;
                            cursor: pointer;
                        }
                    `;
                    BdApi.DOM.addStyle(this.getName(), css);
                }

                removeStyles() {
                    BdApi.DOM.removeStyle(this.getName());
                }

                patchMessageContent() {
                    // Patch the main message component
                    const MessageContent = WebpackModules.getModule(m => m?.type?.toString?.()?.includes?.("messageContent"));
                    if (MessageContent) {
                        Patcher.after(MessageContent, "type", this.patchMessageContentHandler.bind(this));
                    }

                    // Also patch the main Message component to add the edited indicator
                    const Message = WebpackModules.getModule(m => m?.default?.displayName === "Message");
                    if (Message) {
                        Patcher.after(Message, "default", this.patchMessageHandler.bind(this));
                    }

                    // Patch MessageTimestamp to add "edited" indicator
                    const MessageTimestamp = WebpackModules.getModule(m => m?.default?.toString?.()?.includes?.("timestamp"));
                    if (MessageTimestamp) {
                        Patcher.after(MessageTimestamp, "default", this.patchTimestampHandler.bind(this));
                    }
                }

                patchMessageHandler(thisObject, args, returnValue) {
                    const [props] = args;
                    const messageId = props?.message?.id;
                    
                    if (!messageId || !returnValue) return returnValue;

                    // Add fake edited class if message was locally edited
                    if (this.editedMessages.has(messageId) && returnValue.props) {
                        const originalClassName = returnValue.props.className || "";
                        returnValue.props.className = `${originalClassName} fake-edited-message`;
                    }

                    return returnValue;
                }

                patchTimestampHandler(thisObject, args, returnValue) {
                    const [props] = args;
                    
                    if (!props || !returnValue) return returnValue;

                    // Check settings if indicator should be shown
                    if (!this.settings.showEditedIndicator) return returnValue;

                    // Check if this timestamp belongs to a locally edited message
                    const messageId = this.findMessageIdFromTimestamp(props);
                    
                    if (messageId && this.editedMessages.has(messageId)) {
                        // Clone the return value and add edited indicator
                        const cloned = { ...returnValue };
                        if (cloned.props) {
                            cloned.props = { ...cloned.props };
                            cloned.props.className = (cloned.props.className || "") + " fake-edited-tooltip";
                            
                            // Add edited text
                            const originalChildren = cloned.props.children;
                            cloned.props.children = [
                                originalChildren,
                                BdApi.React.createElement("span", {
                                    style: {
                                        fontSize: "0.75rem",
                                        color: "var(--text-muted)",
                                        marginLeft: "4px"
                                    }
                                }, " (bearbeitet)")
                            ];
                        }
                        return cloned;
                    }

                    return returnValue;
                }

                findMessageIdFromTimestamp(props) {
                    // This is a bit tricky - we need to find the message ID from timestamp props
                    // We'll use the timestamp value and current messages to match
                    if (props.timestamp) {
                        // Try to find the message by timestamp in current channel
                        const messages = DiscordModules.MessageStore.getMessages(DiscordModules.SelectedChannelStore.getChannelId());
                        if (messages && messages._array) {
                            const message = messages._array.find(m => m.timestamp === props.timestamp);
                            return message?.id;
                        }
                    }
                    return null;
                }

                patchMessageContentHandler(thisObject, args, returnValue) {
                    const [props] = args;
                    const messageId = props?.message?.id;
                    
                    if (!messageId) return returnValue;

                    // Check if this message is being edited
                    if (this.editingStates.get(messageId)) {
                        return this.renderEditInterface(props, returnValue);
                    }

                    // Check if this message has been locally edited
                    const editedContent = this.editedMessages.get(messageId);
                    if (editedContent) {
                        return this.renderEditedContent(props, returnValue, editedContent);
                    }

                    return returnValue;
                }

                renderEditInterface(props, originalReturn) {
                    const messageId = props.message.id;
                    const currentContent = this.editedMessages.get(messageId) || props.message.content;

                    const editInterface = BdApi.React.createElement("div", {
                        className: "local-edit-interface"
                    }, [
                        BdApi.React.createElement("textarea", {
                            key: "textarea",
                            className: "local-edit-input",
                            defaultValue: currentContent,
                            id: `edit-${messageId}`,
                            autoFocus: true,
                            onKeyDown: (e) => {
                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                    this.saveEdit(messageId);
                                } else if (e.key === "Escape") {
                                    this.cancelEdit(messageId);
                                }
                            }
                        }),
                        BdApi.React.createElement("div", {
                            key: "buttons",
                            className: "local-edit-buttons"
                        }, [
                            BdApi.React.createElement("button", {
                                key: "save",
                                className: "local-edit-btn local-edit-save",
                                onClick: () => this.saveEdit(messageId)
                            }, "Speichern"),
                            BdApi.React.createElement("button", {
                                key: "cancel",
                                className: "local-edit-btn local-edit-cancel",
                                onClick: () => this.cancelEdit(messageId)
                            }, "Abbrechen"),
                            this.editedMessages.has(messageId) && BdApi.React.createElement("button", {
                                key: "reset",
                                className: "local-edit-btn local-edit-reset",
                                onClick: () => this.resetEdit(messageId)
                            }, "Zurücksetzen")
                        ])
                    ]);

                    return editInterface;
                }

                renderEditedContent(props, originalReturn, editedContent) {
                    // Create new props with edited content
                    const newMessage = { ...props.message, content: editedContent };
                    const newProps = { ...props, message: newMessage };
                    
                    // Render the message content with the new content
                    // This will make it look like the original author edited their message
                    const MessageContent = WebpackModules.getModule(m => m?.type?.toString?.()?.includes?.("messageContent"));
                    if (MessageContent && MessageContent.type) {
                        return BdApi.React.createElement(MessageContent.type, newProps);
                    }
                    
                    // Fallback: just replace the text content
                    if (typeof originalReturn === 'string') {
                        return editedContent;
                    }
                    
                    return this.replaceTextContent(originalReturn, props.message.content, editedContent);
                }

                replaceTextContent(element, originalText, newText) {
                    if (!element) return element;
                    
                    if (typeof element === 'string') {
                        return element === originalText ? newText : element;
                    }
                    
                    if (Array.isArray(element)) {
                        return element.map(child => this.replaceTextContent(child, originalText, newText));
                    }
                    
                    if (element.props) {
                        const newElement = { ...element };
                        newElement.props = { ...element.props };
                        
                        if (element.props.children) {
                            newElement.props.children = this.replaceTextContent(element.props.children, originalText, newText);
                        }
                        
                        // Replace any direct text props
                        Object.keys(element.props).forEach(key => {
                            if (element.props[key] === originalText) {
                                newElement.props[key] = newText;
                            }
                        });
                        
                        return newElement;
                    }
                    
                    return element;
                }

                addContextMenuOption() {
                    const MessageContextMenu = WebpackModules.getModule(m => m?.default?.displayName === "MessageContextMenu");
                    if (!MessageContextMenu) return;

                    Patcher.after(MessageContextMenu, "default", (thisObject, args, returnValue) => {
                        const [props] = args;
                        const message = props?.message;
                        
                        if (!message || !message.id) return returnValue;

                        const menuItems = returnValue?.props?.children;
                        if (!Array.isArray(menuItems)) return returnValue;

                        const currentUserId = DiscordModules.UserStore.getCurrentUser()?.id;
                        const isOwnMessage = message.author.id === currentUserId;

                        // Find the position to insert - look for existing "Bearbeiten" option
                        let insertIndex = -1;
                        let hasEditOption = false;
                        
                        for (let i = 0; i < menuItems.length; i++) {
                            const item = menuItems[i];
                            if (item && item.props && item.props.id === "edit") {
                                hasEditOption = true;
                                insertIndex = i + 1;
                                break;
                            }
                        }

                        // If no edit option found, insert near the top
                        if (insertIndex === -1) {
                            insertIndex = 1;
                        }

                        // For other users' messages, add our local edit option
                        if (!isOwnMessage) {
                            const localEditOption = BdApi.React.createElement(BdApi.findModuleByProps("MenuItem").MenuItem, {
                                id: "local-edit-message",
                                label: this.editedMessages.has(message.id) ? "Lokale Bearbeitung ändern" : "Lokal bearbeiten",
                                action: () => this.startEdit(message.id),
                                icon: () => BdApi.React.createElement("svg", {
                                    width: "18",
                                    height: "18",
                                    viewBox: "0 0 24 24"
                                }, BdApi.React.createElement("path", {
                                    fill: "currentColor",
                                    d: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                                }))
                            });

                            menuItems.splice(insertIndex, 0, localEditOption);
                            insertIndex++;

                            // Add reset option if message was edited
                            if (this.editedMessages.has(message.id)) {
                                const resetOption = BdApi.React.createElement(BdApi.findModuleByProps("MenuItem").MenuItem, {
                                    id: "reset-local-edit",
                                    label: "Lokale Bearbeitung entfernen",
                                    action: () => this.resetEdit(message.id),
                                    color: "danger",
                                    icon: () => BdApi.React.createElement("svg", {
                                        width: "18",
                                        height: "18",
                                        viewBox: "0 0 24 24"
                                    }, BdApi.React.createElement("path", {
                                        fill: "currentColor",
                                        d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                                    }))
                                });

                                menuItems.splice(insertIndex, 0, resetOption);
                            }
                        } else {
                            // For own messages, modify the existing edit option to also handle local edits
                            // This allows editing of your own messages that were locally edited before
                            for (let i = 0; i < menuItems.length; i++) {
                                const item = menuItems[i];
                                if (item && item.props && item.props.id === "edit") {
                                    const originalAction = item.props.action;
                                    const newAction = () => {
                                        // If this message has local edits, start local editing instead
                                        if (this.editedMessages.has(message.id)) {
                                            this.startEdit(message.id);
                                        } else {
                                            // Otherwise use Discord's native edit
                                            originalAction();
                                        }
                                    };
                                    
                                    menuItems[i] = BdApi.React.cloneElement(item, {
                                        ...item.props,
                                        action: newAction
                                    });
                                    break;
                                }
                            }

                            // Add reset option for own messages if locally edited
                            if (this.editedMessages.has(message.id)) {
                                const resetOption = BdApi.React.createElement(BdApi.findModuleByProps("MenuItem").MenuItem, {
                                    id: "reset-local-edit-own",
                                    label: "Lokale Bearbeitung entfernen",
                                    action: () => this.resetEdit(message.id),
                                    color: "danger"
                                });

                                menuItems.splice(insertIndex, 0, resetOption);
                            }
                        }

                        return returnValue;
                    });
                }

                startEdit(messageId) {
                    this.editingStates.set(messageId, true);
                    this.forceUpdateMessage(messageId);
                }

                saveEdit(messageId) {
                    const textarea = document.getElementById(`edit-${messageId}`);
                    if (textarea) {
                        const newContent = textarea.value.trim();
                        if (newContent) {
                            this.editedMessages.set(messageId, newContent);
                        } else {
                            this.editedMessages.delete(messageId);
                        }
                        this.saveEditedMessages();
                    }
                    
                    this.editingStates.delete(messageId);
                    this.forceUpdateMessage(messageId);
                }

                cancelEdit(messageId) {
                    this.editingStates.delete(messageId);
                    this.forceUpdateMessage(messageId);
                }

                resetEdit(messageId) {
                    this.editedMessages.delete(messageId);
                    this.editingStates.delete(messageId);
                    this.saveEditedMessages();
                    this.forceUpdateMessage(messageId);
                }

                forceUpdateMessage(messageId) {
                    // Force re-render of the entire message
                    const messageElements = document.querySelectorAll(`[id*="${messageId}"]`);
                    messageElements.forEach(element => {
                        const reactInstance = ReactTools.getReactInstance(element);
                        if (reactInstance) {
                            this.forceUpdateReactComponent(reactInstance);
                        }
                    });

                    // Also force update the message list
                    const messagesContainer = document.querySelector('[data-list-id="chat-messages"]');
                    if (messagesContainer) {
                        const reactInstance = ReactTools.getReactInstance(messagesContainer);
                        if (reactInstance) {
                            this.forceUpdateReactComponent(reactInstance);
                        }
                    }
                }

                forceUpdateReactComponent(reactInstance) {
                    let current = reactInstance;
                    while (current) {
                        if (current.stateNode && current.stateNode.forceUpdate) {
                            current.stateNode.forceUpdate();
                            break;
                        }
                        current = current.return;
                    }
                }
            }

            return LocalMessageEditor;
        };
        
        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();