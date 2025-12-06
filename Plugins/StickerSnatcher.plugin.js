/**
 * @name StickerSnatcher
 * @description Ermöglicht einfaches Speichern und Kopieren von Stickern. Ohne externe Abhängigkeiten.
 * @version 2.0.0
 * @author ImTheSquid (verbessert)
 * @authorId 262055523896131584
 * @website https://github.com/ImTheSquid/StickerSnatcher
 * @source https://raw.githubusercontent.com/ImTheSquid/StickerSnatcher/master/StickerSnatcher.plugin.js
 */

const { Webpack, ContextMenu, Patcher, Data, DOM } = BdApi;

module.exports = class StickerSnatcher {
    constructor() {
        this.name = "StickerSnatcher";
        this.unpatch = null;
        this.canvas = null;
        this.getStickerById = null;
        this.copyImage = null;
        this.settings = {
            showCopyOption: true,
            showSaveOption: true,
            convertWebpToPng: true
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
        
        // Canvas für Bildkonvertierung erstellen
        this.canvas = document.createElement("canvas");
        
        // Module laden
        try {
            const stickerModule = Webpack.getModule(m => m?.getStickerById);
            this.getStickerById = stickerModule?.getStickerById;
            
            const clipboardModule = Webpack.getModule(m => m?.copyImage);
            this.copyImage = clipboardModule?.copyImage;
        } catch (err) {
            console.error("[StickerSnatcher] Fehler beim Laden der Module:", err);
        }
        
        // CSS hinzufügen
        DOM.addStyle(this.name, `
            .sticker-snatcher-item {
                color: var(--interactive-normal);
            }
            .sticker-snatcher-item:hover {
                color: var(--interactive-hover);
                background: var(--background-modifier-hover);
            }
        `);
        
        // Context Menu patchen
        this.unpatch = ContextMenu.patch("message", (tree, props) => {
            this.handleContextMenu(tree, props);
        });
        
        BdApi.showToast("StickerSnatcher aktiviert", { type: "success" });
    }

    handleContextMenu(tree, props) {
        try {
            // Prüfen ob Nachricht Sticker enthält
            if (!props?.message?.stickerItems?.length) return;
            
            const sticker = props.message.stickerItems[0];
            
            // Prüfen ob es ein Guild-Sticker ist (nicht Nitro-exklusiv)
            if (this.getStickerById) {
                const stickerData = this.getStickerById(sticker.id);
                // Type 1 = Standard, Type 2 = Guild
                if (stickerData?.type === 1) return; // Nitro-Sticker überspringen
            }
            
            // Sticker-URL erstellen
            const format = sticker.format_type === 1 ? "png" : 
                          sticker.format_type === 2 ? "png" : 
                          sticker.format_type === 3 ? "json" : // Lottie
                          sticker.format_type === 4 ? "gif" : "webp";
            
            // Lottie-Sticker können nicht heruntergeladen werden
            if (format === "json") return;
            
            const url = `https://media.discordapp.net/stickers/${sticker.id}.${format}?size=320`;
            
            // Menu-Items erstellen
            const menuItems = [];
            
            if (this.settings.showCopyOption) {
                menuItems.push(
                    ContextMenu.buildItem({ type: "separator" }),
                    ContextMenu.buildItem({
                        label: "Sticker kopieren",
                        className: "sticker-snatcher-item",
                        action: () => this.copySticker(url, sticker.name)
                    })
                );
            }
            
            if (this.settings.showSaveOption) {
                menuItems.push(
                    ContextMenu.buildItem({
                        label: "Sticker speichern",
                        className: "sticker-snatcher-item",
                        action: () => this.saveSticker(url, sticker.name)
                    })
                );
            }
            
            if (menuItems.length > 0) {
                menuItems.push(ContextMenu.buildItem({ type: "separator" }));
            }
            
            // Items zum Menu hinzufügen
            const children = tree?.props?.children;
            if (Array.isArray(children)) {
                // Finde die richtige Stelle zum Einfügen
                const targetGroup = children.find(c => c?.props?.children && Array.isArray(c.props.children));
                if (targetGroup?.props?.children) {
                    targetGroup.props.children.push(...menuItems);
                }
            }
        } catch (err) {
            console.error("[StickerSnatcher] Fehler im Context Menu:", err);
        }
    }

    async copySticker(url, name) {
        try {
            BdApi.showToast("Kopiere Sticker...", { type: "info" });
            
            // Bild laden
            const response = await fetch(url);
            const blob = await response.blob();
            
            // Prüfen ob Konvertierung nötig ist
            if (this.settings.convertWebpToPng && url.includes(".webp")) {
                const dataUrl = await this.convertToPng(blob);
                const base64 = dataUrl.split(",")[1];
                const buffer = this.base64ToBuffer(base64);
                
                if (DiscordNative?.clipboard?.copyImage) {
                    DiscordNative.clipboard.copyImage(new Uint8Array(buffer), `${name}.png`);
                    BdApi.showToast("Sticker kopiert!", { type: "success" });
                } else {
                    // Fallback: In Zwischenablage als Text
                    navigator.clipboard.writeText(url);
                    BdApi.showToast("URL in Zwischenablage kopiert", { type: "info" });
                }
            } else if (this.copyImage) {
                this.copyImage(url);
                BdApi.showToast("Sticker kopiert!", { type: "success" });
            } else {
                // Fallback
                navigator.clipboard.writeText(url);
                BdApi.showToast("URL in Zwischenablage kopiert", { type: "info" });
            }
        } catch (err) {
            console.error("[StickerSnatcher] Fehler beim Kopieren:", err);
            BdApi.showToast("Fehler beim Kopieren", { type: "error" });
        }
    }

    async saveSticker(url, name) {
        try {
            BdApi.showToast("Lade Sticker...", { type: "info" });
            
            // Bild laden
            const response = await fetch(url);
            const blob = await response.blob();
            let buffer;
            let filename = `${name || 'sticker'}.png`;
            
            // Konvertieren falls nötig
            if (this.settings.convertWebpToPng && (url.includes(".webp") || blob.type === "image/webp")) {
                const dataUrl = await this.convertToPng(blob);
                const base64 = dataUrl.split(",")[1];
                buffer = this.base64ToBuffer(base64);
            } else {
                buffer = await blob.arrayBuffer();
                // Dateiendung anpassen
                if (url.includes(".gif")) filename = `${name || 'sticker'}.gif`;
            }
            
            // Speichern
            if (DiscordNative?.fileManager?.saveWithDialog) {
                DiscordNative.fileManager.saveWithDialog(new Uint8Array(buffer), filename);
                BdApi.showToast("Speicherdialog geöffnet", { type: "success" });
            } else {
                // Fallback: Download via Link
                const downloadUrl = URL.createObjectURL(new Blob([buffer]));
                const link = document.createElement("a");
                link.href = downloadUrl;
                link.download = filename;
                link.click();
                URL.revokeObjectURL(downloadUrl);
                BdApi.showToast("Download gestartet", { type: "success" });
            }
        } catch (err) {
            console.error("[StickerSnatcher] Fehler beim Speichern:", err);
            BdApi.showToast("Fehler beim Speichern", { type: "error" });
        }
    }

    async convertToPng(blob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.canvas.width = img.width;
                this.canvas.height = img.height;
                const ctx = this.canvas.getContext("2d");
                ctx.clearRect(0, 0, img.width, img.height);
                ctx.drawImage(img, 0, 0);
                resolve(this.canvas.toDataURL("image/png"));
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
        });
    }

    base64ToBuffer(base64) {
        const binary = atob(base64);
        const buffer = new ArrayBuffer(binary.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < binary.length; i++) {
            view[i] = binary.charCodeAt(i);
        }
        return buffer;
    }

    stop() {
        if (this.unpatch) {
            this.unpatch();
            this.unpatch = null;
        }
        
        DOM.removeStyle(this.name);
        
        if (this.canvas) {
            this.canvas = null;
        }
        
        BdApi.showToast("StickerSnatcher deaktiviert", { type: "info" });
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.padding = "10px";
        panel.style.color = "var(--text-normal)";

        const title = document.createElement("h3");
        title.textContent = "Sticker Snatcher Einstellungen";
        title.style.marginBottom = "15px";
        panel.appendChild(title);

        const settings = [
            { key: "showCopyOption", label: "\"Sticker kopieren\" anzeigen" },
            { key: "showSaveOption", label: "\"Sticker speichern\" anzeigen" },
            { key: "convertWebpToPng", label: "WebP zu PNG konvertieren" }
        ];

        settings.forEach(setting => {
            const container = document.createElement("div");
            container.style.marginBottom = "12px";
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

        // Hinweis
        const hint = document.createElement("p");
        hint.style.marginTop = "20px";
        hint.style.fontSize = "12px";
        hint.style.color = "var(--text-muted)";
        hint.textContent = "Rechtsklick auf eine Nachricht mit Sticker um die Optionen zu sehen. Nitro-exklusive Sticker werden nicht angezeigt.";
        panel.appendChild(hint);

        return panel;
    }
};