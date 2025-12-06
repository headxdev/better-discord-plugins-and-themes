/* ========================================
   HeadX BetterDiscord Website Script
   Galaxy Background & Interactions
   ======================================== */

// ============================================
// GALAXY BACKGROUND ANIMATION
// ============================================
class GalaxyBackground {
    constructor() {
        this.canvas = document.getElementById('galaxy-bg');
        this.ctx = this.canvas.getContext('2d');
        this.stars = [];
        this.shootingStars = [];
        this.nebulaClouds = [];
        this.mouse = { x: 0, y: 0 };
        this.time = 0;
        
        this.init();
        this.animate();
        this.setupEvents();
    }
    
    init() {
        this.resize();
        this.createStars();
        this.createNebulaClouds();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createStars() {
        this.stars = [];
        const starCount = Math.floor((this.canvas.width * this.canvas.height) / 3000);
        
        for (let i = 0; i < starCount; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 0.5,
                brightness: Math.random(),
                twinkleSpeed: Math.random() * 0.02 + 0.01,
                twinkleOffset: Math.random() * Math.PI * 2,
                color: this.getStarColor()
            });
        }
    }
    
    getStarColor() {
        const colors = [
            { r: 255, g: 255, b: 255 },  // White
            { r: 200, g: 220, b: 255 },  // Blue-white
            { r: 255, g: 200, b: 150 },  // Orange-white
            { r: 180, g: 140, b: 255 },  // Purple
            { r: 100, g: 200, b: 255 }   // Cyan
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    createNebulaClouds() {
        this.nebulaClouds = [];
        const cloudCount = 5;
        
        for (let i = 0; i < cloudCount; i++) {
            this.nebulaClouds.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 400 + 200,
                color: this.getNebulaColor(),
                alpha: Math.random() * 0.1 + 0.05,
                speed: Math.random() * 0.2 + 0.1
            });
        }
    }
    
    getNebulaColor() {
        const colors = [
            { r: 139, g: 92, b: 246 },   // Purple
            { r: 99, g: 102, b: 241 },   // Indigo
            { r: 34, g: 211, b: 238 },   // Cyan
            { r: 236, g: 72, b: 153 },   // Pink
            { r: 59, g: 130, b: 246 }    // Blue
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    createShootingStar() {
        if (Math.random() > 0.995) {
            this.shootingStars.push({
                x: Math.random() * this.canvas.width,
                y: 0,
                length: Math.random() * 100 + 50,
                speed: Math.random() * 15 + 10,
                angle: Math.PI / 4 + (Math.random() - 0.5) * 0.5,
                alpha: 1
            });
        }
    }
    
    drawBackground() {
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 0,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.width
        );
        gradient.addColorStop(0, '#0f1423');
        gradient.addColorStop(0.5, '#0a0c19');
        gradient.addColorStop(1, '#050608');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawNebulaClouds() {
        this.nebulaClouds.forEach(cloud => {
            const gradient = this.ctx.createRadialGradient(
                cloud.x, cloud.y, 0,
                cloud.x, cloud.y, cloud.size
            );
            gradient.addColorStop(0, `rgba(${cloud.color.r}, ${cloud.color.g}, ${cloud.color.b}, ${cloud.alpha})`);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(cloud.x - cloud.size, cloud.y - cloud.size, cloud.size * 2, cloud.size * 2);
            
            // Animate cloud
            cloud.x += Math.sin(this.time * cloud.speed) * 0.5;
            cloud.y += Math.cos(this.time * cloud.speed * 0.5) * 0.3;
        });
    }
    
    drawStars() {
        this.stars.forEach(star => {
            const twinkle = Math.sin(this.time * star.twinkleSpeed + star.twinkleOffset);
            const brightness = star.brightness * (0.5 + twinkle * 0.5);
            const alpha = 0.3 + brightness * 0.7;
            
            // Star glow
            const glow = this.ctx.createRadialGradient(
                star.x, star.y, 0,
                star.x, star.y, star.size * 3
            );
            glow.addColorStop(0, `rgba(${star.color.r}, ${star.color.g}, ${star.color.b}, ${alpha})`);
            glow.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = glow;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Star core
            this.ctx.fillStyle = `rgba(${star.color.r}, ${star.color.g}, ${star.color.b}, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    drawShootingStars() {
        this.shootingStars = this.shootingStars.filter(star => {
            star.x += Math.cos(star.angle) * star.speed;
            star.y += Math.sin(star.angle) * star.speed;
            star.alpha -= 0.02;
            
            if (star.alpha <= 0) return false;
            
            const gradient = this.ctx.createLinearGradient(
                star.x, star.y,
                star.x - Math.cos(star.angle) * star.length,
                star.y - Math.sin(star.angle) * star.length
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, ${star.alpha})`);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(star.x, star.y);
            this.ctx.lineTo(
                star.x - Math.cos(star.angle) * star.length,
                star.y - Math.sin(star.angle) * star.length
            );
            this.ctx.stroke();
            
            return true;
        });
    }
    
    drawMouseGlow() {
        const gradient = this.ctx.createRadialGradient(
            this.mouse.x, this.mouse.y, 0,
            this.mouse.x, this.mouse.y, 200
        );
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.1)');
        gradient.addColorStop(1, 'transparent');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(this.mouse.x - 200, this.mouse.y - 200, 400, 400);
    }
    
    animate() {
        this.time += 0.01;
        
        this.drawBackground();
        this.drawNebulaClouds();
        this.drawStars();
        this.createShootingStar();
        this.drawShootingStars();
        this.drawMouseGlow();
        
        requestAnimationFrame(() => this.animate());
    }
    
    setupEvents() {
        window.addEventListener('resize', () => {
            this.resize();
            this.createStars();
        });
        
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
    }
}

