/**
 * @name GalaxyBackground
 * @author HeadX
 * @authorId 808385710700494919
 * @description Fügt ein atemberaubendes animiertes Sonnensystem mit Nebel-Effekten als Hintergrund hinzu. Optimiert für beste Performance und Plugin-Kompatibilität.
 * @version 2.1.0
 * @invite J6wTJJ5fp
 * @website https://github.com/headxdev/better-discord-plugins-and-themes
 * @source https://github.com/headxdev/better-discord-plugins-and-themes
 * @updateUrl https://raw.githubusercontent.com/headxdev/better-discord-plugins-and-themes/refs/heads/main/plugins/galaxyplugin.plugin.js
 */

const { Data, UI } = BdApi;
const threeJsCdn = "https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.min.js";

module.exports = class GalaxyBackground {
    constructor() {
        this.name = "GalaxyBackground";
        this.defaultConfig = {
            starCount: 1500,
            nebulaParticles: 500,
            cameraSpeed: 0.00008,
            sunGlowIntensity: 0.45,
            enableNebula: true,
            enableOrbitRings: true,
            backgroundColor: 0x050510,
            performanceMode: false,
            transparencyLevel: 0.5
        };
        this.config = { ...this.defaultConfig };
        this._animationFrame = null;
        this._renderer = null;
        this._resizeHandler = null;
        this._isInitialized = false;
    }

    loadSettings() {
        const saved = Data.load(this.name, "config");
        this.config = saved ? { ...this.defaultConfig, ...saved } : { ...this.defaultConfig };
    }

    saveSettings() {
        Data.save(this.name, "config", this.config);
    }

    start() {
        this.loadSettings();
        
        // Canvas einfügen
        if (document.getElementById("galaxy-bg")) {
            console.log("[GalaxyBackground] Canvas existiert bereits");
            return;
        }
        
        const canvas = document.createElement("canvas");
        canvas.id = "galaxy-bg";
        Object.assign(canvas.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100vw",
            height: "100vh",
            zIndex: "0",
            pointerEvents: "none",
            transition: "opacity 0.5s"
        });
        document.body.prepend(canvas);

        // Markiere Body als Galaxy aktiv für Theme-Kompatibilität
        document.body.classList.add("galaxy-active");

        // Discord-UI transparent machen
        document.body.style.background = "transparent";
        const appMount = document.getElementById("app-mount");
        if (appMount) appMount.style.background = "transparent";
        
        // Zusätzliche Transparenz für bessere Plugin-Kompatibilität
        this.applyTransparencyFixes();

        // Three.js laden und Szene starten
        if (!window.THREE) {
            const script = document.createElement("script");
            script.src = threeJsCdn;
            script.onload = () => {
                this.initGalaxy(canvas);
                this._isInitialized = true;
            };
            script.onerror = () => {
                console.error("[GalaxyBackground] Three.js konnte nicht geladen werden");
                BdApi.showToast("GalaxyBackground: Three.js Fehler", { type: "error" });
            };
            document.head.appendChild(script);
        } else {
            this.initGalaxy(canvas);
            this._isInitialized = true;
        }
        
        BdApi.showToast("GalaxyBackground aktiviert", { type: "success" });
    }
    
    applyTransparencyFixes() {
        // Entferne altes Style-Element falls vorhanden
        const existingStyle = document.getElementById("galaxy-plugin-compat");
        if (existingStyle) existingStyle.remove();
        
        const style = document.createElement("style");
        style.id = "galaxy-plugin-compat";
        const alpha = this.config.transparencyLevel;
        
        style.textContent = `
            /* ========== GALAXY PLUGIN ULTRA-TRANSPARENZ ========== */
            
            /* Basis-Transparenz */
            .app-1q1i1E, .bg-h5JY_x, .container-1D34oG, .base-3dtUhz,
            .app-2CXKsg, .app-3xd6d0, .layers-OrUESM, .layer-86YKbF {
                background: transparent !important;
            }
            
            /* Hauptbereiche mit Glaseffekt - KEIN BLUR */
            .sidebar-1tnWFu, .sidebar-2K8pFh {
                background: rgba(10, 12, 25, 0.92) !important;
                backdrop-filter: none !important;
            }
            
            .chat-2ZfjoI, .chat-3bRxxu, .chatContent-a9vAAp {
                background: rgba(10, 12, 25, 0.90) !important;
            }
            
            .container-1NXEtd, .membersWrap-3NUR2t, .members-1998pB {
                background: rgba(10, 12, 25, 0.92) !important;
                backdrop-filter: none !important;
            }
            
            /* Server-Liste */
            .guilds-2JjMmN, .guilds-1SWlCJ, .wrapper-1_HaEi {
                background: rgba(8, 10, 20, 0.95) !important;
            }
            
            /* SpotifyControls Kompatibilität - KEIN BLUR */
            .spotify-controls-container, [class*="spotify"] {
                background: rgba(0, 0, 0, 0.90) !important;
                backdrop-filter: none !important;
                border-radius: 8px !important;
            }
            
            /* MessageLoggerV2 Kompatibilität - KEIN BLUR */
            .messagelogger-deleted {
                background: rgba(237, 66, 69, 0.3) !important;
                backdrop-filter: none !important;
                border-left: 3px solid #ed4245 !important;
            }
            
            .messagelogger-edited {
                background: rgba(250, 166, 26, 0.3) !important;
                backdrop-filter: none !important;
            }
            
            /* VoiceActivity & VoiceUsers - KEIN BLUR */
            .voiceUsers, .voice-activity-container, [class*="voiceUser"] {
                background: rgba(0, 0, 0, 0.85) !important;
                backdrop-filter: none !important;
            }
            
            /* ServerFolders & BetterFolders - KEIN BLUR */
            [class*="foldercontent"], [class*="folderContent"], 
            [class*="_serverfolders"], [class*="betterFolders"] {
                background: rgba(10, 12, 25, 0.92) !important;
                backdrop-filter: none !important;
            }
            
            /* User Panel - KEIN BLUR */
            .panels-3wFtMD, .panels-j1Uci_, .container-YkUktl {
                background: rgba(8, 10, 20, 0.95) !important;
                backdrop-filter: none !important;
            }
            
            /* Nachrichten mit besserem Kontrast */
            .message-2qnXI6, .messageContent-2qWWxC,
            .markup-eYLPri, .contents-2MsGLg {
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5) !important;
            }
            
            /* Eingabefeld - KEIN BLUR */
            .scrollableContainer-2NUZem, .channelTextArea-1FufC0 {
                background: rgba(15, 18, 35, 0.92) !important;
                backdrop-filter: none !important;
            }
            
            /* Modals & Popups - KEIN BLUR */
            .modal-3Hrb0S, .root-g14mjS, .layer-1Ixpg3 {
                backdrop-filter: none !important;
            }
            
            /* Context Menus - KEIN BLUR */
            .menu-1QACrS, .menu-2TXYjN {
                background: rgba(15, 18, 35, 0.98) !important;
                backdrop-filter: none !important;
            }
            
            /* Autocomplete & Search - KEIN BLUR */
            .autocomplete-3NRXG8, .resultsWrapper-2mV4GN {
                background: rgba(15, 18, 35, 0.98) !important;
                backdrop-filter: none !important;
            }
            
            /* Tooltips - KEIN BLUR */
            .tooltip-14MtrL {
                background: rgba(15, 18, 35, 0.98) !important;
                backdrop-filter: none !important;
            }
            
            /* BetterFolders / ServerFolders Kompatibilität */
            [class*="folderIconWrapper"], [class*="expandedFolderBackground"] {
                background: rgba(10, 12, 25, 0.90) !important;
            }
            
            /* PingNotification Kompatibilität - KEIN BLUR */
            .ping-notification-container, [class*="notification"] {
                backdrop-filter: none !important;
            }
            
            /* PasscodeLock Kompatibilität - KEIN BLUR */
            .passcode-lock-overlay {
                backdrop-filter: none !important;
                background: rgba(0, 0, 0, 0.95) !important;
            }
            
            /* VoiceActivity Kompatibilität - KEIN BLUR */
            [class*="voiceActivity"] {
                background: rgba(10, 12, 25, 0.90) !important;
                backdrop-filter: none !important;
            }
            
            /* Performance-Optimierungen */
            .galaxy-active * {
                will-change: auto;
            }
            
            /* Scrollbars anpassen */
            ::-webkit-scrollbar-track {
                background: rgba(10, 12, 25, 0.3) !important;
            }
            
            ::-webkit-scrollbar-thumb {
                background: rgba(100, 100, 150, 0.5) !important;
            }
        `;
        document.head.appendChild(style);
    }

    stop() {
        // Animation stoppen
        if (this._animationFrame) {
            cancelAnimationFrame(this._animationFrame);
            this._animationFrame = null;
        }
        
        // Resize-Handler entfernen
        if (this._resizeHandler) {
            window.removeEventListener("resize", this._resizeHandler);
            this._resizeHandler = null;
        }
        
        // Renderer aufräumen
        if (this._renderer) {
            this._renderer.dispose();
            this._renderer = null;
        }
        
        // Canvas entfernen
        const canvas = document.getElementById("galaxy-bg");
        if (canvas) canvas.remove();
        
        // Klassen entfernen
        document.body.classList.remove("galaxy-active");
        
        // Styles entfernen
        const compatStyle = document.getElementById("galaxy-plugin-compat");
        if (compatStyle) compatStyle.remove();
        
        // Hintergrund zurücksetzen
        document.body.style.background = "";
        const appMount = document.getElementById("app-mount");
        if (appMount) appMount.style.background = "";
        
        this._isInitialized = false;
        BdApi.showToast("GalaxyBackground deaktiviert", { type: "info" });
    }
    
    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.padding = "15px";
        panel.style.color = "var(--text-normal)";
        
        const title = document.createElement("h3");
        title.textContent = "Galaxy Background Einstellungen";
        title.style.marginBottom = "15px";
        panel.appendChild(title);
        
        const settings = [
            { key: "enableNebula", label: "Nebel-Effekte aktivieren", type: "switch" },
            { key: "enableOrbitRings", label: "Orbit-Ringe anzeigen", type: "switch" },
            { key: "performanceMode", label: "Performance-Modus (weniger Partikel)", type: "switch" },
            { key: "starCount", label: "Anzahl Sterne", type: "range", min: 500, max: 3000, step: 100 },
            { key: "nebulaParticles", label: "Nebel-Partikel", type: "range", min: 100, max: 1000, step: 50 },
            { key: "transparencyLevel", label: "UI-Transparenz", type: "range", min: 0.2, max: 0.8, step: 0.1 },
            { key: "cameraSpeed", label: "Kamera-Geschwindigkeit", type: "range", min: 0.00002, max: 0.0002, step: 0.00002 }
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
                toggle.checked = this.config[setting.key];
                toggle.style.cursor = "pointer";
                toggle.addEventListener("change", () => {
                    this.config[setting.key] = toggle.checked;
                    this.saveSettings();
                    this.applyTransparencyFixes();
                });
                container.appendChild(toggle);
            } else if (setting.type === "range") {
                const wrapper = document.createElement("div");
                wrapper.style.display = "flex";
                wrapper.style.alignItems = "center";
                wrapper.style.gap = "10px";
                
                const value = document.createElement("span");
                value.textContent = this.config[setting.key];
                value.style.minWidth = "60px";
                value.style.textAlign = "right";
                
                const input = document.createElement("input");
                input.type = "range";
                input.value = this.config[setting.key];
                input.min = setting.min;
                input.max = setting.max;
                input.step = setting.step;
                input.style.width = "150px";
                input.addEventListener("input", () => {
                    const val = parseFloat(input.value);
                    this.config[setting.key] = val;
                    value.textContent = val.toFixed(setting.step < 0.01 ? 5 : (setting.step < 1 ? 1 : 0));
                    this.saveSettings();
                });
                
                wrapper.appendChild(input);
                wrapper.appendChild(value);
                container.appendChild(wrapper);
            }
            
            panel.appendChild(container);
        });
        
        // Neustart-Hinweis
        const hint = document.createElement("p");
        hint.textContent = "Hinweis: Einige Änderungen erfordern einen Neustart des Plugins.";
        hint.style.marginTop = "20px";
        hint.style.fontSize = "12px";
        hint.style.color = "var(--text-muted)";
        panel.appendChild(hint);
        
        // Neustart-Button
        const restartBtn = document.createElement("button");
        restartBtn.textContent = "Plugin neu starten";
        restartBtn.style.cssText = `
            margin-top: 10px;
            padding: 8px 16px;
            background: var(--brand-experiment);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
        restartBtn.addEventListener("click", () => {
            this.stop();
            setTimeout(() => this.start(), 500);
        });
        panel.appendChild(restartBtn);
        
        return panel;
    }

    initGalaxy(canvas) {
        const THREE = window.THREE;
        if (!THREE) {
            console.error("[GalaxyBackground] Three.js nicht verfügbar");
            return;
        }
        
        // Performance-Modus Anpassungen
        const starCount = this.config.performanceMode ? Math.floor(this.config.starCount / 2) : this.config.starCount;
        const nebulaCount = this.config.performanceMode ? Math.floor(this.config.nebulaParticles / 2) : this.config.nebulaParticles;
        
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !this.config.performanceMode });
        renderer.setClearColor(this.config.backgroundColor, 1);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.config.performanceMode ? 1 : 2));
        renderer.shadowMap.enabled = !this.config.performanceMode;
        if (!this.config.performanceMode) {
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        this._renderer = renderer;

        const scene = new THREE.Scene();
        
        // Nebel-Hintergrund
        scene.fog = new THREE.FogExp2(0x0a0a1a, 0.0008);

        // Kamera
        const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 25, 70);

        // Ambientes Licht
        const ambient = new THREE.AmbientLight(0x404080, 0.3);
        scene.add(ambient);

        // Sonne
        const sunLight = new THREE.PointLight(0xffee88, 2.5, 600);
        sunLight.position.set(0, 0, 0);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        scene.add(sunLight);

        // Sonne Mesh
        const sunGeo = new THREE.SphereGeometry(5, 64, 64);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd66 });
        const sun = new THREE.Mesh(sunGeo, sunMat);
        scene.add(sun);

        // Verbesserter Sonnen-Glow
        const sunGlowMat = new THREE.ShaderMaterial({
            uniforms: {
                c: { value: 0.5 },
                p: { value: 3.0 },
                glowColor: { value: new THREE.Color(0xffaa33) },
                viewVector: { value: camera.position }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPositionNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 glowColor;
                uniform float c;
                uniform float p;
                varying vec3 vNormal;
                varying vec3 vPositionNormal;
                void main() {
                    float intensity = pow(c - dot(vNormal, vPositionNormal), p);
                    gl_FragColor = vec4(glowColor, 0.45) * intensity;
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true
        });
        const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(8, 64, 64), sunGlowMat);
        scene.add(sunGlow);

        // Zweiter Glow für mehr Tiefe
        const sunGlow2Mat = sunGlowMat.clone();
        sunGlow2Mat.uniforms.glowColor.value = new THREE.Color(0xff6622);
        sunGlow2Mat.uniforms.c.value = 0.3;
        const sunGlow2 = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 32), sunGlow2Mat);
        scene.add(sunGlow2);

        // Planeten mit mehr Details
        const planets = [
            { name: "Merkur", radius: 0.8, dist: 10, color: 0x9999aa, speed: 0.018, emissive: 0x222222 },
            { name: "Venus", radius: 1.2, dist: 14, color: 0xffcc88, speed: 0.014, emissive: 0x332200 },
            { name: "Erde", radius: 1.3, dist: 18, color: 0x3388ff, speed: 0.012, emissive: 0x001133 },
            { name: "Mars", radius: 1.0, dist: 23, color: 0xff6633, speed: 0.009, emissive: 0x331100 },
            { name: "Jupiter", radius: 3.5, dist: 32, color: 0xffaa66, speed: 0.005, emissive: 0x221100 },
            { name: "Saturn", radius: 2.8, dist: 42, color: 0xddcc88, speed: 0.004, emissive: 0x222200, hasRing: true },
            { name: "Uranus", radius: 2.0, dist: 52, color: 0x66ddff, speed: 0.003, emissive: 0x002233, hasRing: true },
            { name: "Neptun", radius: 1.9, dist: 60, color: 0x4466ff, speed: 0.002, emissive: 0x001144 }
        ];

        const planetMeshes = [];
        planets.forEach((p) => {
            const geo = new THREE.SphereGeometry(p.radius, 48, 48);
            const mat = new THREE.MeshStandardMaterial({ 
                color: p.color, 
                roughness: 0.6, 
                metalness: 0.4,
                emissive: p.emissive,
                emissiveIntensity: 0.3
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { dist: p.dist, speed: p.speed, angle: Math.random() * Math.PI * 2 };
            scene.add(mesh);
            planetMeshes.push(mesh);

            // Saturn-Ring
            if (p.hasRing) {
                const ringGeo = new THREE.RingGeometry(p.radius * 1.4, p.radius * 2.2, 64);
                const ringMat = new THREE.MeshBasicMaterial({ 
                    color: 0xccbb99, 
                    side: THREE.DoubleSide, 
                    transparent: true, 
                    opacity: 0.6 
                });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.rotation.x = Math.PI / 2.5;
                mesh.add(ring);
            }
        });

        // Orbit-Ringe
        if (this.config.enableOrbitRings) {
            planets.forEach((p) => {
                const orbitGeo = new THREE.RingGeometry(p.dist - 0.1, p.dist + 0.1, 128);
                const orbitMat = new THREE.MeshBasicMaterial({ 
                    color: 0x334466, 
                    side: THREE.DoubleSide, 
                    transparent: true, 
                    opacity: 0.15 
                });
                const orbit = new THREE.Mesh(orbitGeo, orbitMat);
                orbit.rotation.x = Math.PI / 2;
                scene.add(orbit);
            });
        }

        // Viele Sterne
        const starGeo = new THREE.BufferGeometry();
        const starVerts = [];
        const starColors = [];
        for (let i = 0; i < starCount; i++) {
            const r = 150 + Math.random() * 600;
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);
            starVerts.push(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            );
            const colorChoice = Math.random();
            if (colorChoice < 0.7) {
                starColors.push(1, 1, 1);
            } else if (colorChoice < 0.85) {
                starColors.push(0.8, 0.9, 1);
            } else if (colorChoice < 0.95) {
                starColors.push(1, 0.9, 0.7);
            } else {
                starColors.push(1, 0.7, 0.6);
            }
        }
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
        starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
        const starMat = new THREE.PointsMaterial({ 
            size: 1.5, 
            sizeAttenuation: true, 
            vertexColors: true,
            transparent: true,
            opacity: 0.9
        });
        const stars = new THREE.Points(starGeo, starMat);
        scene.add(stars);

        // Nebel-Partikel
        if (this.config.enableNebula) {
            const nebulaGeo = new THREE.BufferGeometry();
            const nebulaVerts = [];
            const nebulaColors = [];
            for (let i = 0; i < nebulaCount; i++) {
                const r = 80 + Math.random() * 200;
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                nebulaVerts.push(
                    r * Math.sin(phi) * Math.cos(theta),
                    (Math.random() - 0.5) * 40,
                    r * Math.cos(phi)
                );
                nebulaColors.push(
                    0.3 + Math.random() * 0.3,
                    0.1 + Math.random() * 0.2,
                    0.5 + Math.random() * 0.5
                );
            }
            nebulaGeo.setAttribute('position', new THREE.Float32BufferAttribute(nebulaVerts, 3));
            nebulaGeo.setAttribute('color', new THREE.Float32BufferAttribute(nebulaColors, 3));
            const nebulaMat = new THREE.PointsMaterial({ 
                size: 8, 
                sizeAttenuation: true, 
                vertexColors: true,
                transparent: true,
                opacity: 0.15,
                blending: THREE.AdditiveBlending
            });
            const nebula = new THREE.Points(nebulaGeo, nebulaMat);
            scene.add(nebula);
        }

        // Resize-Handler
        this._resizeHandler = () => {
            renderer.setSize(window.innerWidth, window.innerHeight, false);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        };
        window.addEventListener("resize", this._resizeHandler);
        this._resizeHandler();

        // Animation
        const animate = () => {
            const time = Date.now();
            
            planetMeshes.forEach((mesh) => {
                mesh.userData.angle += mesh.userData.speed;
                mesh.position.set(
                    Math.cos(mesh.userData.angle) * mesh.userData.dist,
                    Math.sin(mesh.userData.angle * 0.5) * 2,
                    Math.sin(mesh.userData.angle) * mesh.userData.dist
                );
                mesh.rotation.y += 0.01;
            });

            stars.rotation.y += 0.0001;

            camera.position.x = Math.sin(time * this.config.cameraSpeed) * 65;
            camera.position.z = Math.cos(time * this.config.cameraSpeed) * 65;
            camera.position.y = 20 + Math.sin(time * this.config.cameraSpeed * 0.5) * 10;
            camera.lookAt(0, 0, 0);

            renderer.render(scene, camera);
            this._animationFrame = requestAnimationFrame(animate);
        };
        animate();
        this._renderer = renderer;
    }
};