// ============================================
// NAVIGATION
// ============================================
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section');
    
    // Smooth scroll and active state
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const target = document.querySelector(targetId);
            
            if (target) {
                const offset = 80; // Navbar height
                const targetPosition = target.offsetTop - offset;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Update active link on scroll
    window.addEventListener('scroll', () => {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            if (window.scrollY >= sectionTop) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

// ============================================
// PLUGIN FILTERING
// ============================================
function setupPluginFiltering() {
    const categoryBtns = document.querySelectorAll('.category-btn');
    const pluginCards = document.querySelectorAll('.plugin-card');
    
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active button
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const category = btn.dataset.category;
            
            // Filter cards
            pluginCards.forEach(card => {
                if (category === 'all' || card.dataset.category === category) {
                    card.style.display = 'block';
                    card.style.animation = 'fadeIn 0.3s ease';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

// Add fade animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);

// ============================================
// CODE MODAL
// ============================================
const themeCode = `/**
 * @name Galaxy Theme Ultimate
 * @author HeadX
 * @authorId 808385710700494919
 * @version 3.1.0
 * @description Ultimate Discord theme with Galaxy, Midnight, Moon Rabbits & VSThemes integrated
 * @source https://github.com/headxdev/better-discord-plugins-and-themes
 * @invite J6wTJJ5fp
 */

/* Root Variables */
:root {
    --galaxy-bg: #0a0c19;
    --galaxy-accent: #8b5cf6;
    --galaxy-secondary: #6366f1;
    --galaxy-text: #e4e6eb;
    --transparency: 0.30;
    --blur-amount: 10px;
}

/* Transparent Background */
.theme-dark {
    --background-primary: rgba(10, 12, 25, var(--transparency));
    --background-secondary: rgba(15, 18, 35, var(--transparency));
    --background-tertiary: rgba(20, 25, 45, var(--transparency));
}

/* Glassmorphism Effects */
.container-ZMc96U,
.sidebar-1tnWFu,
.chat-2ZfjoI,
.membersWrap-3NUR2t {
    background: rgba(10, 12, 25, var(--transparency)) !important;
    backdrop-filter: blur(var(--blur-amount)) !important;
}

/* Galaxy Accent Colors */
.button-f2h6uQ.lookFilled-yCfaCM.colorBrand-I6CyqQ,
.tabBar-ra-EuL .tab-1ujlUx.selected-2ZUQLO {
    background: linear-gradient(135deg, var(--galaxy-accent), var(--galaxy-secondary)) !important;
}

/* Download full theme from GitHub */`;

function showCode(themeId) {
    const modal = document.getElementById('code-modal');
    const codeContent = document.getElementById('code-content');
    
    codeContent.textContent = themeCode;
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('code-modal');
    modal.classList.remove('active');
}

function copyCode() {
    navigator.clipboard.writeText(themeCode).then(() => {
        const btn = document.querySelector('.modal-footer .btn-primary');
        const originalText = btn.innerHTML;
        btn.innerHTML = '✓ Kopiert!';
        btn.style.background = '#22c55e';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 2000);
    });
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('code-modal');
    if (e.target === modal) {
        closeModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// ============================================
// SCROLL ANIMATIONS
// ============================================
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Animate cards on scroll
    const animatedElements = document.querySelectorAll('.plugin-card, .mini-theme-card, .step');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(el);
    });
}

// ============================================
// STATS COUNTER ANIMATION
// ============================================
function animateStats() {
    const stats = document.querySelectorAll('.stat-number');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const finalValue = target.textContent;
                const isNumber = !isNaN(parseInt(finalValue));
                
                if (isNumber) {
                    const endValue = parseInt(finalValue);
                    let current = 0;
                    const increment = endValue / 30;
                    const hasPlus = finalValue.includes('+');
                    
                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= endValue) {
                            target.textContent = hasPlus ? `${endValue}+` : endValue;
                            clearInterval(timer);
                        } else {
                            target.textContent = Math.floor(current);
                        }
                    }, 50);
                }
                
                observer.unobserve(target);
            }
        });
    });
    
    stats.forEach(stat => observer.observe(stat));
}

// ============================================
// TYPING EFFECT FOR HERO
// ============================================
function setupTypingEffect() {
    const heroTitle = document.querySelector('.gradient-text');
    if (!heroTitle) return;
    
    const text = heroTitle.textContent;
    heroTitle.textContent = '';
    
    let i = 0;
    const typeWriter = () => {
        if (i < text.length) {
            heroTitle.textContent += text.charAt(i);
            i++;
            setTimeout(typeWriter, 100);
        }
    };
    
    // Start typing after a short delay
    setTimeout(typeWriter, 500);
}

// ============================================
// PARTICLE EFFECT ON HOVER
// ============================================
function setupParticleEffect() {
    const buttons = document.querySelectorAll('.btn-primary');
    
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', (e) => {
            createParticles(e.target);
        });
    });
}

function createParticles(element) {
    const rect = element.getBoundingClientRect();
    
    for (let i = 0; i < 10; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = `
            position: fixed;
            width: 6px;
            height: 6px;
            background: ${['#8b5cf6', '#6366f1', '#22d3ee', '#ec4899'][Math.floor(Math.random() * 4)]};
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
            left: ${rect.left + rect.width / 2}px;
            top: ${rect.top + rect.height / 2}px;
        `;
        document.body.appendChild(particle);
        
        const angle = (Math.random() * 360) * (Math.PI / 180);
        const velocity = Math.random() * 50 + 30;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;
        
        let x = 0;
        let y = 0;
        let opacity = 1;
        
        const animate = () => {
            x += vx * 0.1;
            y += vy * 0.1;
            opacity -= 0.02;
            
            particle.style.transform = `translate(${x}px, ${y}px)`;
            particle.style.opacity = opacity;
            
            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                particle.remove();
            }
        };
        
        requestAnimationFrame(animate);
    }
}

// ============================================
// DISCORD MOCK ANIMATION
// ============================================
function setupDiscordMock() {
    const mock = document.querySelector('.discord-mock');
    if (!mock) return;
    
    // Add animated messages to mock chat
    const mockChat = mock.querySelector('.mock-chat');
    if (mockChat) {
        setInterval(() => {
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = `
                height: 8px;
                background: rgba(139, 92, 246, ${Math.random() * 0.3 + 0.1});
                border-radius: 4px;
                margin: 8px;
                width: ${Math.random() * 60 + 30}%;
                animation: fadeIn 0.3s ease;
            `;
            mockChat.appendChild(messageDiv);
            
            // Remove old messages
            if (mockChat.children.length > 15) {
                mockChat.removeChild(mockChat.firstChild);
            }
        }, 2000);
    }
}

// ============================================
// INITIALIZE EVERYTHING
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Galaxy Background
    new GalaxyBackground();
    
    // Setup interactions
    setupNavigation();
    setupPluginFiltering();
    setupScrollAnimations();
    animateStats();
    setupTypingEffect();
    setupParticleEffect();
    setupDiscordMock();
    
    console.log('🌌 HeadX BetterDiscord Website loaded!');
    console.log('✨ Galaxy Background active');
    console.log('🎨 All interactions ready');
});

// ============================================
// THEME DETAILS MODAL
// ============================================
const themeDetails = {
    midnight: {
        name: '🌙 Midnight Theme',
        description: 'Ein elegantes dunkles Theme mit custom Chatbar, Window Controls und smooth Scroll-Animationen.',
        features: ['Custom Chatbar Design', 'Window Controls Styling', 'Smooth Scrolling', 'Dark Gradients', 'Animation Effects'],
        colors: ['#1e1e2e', '#313244', '#cdd6f4', '#89b4fa']
    },
    moonrabbit: {
        name: '🐇 Moon Rabbits Dream',
        description: 'Ein traumhaftes, kawaii-inspiriertes Theme mit sanften Pastellfarben und Pop-Effekten.',
        features: ['Window Mode', 'Pop Effects', 'Animated Background', 'Kawaii Aesthetic', 'Pastel Colors'],
        colors: ['#e297b2', '#c0b4d5', '#54b5de', '#f5c2e7']
    },
    vsthemes: {
        name: '👻 VSThemes / True Ghoul',
        description: 'Ein mysteriöses Theme mit extremer Transparenz und dynamischen Hintergrund-Effekten.',
        features: ['Extreme Transparency', 'Dynamic Backgrounds', 'Dark Aesthetic', 'Ghost Effects', 'Blur System'],
        colors: ['#0a0a0a', '#1a0a0a', '#8b5cf6', '#ff6b6b']
    },
    glass: {
        name: '✨ Glasmorphismus',
        description: 'Modernes Glasmorphismus-Design mit Blur-Effekten und transparenten Panels.',
        features: ['Blur Effects', 'Transparent Panels', 'Frosted Glass Look', 'Light Borders', 'Depth Effects'],
        colors: ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)', '#8b5cf6', '#22d3ee']
    }
};

function showThemeDetails(themeId) {
    const theme = themeDetails[themeId];
    if (!theme) return;
    
    const modal = document.getElementById('code-modal');
    const codeContent = document.getElementById('code-content');
    const modalTitle = document.querySelector('.modal-header h3');
    
    modalTitle.textContent = theme.name;
    
    let content = `/* ${theme.name} */\n\n`;
    content += `/* ${theme.description} */\n\n`;
    content += `/* Features:\n`;
    theme.features.forEach(f => content += ` * - ${f}\n`);
    content += ` */\n\n`;
    content += `/* Color Palette:\n`;
    theme.colors.forEach((c, i) => content += ` * Color ${i + 1}: ${c}\n`);
    content += ` */\n\n`;
    content += `/* This theme is integrated into Galaxy Theme Ultimate.\n`;
    content += ` * Download the full theme from GitHub:\n`;
    content += ` * https://github.com/headxdev/better-discord-plugins-and-themes\n`;
    content += ` */`;
    
    codeContent.textContent = content;
    modal.classList.add('active');
}

// ============================================
// COPY CSS VARIABLES
// ============================================
function copyCSSVars() {
    const cssVars = `:root {
    /* 🌌 Galaxy Colors */
    --galaxy-bg: #0a0c19;
    --galaxy-accent: #8b5cf6;
    --galaxy-secondary: #6366f1;
    --galaxy-cyan: #22d3ee;
    --galaxy-pink: #ec4899;
    
    /* 🔮 Transparency (0.0 - 1.0) */
    --transparency: 0.30;
    --blur-amount: 10px;
    
    /* ✨ Glassmorphism */
    --glass-bg: rgba(10, 12, 25, var(--transparency));
    --glass-border: rgba(255, 255, 255, 0.1);
}`;
    
    navigator.clipboard.writeText(cssVars).then(() => {
        const btn = document.querySelector('.copy-btn');
        const originalText = btn.textContent;
        btn.textContent = '✅ Kopiert!';
        btn.style.background = '#22c55e';
        btn.style.color = 'white';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.color = '';
        }, 2000);
    });
}

// Make functions globally available
window.showCode = showCode;
window.closeModal = closeModal;
window.copyCode = copyCode;
window.showThemeDetails = showThemeDetails;
window.copyCSSVars = copyCSSVars;
