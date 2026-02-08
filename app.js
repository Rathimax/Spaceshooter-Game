// ============================================================================
// SPACESHOOTER GAME - Main Game Logic
// ============================================================================

// =========================
// GAME CONSTANTS
// =========================
const GAME_CONSTANTS = {
    // Movement & Speed
    BULLET_SPEED: 10,
    POWERUP_FALL_SPEED: 3,

    // Cooldowns (ms)
    BULLET_COOLDOWN: 250,
    RAPID_FIRE_COOLDOWN: 100,
    LASER_CHARGE_TIME: 200,
    LASER_DURATION: 3000,
    ROCKET_COOLDOWN: 15000,

    // Thresholds
    ROCKET_UNLOCK_SCORE: 7,
    LASER_UNLOCK_HITS: 7,
    BOSS_TRIGGER_SCORE: 20,

    // Power-up durations (ms)
    RAPID_FIRE_DURATION: 8000,
    SPREAD_SHOT_DURATION: 10000,

    // Probabilities
    POWERUP_DROP_CHANCE: 0.2,
    LIFE_UP_CHANCE: 0.1,

    // Joystick
    JOYSTICK_DEAD_ZONE: 0.3,
    JOYSTICK_MAX_DISTANCE_RATIO: 0.35,

    // Visual
    TILT_ANGLE: 10,

    // Boss Abilities
    BOSS_BEAM_WARNING_TIME: 3000,
    BOSS_BEAM_DURATION: 2000,
    BOSS_SPEED_BOOST_DURATION: 2000,
    BOSS_SPEED_BOOST_MULTIPLIER: 4,
    BOSS_SPECIAL_ATTACK_COOLDOWN: 8000,
};

// Difficulty presets
const DIFFICULTY_SETTINGS = {
    easy: { jetSpeed: 8, rockFallSpeed: 2.5, rockSpawnRate: 2400, bossHealth: 100, bossSpeed: 1, bossFireRate: 1500 },
    medium: { jetSpeed: 10, rockFallSpeed: 4, rockSpawnRate: 1600, bossHealth: 150, bossSpeed: 2, bossFireRate: 1000 },
    hard: { jetSpeed: 12, rockFallSpeed: 6, rockSpawnRate: 1000, bossHealth: 200, bossSpeed: 3, bossFireRate: 850 }
};

// =========================
// DOM ELEMENTS
// =========================
const jet = document.getElementById("jet");
const board = document.getElementById("board");
const shieldEffect = document.getElementById("shield-effect");
const powerupBarsContainer = document.getElementById("powerup-bars-container");

// =========================
// AUDIO HANDLING
// =========================
const audioElements = {};
const audioIds = ['shoot-sound', 'explosion-sound', 'gameover-sound', 'laser-fire-sound',
    'laser-charge-sound', 'rocket-launch-sound', 'powerup-collect-sound', 'shield-break-sound'];
let soundEnabled = true;

/**
 * Initialize audio elements with error handling
 */
function initAudio() {
    audioIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            audioElements[id] = element;
            element.onerror = () => console.warn(`Audio file for ${id} not found`);
        }
    });
    // Load mute preference from localStorage
    const savedMute = localStorage.getItem('spaceShooterMuted');
    if (savedMute === 'true') {
        soundEnabled = false;
    }
}

/**
 * Play a sound by ID with error handling
 * @param {string} soundId - The ID of the audio element to play
 */
function playSound(soundId) {
    if (!soundEnabled) return;
    const audio = audioElements[soundId];
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(err => {
            // Silently fail if audio can't play (e.g., missing file, user hasn't interacted)
        });
    }
}

/**
 * Toggle sound on/off
 */
function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('spaceShooterMuted', !soundEnabled);
    updateMuteButtonUI();
}

/**
 * Update mute button visual state
 */
function updateMuteButtonUI() {
    const muteBtn = document.getElementById('mute-button');
    if (muteBtn) {
        muteBtn.textContent = soundEnabled ? '🔊' : '🔇';
    }
}

// =========================
// HIGH SCORE SYSTEM
// =========================
let highScore = parseInt(localStorage.getItem('spaceShooterHighScore')) || 0;

/**
 * Save high score to localStorage
 * @param {number} currentScore - The current game score
 */
function saveHighScore(currentScore) {
    if (currentScore > highScore) {
        highScore = currentScore;
        localStorage.setItem('spaceShooterHighScore', highScore.toString());
        return true; // New high score
    }
    return false;
}

/**
 * Get the current high score
 * @returns {number} The high score
 */
function getHighScore() {
    return highScore;
}

// =========================
// GAME STATE
// =========================
let lives = 3;
let score = 0;
let gameRunning = false;
let paused = false;
let gameLevel = "medium";
let gameMode = "classic";

// Interval references (for cleanup)
let rockMoveInterval = null;
let rockSpawnInterval = null;
let bossLoopInterval = null;
let laserDamageInterval = null;
let powerupMoveInterval = null;

// Speed variables (set from difficulty)
let jetSpeed = DIFFICULTY_SETTINGS.medium.jetSpeed;
let rockFallSpeed = DIFFICULTY_SETTINGS.medium.rockFallSpeed;
let rockSpawnRate = DIFFICULTY_SETTINGS.medium.rockSpawnRate;
let baseRockFallSpeed = DIFFICULTY_SETTINGS.medium.rockFallSpeed;
let baseRockSpawnRate = DIFFICULTY_SETTINGS.medium.rockSpawnRate;

// Endless Mode State
let currentWave = 1;
let aliensKilledThisWave = 0;
let aliensPerWave = 20;

// =========================
// PLAYER & CONTROL STATE
// =========================
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;
let canShoot = true;
let isTouching = false;
let touchOffsetX = 0;
let touchOffsetY = 0;
let playerIsDead = false;

// Joystick State
let joystickActive = false;
let joystickBaseX = 0;
let joystickBaseY = 0;
let joystickStickX = 0;
let joystickStickY = 0;
let joystickMaxDistance = 0;

// =========================
// POWER-UP STATE
// =========================
let consecutiveHits = 0;
let homingRocketsReady = false;
let laserReady = false;
let laserIsActive = false;
let shieldActive = false;
let rapidFireActive = false;
let spreadShotActive = false;
let powerupTimeouts = {};

// =========================
// BOSS STATE
// =========================
let bossActive = false;
let bossIsVulnerable = false;
let bossHealth = 0;
let bossMaxHealth = 0;
let bossSpecialAttackTimer = 0;
let bossCurrentAttack = null;
let bossSpeedBoosted = false;
let bossBeamActive = false;
let bossBeamElement = null;
let bossBeamWarningElement = null;
let bossSettings = {};
let bossElement = null;
let bossHealthBar = null;
let bossHealthContainer = null;

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Check if the current device supports touch
 * @returns {boolean} True if touch device
 */
const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

/**
 * Check collision between two elements using bounding rects
 * @param {HTMLElement} elem1 - First element
 * @param {HTMLElement} elem2 - Second element
 * @returns {boolean} True if elements are colliding
 */
function checkCollision(elem1, elem2) {
    if (!elem1 || !elem2) return false;

    const rect1 = elem1.getBoundingClientRect();
    const rect2 = elem2.getBoundingClientRect();

    return !(
        rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom
    );
}

/**
 * Trigger screen shake effect
 */
function triggerScreenShake() {
    board.classList.add("shake");
    setTimeout(() => board.classList.remove("shake"), 200);
}

/**
 * Create impact particle effects at a position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
function createImpactParticles(x, y) {
    const boardRect = board.getBoundingClientRect();

    for (let i = 0; i < 10; i++) {
        const particle = document.createElement("div");
        particle.classList.add("particle");
        particle.style.left = (x - boardRect.left) + "px";
        particle.style.top = (y - boardRect.top) + "px";

        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * 50 + 20;
        particle.style.setProperty("--x", Math.cos(angle) * distance + "px");
        particle.style.setProperty("--y", Math.sin(angle) * distance + "px");

        board.appendChild(particle);
        setTimeout(() => particle.remove(), 500);
    }
}

// =========================
// MAIN GAME LOOP
// =========================

/**
 * Main game loop - handles player movement
 */
function mainGameLoop() {
    if (paused || !gameRunning) {
        requestAnimationFrame(mainGameLoop);
        return;
    }

    if (!playerIsDead) {
        // Use joystick input for mobile, keyboard input for desktop
        if (isTouchDevice() && joystickActive) {
            // Joystick movement is handled in joystick handlers
        } else if (!isTouching) {
            const jetStyle = window.getComputedStyle(jet);
            let left = parseInt(jetStyle.getPropertyValue("left"));
            let bottom = parseInt(jetStyle.getPropertyValue("bottom"));

            if (moveLeft && left > 0) {
                jet.style.left = (left - jetSpeed) + "px";
            }
            if (moveRight && left < (board.clientWidth - jet.clientWidth)) {
                jet.style.left = (left + jetSpeed) + "px";
            }
            if (moveUp && bottom < (board.clientHeight - jet.clientHeight)) {
                jet.style.bottom = (bottom + jetSpeed) + "px";
            }
            if (moveDown && bottom > 10) {
                jet.style.bottom = (bottom - jetSpeed) + "px";
            }
        }

        // Apply tilt animation based on movement
        const tiltAngle = GAME_CONSTANTS.TILT_ANGLE;
        if (moveLeft && !moveRight) {
            jet.style.transform = `translateX(-50%) rotate(-${tiltAngle}deg)`;
        } else if (moveRight && !moveLeft) {
            jet.style.transform = `translateX(-50%) rotate(${tiltAngle}deg)`;
        } else {
            jet.style.transform = `translateX(-50%) rotate(0deg)`;
        }
    }

    requestAnimationFrame(mainGameLoop);
}

// Start the game loop
mainGameLoop();

// =========================
// EVENT LISTENERS
// =========================

/**
 * Setup all event listeners based on device type
 */
function setupEventListeners() {
    if (isTouchDevice()) {
        // Setup joystick
        setupJoystick();

        // Keep old touch controls as fallback (but joystick takes priority)
        board.addEventListener('touchstart', handleTouchStart, { passive: false });
        board.addEventListener('touchmove', handleTouchMove, { passive: false });
        board.addEventListener('touchend', handleTouchEnd, { passive: false });

        // Button controls
        const fireButton = document.getElementById('fire-button');
        const rocketButton = document.getElementById('rocket-button');
        const laserButton = document.getElementById('laser-button');
        const pauseButton = document.getElementById('pause-button');

        if (fireButton) {
            fireButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (canShoot) fireBullet();
            });
        }
        if (rocketButton) {
            rocketButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                activateHomingRockets();
            });
        }
        if (laserButton) {
            laserButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                activateLaser();
            });
        }
        if (pauseButton) {
            pauseButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (gameRunning) togglePause();
            });
        }
    } else {
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
    }
}

/**
 * Handle key down events
 * @param {KeyboardEvent} e - The keyboard event
 */
function handleKeyDown(e) {
    const key = e.key.toLowerCase();

    if (key === "p") {
        if (gameRunning) togglePause();
        return;
    }

    if (playerIsDead) return;

    if (homingRocketsReady && key === 'q') {
        activateHomingRockets();
        return;
    }
    if (laserReady && key === 'e') {
        activateLaser();
        return;
    }

    if (!gameRunning || paused) return;

    if (["arrowleft", "a"].includes(key)) moveLeft = true;
    if (["arrowright", "d"].includes(key)) moveRight = true;
    if (["arrowup", "w"].includes(key)) moveUp = true;
    if (["arrowdown", "s"].includes(key)) moveDown = true;

    if (key === " " && canShoot) {
        e.preventDefault();
        fireBullet();
    }
}

/**
 * Handle key up events
 * @param {KeyboardEvent} e - The keyboard event
 */
function handleKeyUp(e) {
    const key = e.key.toLowerCase();
    if (["arrowleft", "a"].includes(key)) moveLeft = false;
    if (["arrowright", "d"].includes(key)) moveRight = false;
    if (["arrowup", "w"].includes(key)) moveUp = false;
    if (["arrowdown", "s"].includes(key)) moveDown = false;
}

/**
 * Handle touch start events
 * @param {TouchEvent} e - The touch event
 */
function handleTouchStart(e) {
    if (playerIsDead) return;

    // Don't activate drag if touching joystick area
    const joystickContainer = document.getElementById('joystick-container');
    if (joystickContainer && joystickContainer.contains(e.target)) return;

    if (e.target === jet) {
        e.preventDefault();
        isTouching = true;
        const touch = e.touches[0];
        const jetRect = jet.getBoundingClientRect();
        touchOffsetX = touch.clientX - jetRect.left;
        touchOffsetY = touch.clientY - jetRect.top;
    }
}

/**
 * Handle touch move events
 * @param {TouchEvent} e - The touch event
 */
function handleTouchMove(e) {
    if (playerIsDead) return;

    if (isTouching) {
        e.preventDefault();
        const touch = e.touches[0];
        let newX = touch.clientX - touchOffsetX;
        let newY = touch.clientY - touchOffsetY;

        const boardRect = board.getBoundingClientRect();
        newX = Math.max(boardRect.left, Math.min(newX, boardRect.right - jet.clientWidth));
        newY = Math.max(boardRect.top, Math.min(newY, boardRect.bottom - jet.clientHeight));

        jet.style.left = (newX - boardRect.left) + 'px';
        jet.style.bottom = (boardRect.bottom - newY - jet.clientHeight) + 'px';
    }
}

/**
 * Handle touch end events
 * @param {TouchEvent} e - The touch event
 */
function handleTouchEnd(e) {
    e.preventDefault();
    isTouching = false;
}

/**
 * Toggle pause state
 */
function togglePause() {
    paused = !paused;
    const pauseScreen = document.getElementById("pause-screen");
    const pauseMessage = document.getElementById("pause-message");

    pauseScreen.style.display = paused ? "flex" : "none";

    if (pauseMessage) {
        pauseMessage.textContent = isTouchDevice()
            ? "Tap ⏸ to Resume"
            : "Press 'P' to Resume";
    }
}

// =========================
// JOYSTICK CONTROLS
// =========================

/**
 * Setup joystick controls for mobile
 */
function setupJoystick() {
    const joystickContainer = document.getElementById('joystick-container');
    const joystickStick = document.getElementById('joystick-stick');

    if (!joystickContainer || !joystickStick) return;

    const joystickBase = document.getElementById('joystick-base');
    const baseRect = joystickBase.getBoundingClientRect();
    joystickMaxDistance = baseRect.width * GAME_CONSTANTS.JOYSTICK_MAX_DISTANCE_RATIO;

    joystickContainer.addEventListener('touchstart', handleJoystickStart, { passive: false });
    joystickContainer.addEventListener('touchmove', handleJoystickMove, { passive: false });
    joystickContainer.addEventListener('touchend', handleJoystickEnd, { passive: false });
    joystickContainer.addEventListener('touchcancel', handleJoystickEnd, { passive: false });
}

/**
 * Handle joystick touch start
 * @param {TouchEvent} e - The touch event
 */
function handleJoystickStart(e) {
    if (playerIsDead || !gameRunning || paused) return;

    e.preventDefault();
    e.stopPropagation();
    joystickActive = true;

    const joystickContainer = document.getElementById('joystick-container');
    const joystickBase = document.getElementById('joystick-base');
    joystickContainer.classList.add('active');

    const baseRect = joystickBase.getBoundingClientRect();
    joystickBaseX = baseRect.left + baseRect.width / 2;
    joystickBaseY = baseRect.top + baseRect.height / 2;

    const touch = e.touches[0];
    updateJoystickPosition(touch.clientX, touch.clientY);
}

/**
 * Handle joystick touch move
 * @param {TouchEvent} e - The touch event
 */
function handleJoystickMove(e) {
    if (!joystickActive) return;

    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    if (touch) {
        updateJoystickPosition(touch.clientX, touch.clientY);
    }
}

/**
 * Handle joystick touch end
 * @param {TouchEvent} e - The touch event
 */
function handleJoystickEnd(e) {
    if (!joystickActive) return;

    e.preventDefault();
    e.stopPropagation();
    joystickActive = false;

    const joystickContainer = document.getElementById('joystick-container');
    const joystickStick = document.getElementById('joystick-stick');
    joystickContainer.classList.remove('active');

    // Reset joystick stick to center
    joystickStick.style.transform = 'translate(-50%, -50%)';

    // Reset movement
    moveLeft = moveRight = moveUp = moveDown = false;
}

/**
 * Update joystick position and apply movement
 * @param {number} touchX - Touch X coordinate
 * @param {number} touchY - Touch Y coordinate
 */
function updateJoystickPosition(touchX, touchY) {
    const joystickStick = document.getElementById('joystick-stick');
    if (!joystickStick) return;

    // Calculate distance from center
    const deltaX = touchX - joystickBaseX;
    const deltaY = touchY - joystickBaseY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Limit stick movement to max distance
    let stickX = deltaX;
    let stickY = deltaY;
    if (distance > joystickMaxDistance) {
        stickX = (deltaX / distance) * joystickMaxDistance;
        stickY = (deltaY / distance) * joystickMaxDistance;
    }

    // Update stick visual position
    joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;

    // Calculate normalized direction (-1 to 1)
    const normalizedX = stickX / joystickMaxDistance;
    const normalizedY = stickY / joystickMaxDistance;

    // Update movement flags based on joystick position
    const threshold = GAME_CONSTANTS.JOYSTICK_DEAD_ZONE;
    moveLeft = normalizedX < -threshold;
    moveRight = normalizedX > threshold;
    moveUp = normalizedY < -threshold;
    moveDown = normalizedY > threshold;

    // Apply movement to jet
    if (!playerIsDead && gameRunning && !paused) {
        const jetStyle = window.getComputedStyle(jet);
        let left = parseInt(jetStyle.getPropertyValue("left"));
        let bottom = parseInt(jetStyle.getPropertyValue("bottom"));

        // Apply movement with intensity based on joystick distance
        const intensity = Math.min(1, distance / joystickMaxDistance);
        const speed = jetSpeed * intensity;

        if (moveLeft && left > 0) {
            jet.style.left = (left - speed) + "px";
        }
        if (moveRight && left < (board.clientWidth - jet.clientWidth)) {
            jet.style.left = (left + speed) + "px";
        }
        if (moveUp && bottom < (board.clientHeight - jet.clientHeight)) {
            jet.style.bottom = (bottom + speed) + "px";
        }
        if (moveDown && bottom > 10) {
            jet.style.bottom = (bottom - speed) + "px";
        }
    }
}

// =========================
// SHOOTING & BULLETS
// =========================

/**
 * Fire a bullet (or spread shot if active)
 */
function fireBullet() {
    if (!canShoot) return;

    const cooldown = rapidFireActive
        ? GAME_CONSTANTS.RAPID_FIRE_COOLDOWN
        : GAME_CONSTANTS.BULLET_COOLDOWN;

    canShoot = false;
    setTimeout(() => { canShoot = true; }, cooldown);

    playSound("shoot-sound");

    if (spreadShotActive) {
        createSingleBullet(0, 0);
        createSingleBullet(-15, -0.2);
        createSingleBullet(15, 0.2);
    } else {
        createSingleBullet(0, 0);
    }
}

/**
 * Create a single bullet projectile
 * @param {number} offsetX - Horizontal offset from jet center
 * @param {number} angle - Angle modifier for spread shots
 */
function createSingleBullet(offsetX, angle) {
    const bullet = document.createElement("div");
    bullet.classList.add("bullets");
    board.appendChild(bullet);

    const jetRect = jet.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();

    let startX = jetRect.left - boardRect.left + jetRect.width / 2 - bullet.clientWidth / 2 + offsetX;
    let startBottom = jet.clientHeight + (jetRect.bottom - boardRect.bottom) * -1;

    bullet.style.left = startX + "px";
    bullet.style.bottom = startBottom + "px";

    const bulletInterval = setInterval(() => {
        if (paused) return;

        let currentBottom = parseInt(bullet.style.bottom);
        let currentLeft = parseInt(bullet.style.left);
        let newBottom = currentBottom + GAME_CONSTANTS.BULLET_SPEED;
        let newLeft = currentLeft + (GAME_CONSTANTS.BULLET_SPEED * angle);

        if (checkBulletCollision(bullet, bulletInterval)) return;

        if (newBottom >= board.clientHeight) {
            bullet.remove();
            clearInterval(bulletInterval);
            resetHitStreak();
        } else {
            bullet.style.bottom = newBottom + "px";
            bullet.style.left = newLeft + "px";
        }
    }, 20);
}

/**
 * Check if bullet hit anything
 * @param {HTMLElement} bullet - The bullet element
 * @param {number} bulletInterval - The bullet's interval ID
 * @returns {boolean} True if collision occurred
 */
function checkBulletCollision(bullet, bulletInterval) {
    // Check boss collision
    if (bossActive && bossIsVulnerable && checkCollision(bullet, bossElement)) {
        damageBoss(1);
        bullet.remove();
        clearInterval(bulletInterval);
        return true;
    }

    // Check rock/alien collisions
    if (!bossActive) {
        const rocks = document.querySelectorAll(".rocks:not(.explode)");
        for (let rock of rocks) {
            if (checkCollision(bullet, rock)) {
                if (rock.dataset.health) {
                    let health = parseInt(rock.dataset.health) - 1;
                    rock.dataset.health = health;

                    if (health <= 0) {
                        destroyRock(rock);
                        consecutiveHits++;
                    } else {
                        rock.classList.add("rock-hit-effect");
                        setTimeout(() => rock.classList.remove("rock-hit-effect"), 100);
                    }
                } else {
                    destroyRock(rock);
                    consecutiveHits++;
                }

                updatePowerupUI();
                bullet.remove();
                clearInterval(bulletInterval);
                return true;
            }
        }
    }

    return false;
}

// =========================
// SPECIAL ABILITIES
// =========================

/**
 * Activate the laser beam ability
 */
function activateLaser() {
    if (laserIsActive || !laserReady) return;

    laserReady = false;
    laserIsActive = true;
    updatePowerupUI();

    // Charge up effect
    jet.classList.add("jet-charge");
    playSound("laser-charge-sound");

    setTimeout(() => {
        jet.classList.remove("jet-charge");
        playSound("laser-fire-sound");
        triggerScreenShake();

        // Create laser beam
        const laserBeam = document.createElement("div");
        laserBeam.classList.add("laser-beam");
        board.appendChild(laserBeam);

        // Update laser position and check collisions
        laserDamageInterval = setInterval(() => {
            if (paused) return;

            const jetRect = jet.getBoundingClientRect();
            const boardRect = board.getBoundingClientRect();

            laserBeam.style.left = (jetRect.left - boardRect.left + jetRect.width / 2 - 5) + "px";
            laserBeam.style.bottom = (jet.clientHeight + (jetRect.bottom - boardRect.bottom) * -1) + "px";

            // Damage rocks
            const rocks = document.querySelectorAll(".rocks:not(.explode)");
            for (let rock of rocks) {
                if (checkCollision(laserBeam, rock)) {
                    destroyRock(rock);
                }
            }

            // Damage boss
            if (bossActive && bossIsVulnerable && checkCollision(laserBeam, bossElement)) {
                damageBoss(0.25, false);
                const jetRect = jet.getBoundingClientRect();
                const bossRect = bossElement.getBoundingClientRect();
                createImpactParticles(jetRect.left + jetRect.width / 2, bossRect.bottom);
            }
        }, 20);

        // End laser after duration
        setTimeout(() => {
            laserIsActive = false;
            clearInterval(laserDamageInterval);
            laserBeam.remove();
            resetHitStreak();
        }, GAME_CONSTANTS.LASER_DURATION);

    }, GAME_CONSTANTS.LASER_CHARGE_TIME);
}

/**
 * Activate homing rockets ability
 */
function activateHomingRockets() {
    if (!homingRocketsReady) return;

    homingRocketsReady = false;
    const powerupElement = document.getElementById("homing-rocket-powerup");
    powerupElement.classList.add("on-cooldown");

    playSound("rocket-launch-sound");
    updatePowerupUI();

    // Find targets
    let targets;
    if (bossActive && bossIsVulnerable) {
        targets = Array(4).fill(bossElement);
    } else {
        targets = Array.from(document.querySelectorAll(".rocks:not(.explode)"))
            .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)
            .slice(0, 4);
    }

    // Fire rockets with stagger
    targets.forEach((target, index) => {
        setTimeout(() => fireSingleRocket(target, index), 100 * index);
    });

    // Cooldown countdown
    let cooldownRemaining = GAME_CONSTANTS.ROCKET_COOLDOWN / 1000;
    const statusElement = powerupElement.querySelector(".powerup-status");
    statusElement.textContent = `CD (${cooldownRemaining}s)`;

    const cooldownInterval = setInterval(() => {
        cooldownRemaining--;
        statusElement.textContent = `CD (${cooldownRemaining}s)`;

        if (cooldownRemaining <= 0) {
            clearInterval(cooldownInterval);
            homingRocketsReady = true;
            powerupElement.classList.remove("on-cooldown");
            updatePowerupUI();
            statusElement.textContent = "ROCKETS (Q)";
        }
    }, 1000);
}

/**
 * Fire a single homing rocket
 * @param {HTMLElement} target - The target element
 * @param {number} index - Rocket index for alternating sides
 */
function fireSingleRocket(target, index) {
    const rocket = document.createElement("div");
    rocket.classList.add("homing-rocket");
    board.appendChild(rocket);

    const jetRect = jet.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();

    const isLeft = index % 2 === 0;
    const startX = isLeft
        ? jetRect.left - boardRect.left - 5
        : jetRect.right - boardRect.left - rocket.clientWidth + 5;

    rocket.style.left = startX + "px";
    rocket.style.bottom = (jet.clientHeight + 10) + "px";
    rocket.style.transform = `rotate(${isLeft ? -90 : 90}deg)`;

    // Particle trail
    const trailInterval = setInterval(() => {
        if (!document.body.contains(rocket) || paused) {
            clearInterval(trailInterval);
            return;
        }

        const particle = document.createElement("div");
        const rocketRect = rocket.getBoundingClientRect();

        particle.classList.add("particle");
        particle.style.width = "5px";
        particle.style.height = "5px";
        particle.style.left = (rocketRect.left - boardRect.left + rocketRect.width / 2) + "px";
        particle.style.top = (rocketRect.top - boardRect.top + rocketRect.height / 2) + "px";

        board.appendChild(particle);
        setTimeout(() => particle.remove(), 400);
    }, 30);

    // Initial arc movement
    setTimeout(() => {
        const arcX = isLeft ? startX - 40 : startX + 40;
        rocket.style.left = arcX + "px";
        rocket.style.bottom = (jet.clientHeight + 80) + "px";
    }, 50);

    // Home in on target
    setTimeout(() => {
        if (!target || !document.body.contains(target)) {
            rocket.remove();
            clearInterval(trailInterval);
            return;
        }

        const targetRect = target.getBoundingClientRect();
        const rocketRect = rocket.getBoundingClientRect();

        const rocketCenterX = rocketRect.left + rocketRect.width / 2;
        const rocketCenterY = rocketRect.top + rocketRect.height / 2;
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;

        const angle = Math.atan2(targetCenterY - rocketCenterY, targetCenterX - rocketCenterX);
        rocket.style.transform = `rotate(${(angle * 180 / Math.PI) + 90}deg)`;
        rocket.style.left = (targetCenterX - boardRect.left - rocket.clientWidth / 2) + "px";
        rocket.style.top = (targetCenterY - boardRect.top - rocket.clientHeight / 2) + "px";
    }, 300);

    // Impact
    setTimeout(() => {
        if (!target || !document.body.contains(target)) {
            rocket.remove();
            clearInterval(trailInterval);
            return;
        }

        const targetRect = target.getBoundingClientRect();
        createImpactParticles(targetRect.left + targetRect.width / 2, targetRect.top + targetRect.height / 2);
        triggerScreenShake();
        destroyTarget(target, 5);

        rocket.remove();
        clearInterval(trailInterval);
    }, 800);
}

/**
 * Update power-up UI based on current state
 */
function updatePowerupUI() {
    // Check if laser should be ready
    if (consecutiveHits >= GAME_CONSTANTS.LASER_UNLOCK_HITS && !laserReady && !laserIsActive) {
        laserReady = true;
    }

    // Update laser button
    const laserButton = document.getElementById("laser-button");
    if (laserButton) laserButton.disabled = !laserReady;

    const laserPowerup = document.getElementById("laser-beam-powerup");
    if (laserPowerup) laserPowerup.classList.toggle("visible", laserReady);

    // Update rocket button
    const rocketButton = document.getElementById("rocket-button");
    const rocketPowerup = document.getElementById("homing-rocket-powerup");

    if (rocketButton) rocketButton.disabled = !homingRocketsReady;
    if (rocketPowerup) {
        rocketPowerup.classList.toggle("visible",
            homingRocketsReady || rocketPowerup.classList.contains("on-cooldown"));
    }
}

/**
 * Reset the hit streak (miss penalty)
 */
function resetHitStreak() {
    if (!laserIsActive) {
        consecutiveHits = 0;
        laserReady = false;
        updatePowerupUI();
    }
}

// =========================
// ROCK/ALIEN MANAGEMENT
// =========================

/**
 * Destroy a rock/alien with explosion effect
 * @param {HTMLElement} rock - The rock element to destroy
 */
function destroyRock(rock) {
    if (rock.classList.contains("explode")) return;

    rock.classList.add("explode");
    playSound("explosion-sound");

    // Chance to drop power-up
    if (Math.random() < GAME_CONSTANTS.POWERUP_DROP_CHANCE) {
        const rockRect = rock.getBoundingClientRect();
        createPowerupDrop(rockRect.left, rockRect.top);
    }

    handleAlienDefeat();
    setTimeout(() => rock.remove(), 300);
}

/**
 * Destroy a target (rock or boss)
 * @param {HTMLElement} target - The target element
 * @param {number} damage - Damage amount (for boss)
 */
function destroyTarget(target, damage = 1) {
    if (target.id === "boss") {
        damageBoss(damage, true);
    } else if (!target.classList.contains("explode")) {
        destroyRock(target);
    }
}

/**
 * Handle alien defeat (score, progression)
 */
function handleAlienDefeat() {
    score++;
    document.getElementById("score-value").innerText = score;
    document.getElementById("points").innerText = score;

    // Unlock rockets at score threshold
    if (score === GAME_CONSTANTS.ROCKET_UNLOCK_SCORE &&
        !document.querySelector("#homing-rocket-powerup.on-cooldown")) {
        homingRocketsReady = true;
        updatePowerupUI();
    }

    // Check for boss trigger
    if (gameMode === 'classic' && score >= GAME_CONSTANTS.BOSS_TRIGGER_SCORE && !bossActive) {
        initiateBossBattle();
    } else if (gameMode === 'endless' && !bossActive) {
        aliensKilledThisWave++;
        if (aliensKilledThisWave >= aliensPerWave) {
            initiateBossBattle();
        }
    }
}

// =========================
// PLAYER DAMAGE & LIVES
// =========================

/**
 * Handle player taking damage
 */
function loseLife() {
    if (playerIsDead) return;

    // Shield absorbs hit
    if (shieldActive) {
        shieldActive = false;
        shieldEffect.style.display = 'none';
        playSound("shield-break-sound");
        triggerScreenShake();

        // Remove shield status bar
        const shieldBar = document.getElementById('powerup-bar-shield');
        if (shieldBar) shieldBar.remove();
        return;
    }

    lives--;
    document.getElementById("lives-value").innerText = lives;

    if (lives <= 0) {
        playerIsDead = true;
        triggerScreenShake();
        playSound("explosion-sound");

        document.getElementById('jet-flare').style.display = 'none';
        jet.classList.add("jet-destroyed");

        clearInterval(rockSpawnInterval);
        gameRunning = false;

        setTimeout(() => {
            endGame("over");
        }, 2000);
    }
}

// =========================
// BOSS BATTLE
// =========================

/**
 * Start boss battle sequence
 */
function initiateBossBattle() {
    bossActive = true;
    bossIsVulnerable = false;

    // Stop rock spawning
    clearInterval(rockSpawnInterval);
    clearInterval(rockMoveInterval);

    // Clear existing rocks
    document.querySelectorAll('.rocks').forEach(rock => rock.remove());

    // Show boss alert
    const bossAlert = document.getElementById('boss-alert');
    bossAlert.style.display = 'block';

    setTimeout(() => {
        bossAlert.style.display = 'none';
        triggerScreenShake();

        // Get base settings for difficulty
        const baseSettings = DIFFICULTY_SETTINGS[gameLevel];

        // Apply wave scaling for endless mode
        if (gameMode === 'endless') {
            bossSettings.health = baseSettings.bossHealth + 25 * (currentWave - 1);
            bossSettings.speed = Math.min(5, baseSettings.bossSpeed + 0.2 * (currentWave - 1));
            bossSettings.fireRate = Math.max(400, baseSettings.bossFireRate - 50 * (currentWave - 1));
        } else {
            bossSettings = {
                health: baseSettings.bossHealth,
                speed: baseSettings.bossSpeed,
                fireRate: baseSettings.bossFireRate
            };
        }

        bossMaxHealth = bossSettings.health;
        bossHealth = bossMaxHealth;

        // Reset special attack state
        bossSpecialAttackTimer = 0;
        bossCurrentAttack = null;
        bossSpeedBoosted = false;
        bossBeamActive = false;

        // Setup boss elements
        bossElement = document.getElementById("boss");
        bossHealthBar = document.getElementById("boss-health-bar");
        bossHealthContainer = document.getElementById("boss-health-container");

        bossElement.style.display = "block";
        bossHealthContainer.style.display = "block";
        bossHealthBar.style.width = "100%";
        bossElement.style.left = (board.clientWidth / 2 - bossElement.clientWidth / 2) + "px";

        let direction = 1;
        let fireTimer = 0;

        bossLoopInterval = setInterval(() => {
            if (paused) return;

            const bossStyle = window.getComputedStyle(bossElement);
            let bossLeft = parseInt(bossStyle.getPropertyValue("left"));
            let bossTop = parseInt(bossStyle.getPropertyValue("top"));

            // Entry animation
            if (bossTop < 20) {
                bossElement.style.top = (bossTop + 1) + "px";
            } else if (!bossIsVulnerable) {
                bossIsVulnerable = true;
            }

            // Horizontal movement (affected by speed boost)
            if (!bossBeamActive) {
                const currentSpeed = bossSpeedBoosted
                    ? bossSettings.speed * GAME_CONSTANTS.BOSS_SPEED_BOOST_MULTIPLIER
                    : bossSettings.speed;

                let newLeft = bossLeft + currentSpeed * direction;

                if (newLeft <= 0) {
                    newLeft = 0;
                    direction = 1;
                } else if (newLeft >= board.clientWidth - bossElement.clientWidth) {
                    newLeft = board.clientWidth - bossElement.clientWidth;
                    direction = -1;
                }

                bossElement.style.left = newLeft + "px";
            }

            // Attack patterns
            if (bossIsVulnerable && !bossCurrentAttack) {
                // Normal firing
                fireTimer += 50;
                if (fireTimer >= bossSettings.fireRate) {
                    fireTimer = 0;
                    fireBossTripleShot();
                }

                // Special attack timer
                bossSpecialAttackTimer += 50;
                if (bossSpecialAttackTimer >= GAME_CONSTANTS.BOSS_SPECIAL_ATTACK_COOLDOWN) {
                    bossSpecialAttackTimer = 0;
                    // Randomly choose a special attack
                    const attacks = ['speedBoost', 'beam'];
                    bossCurrentAttack = attacks[Math.floor(Math.random() * attacks.length)];
                    executeSpecialAttack(bossCurrentAttack, direction);
                }
            }

            // Collision with player
            if (checkCollision(jet, bossElement) && !playerIsDead) {
                loseLife();
            }
        }, 50);

    }, 3200);
}

/**
 * Execute a boss special attack
 * @param {string} attackType - Type of attack ('speedBoost' or 'beam')
 * @param {number} direction - Current movement direction
 */
function executeSpecialAttack(attackType, direction) {
    switch (attackType) {
        case 'speedBoost':
            activateBossSpeedBoost();
            break;
        case 'beam':
            activateBossBeam();
            break;
    }
}

/**
 * Activate boss speed boost attack - boss dashes rapidly
 */
function activateBossSpeedBoost() {
    bossSpeedBoosted = true;

    // Visual feedback - boss glows red
    bossElement.classList.add('boss-speed-boost');
    triggerScreenShake();

    // Create warning text
    const warningText = document.createElement('div');
    warningText.classList.add('boss-attack-warning');
    warningText.textContent = '⚡ SPEED BOOST! ⚡';
    warningText.style.top = '60px';
    board.appendChild(warningText);

    setTimeout(() => {
        warningText.remove();
    }, 1000);

    // End speed boost after duration
    setTimeout(() => {
        bossSpeedBoosted = false;
        bossCurrentAttack = null;
        bossElement.classList.remove('boss-speed-boost');
    }, GAME_CONSTANTS.BOSS_SPEED_BOOST_DURATION);
}

/**
 * Activate boss beam attack with 3-second warning
 */
function activateBossBeam() {
    bossBeamActive = true;

    // Create warning overlay
    const warningContainer = document.createElement('div');
    warningContainer.id = 'boss-beam-warning';
    warningContainer.classList.add('boss-beam-warning');

    const warningText = document.createElement('div');
    warningText.classList.add('boss-beam-warning-text');
    warningText.innerHTML = '⚠️ DEADLY BEAM INCOMING ⚠️';
    warningContainer.appendChild(warningText);

    const countdownText = document.createElement('div');
    countdownText.classList.add('boss-beam-countdown');
    countdownText.textContent = '3';
    warningContainer.appendChild(countdownText);

    board.appendChild(warningContainer);
    bossBeamWarningElement = warningContainer;

    // Countdown
    let countdown = 3;
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            countdownText.textContent = countdown.toString();
        } else {
            clearInterval(countdownInterval);
        }
    }, 1000);

    // Create beam preview (warning line)
    const beamPreview = document.createElement('div');
    beamPreview.classList.add('boss-beam-preview');
    const bossRect = bossElement.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    beamPreview.style.left = (bossRect.left - boardRect.left + bossRect.width / 2 - 10) + 'px';
    beamPreview.style.top = (bossRect.bottom - boardRect.top) + 'px';
    board.appendChild(beamPreview);

    // Fire beam after warning time
    setTimeout(() => {
        // Remove warning elements
        warningContainer.remove();
        beamPreview.remove();
        bossBeamWarningElement = null;

        // Create the actual beam
        fireBossBeam();
    }, GAME_CONSTANTS.BOSS_BEAM_WARNING_TIME);
}

/**
 * Fire the boss beam attack
 */
function fireBossBeam() {
    const beam = document.createElement('div');
    beam.classList.add('boss-beam');
    board.appendChild(beam);
    bossBeamElement = beam;

    triggerScreenShake();

    // Position beam from boss
    const bossRect = bossElement.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const startX = bossRect.left - boardRect.left + bossRect.width / 2 - 25;

    beam.style.left = startX + 'px';
    beam.style.top = (bossRect.bottom - boardRect.top) + 'px';

    // Beam sweep direction
    let sweepDirection = Math.random() < 0.5 ? -1 : 1;
    let currentX = startX;

    // Beam damage and movement interval
    const beamInterval = setInterval(() => {
        if (paused) return;

        // Sweep the beam left/right
        currentX += sweepDirection * 3;

        // Bounce at edges
        if (currentX <= 0 || currentX >= board.clientWidth - 50) {
            sweepDirection *= -1;
        }

        beam.style.left = currentX + 'px';

        // Check collision with player
        if (checkCollision(beam, jet) && !playerIsDead) {
            loseLife();
        }
    }, 30);

    // End beam after duration
    setTimeout(() => {
        clearInterval(beamInterval);
        beam.classList.add('boss-beam-fade');
        setTimeout(() => {
            beam.remove();
            bossBeamElement = null;
            bossBeamActive = false;
            bossCurrentAttack = null;
        }, 300);
    }, GAME_CONSTANTS.BOSS_BEAM_DURATION);
}

/**
 * Create and fire a boss projectile
 * @param {number} startX - Starting X position
 * @param {number} startY - Starting Y position
 * @param {number} dirX - X direction (normalized)
 * @param {number} dirY - Y direction (normalized)
 */
function createAndFireBossProjectile(startX, startY, dirX, dirY) {
    const projectile = document.createElement("div");
    projectile.classList.add("boss-bullet");
    board.appendChild(projectile);

    const boardRect = board.getBoundingClientRect();
    const speed = 5;

    projectile.style.left = (startX - boardRect.left - projectile.clientWidth / 2) + "px";
    projectile.style.top = (startY - boardRect.top - projectile.clientHeight / 2) + "px";

    const projectileInterval = setInterval(() => {
        if (paused) return;

        let currentLeft = parseFloat(projectile.style.left);
        let currentTop = parseFloat(projectile.style.top);

        projectile.style.left = (currentLeft + dirX * speed) + "px";
        projectile.style.top = (currentTop + dirY * speed) + "px";

        // Check player collision
        if (checkCollision(projectile, jet) && !playerIsDead) {
            loseLife();
            projectile.remove();
            clearInterval(projectileInterval);
            return;
        }

        // Remove if out of bounds
        if (currentTop > board.clientHeight || currentTop < 0 ||
            currentLeft > board.clientWidth || currentLeft < 0) {
            projectile.remove();
            clearInterval(projectileInterval);
        }
    }, 30);
}

/**
 * Fire boss triple shot attack (aimed at player with spread)
 */
function fireBossTripleShot() {
    const bossRect = bossElement.getBoundingClientRect();
    const jetRect = jet.getBoundingClientRect();

    const startX = bossRect.left + bossRect.width / 2;
    const startY = bossRect.top + bossRect.height / 2;
    const targetX = jetRect.left + jetRect.width / 2;
    const targetY = jetRect.top + jetRect.height / 2;

    // Calculate direction to player
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const dirX = dx / distance;
    const dirY = dy / distance;

    // Calculate angle to player
    const angle = Math.atan2(dirY, dirX);

    // Create spread angles
    const spreadAmount = 0.3;
    const leftAngle = angle - spreadAmount;
    const rightAngle = angle + spreadAmount;

    // Fire three projectiles
    createAndFireBossProjectile(startX, startY, dirX, dirY);
    createAndFireBossProjectile(startX, startY, Math.cos(leftAngle), Math.sin(leftAngle));
    createAndFireBossProjectile(startX, startY, Math.cos(rightAngle), Math.sin(rightAngle));
}

/**
 * Damage the boss
 * @param {number} damage - Amount of damage
 * @param {boolean} knockback - Whether to apply knockback effect
 */
function damageBoss(damage, knockback = false) {
    if (!bossIsVulnerable) return;

    bossHealth -= damage;
    bossHealthBar.style.width = `${Math.max(0, bossHealth / bossMaxHealth) * 100}%`;

    // Hit effect
    bossElement.classList.add("boss-hit-effect");
    if (knockback) {
        bossElement.style.transform = "translateY(10px)";
    }

    setTimeout(() => {
        bossElement.classList.remove("boss-hit-effect");
        bossElement.style.transform = "";
    }, 150);

    // Check for boss defeat
    if (bossHealth <= 0) {
        bossActive = false;
        clearInterval(bossLoopInterval);
        bossElement.classList.add("explode");
        playSound("explosion-sound");

        if (gameMode === 'endless') {
            setTimeout(startNextWave, 1000);
        } else {
            setTimeout(() => endGame("win"), 500);
        }
    }
}

/**
 * Start the next wave in endless mode
 */
function startNextWave() {
    currentWave++;
    document.getElementById('wave-value').innerText = currentWave;

    // Reset boss
    bossElement.classList.remove("explode");
    bossElement.style.display = "none";
    bossHealthContainer.style.display = "none";

    // Reset wave tracking
    aliensKilledThisWave = 0;
    aliensPerWave += 5;

    // Increase difficulty
    rockFallSpeed = Math.min(15, baseRockFallSpeed + 0.5 * (currentWave - 1));
    rockSpawnRate = Math.max(300, baseRockSpawnRate - 50 * (currentWave - 1));

    setTimeout(startRockSpawning, 2000);
}

// =========================
// POWER-UP DROPS
// =========================

/**
 * Create a power-up drop at a position
 * @param {number} left - Left position
 * @param {number} top - Top position
 */
function createPowerupDrop(left, top) {
    let type;

    // 10% chance for life-up, otherwise random other type
    if (Math.random() < GAME_CONSTANTS.LIFE_UP_CHANCE) {
        type = 'life-up';
    } else {
        const otherTypes = ['shield', 'rapid-fire', 'spread-shot'];
        type = otherTypes[Math.floor(Math.random() * otherTypes.length)];
    }

    const powerup = document.createElement('div');
    powerup.classList.add('powerup-drop', `${type}-powerup`);
    powerup.dataset.type = type;

    const emojis = {
        shield: '🛡️',
        'rapid-fire': '🔥',
        'spread-shot': '✨',
        'life-up': '❤️'
    };
    powerup.innerHTML = emojis[type];

    const boardRect = board.getBoundingClientRect();
    powerup.style.left = (left - boardRect.left) + 'px';
    powerup.style.top = (top - boardRect.top) + 'px';

    board.appendChild(powerup);
}

/**
 * Activate a collected power-up
 * @param {string} type - The power-up type
 */
function activatePowerup(type) {
    playSound("powerup-collect-sound");

    // Clear any existing timer and bar for this power-up type
    if (powerupTimeouts[type]) {
        clearTimeout(powerupTimeouts[type].timer);
        if (powerupTimeouts[type].bar) {
            powerupTimeouts[type].bar.remove();
        }
    }

    switch (type) {
        case 'shield':
            if (!shieldActive) {
                shieldActive = true;
                shieldEffect.style.display = 'block';
                createPowerupBar(type);
            }
            break;

        case 'rapid-fire':
            rapidFireActive = true;
            createPowerupBar(type, GAME_CONSTANTS.RAPID_FIRE_DURATION);
            powerupTimeouts[type].timer = setTimeout(() => {
                rapidFireActive = false;
            }, GAME_CONSTANTS.RAPID_FIRE_DURATION);
            break;

        case 'spread-shot':
            spreadShotActive = true;
            createPowerupBar(type, GAME_CONSTANTS.SPREAD_SHOT_DURATION);
            powerupTimeouts[type].timer = setTimeout(() => {
                spreadShotActive = false;
            }, GAME_CONSTANTS.SPREAD_SHOT_DURATION);
            break;

        case 'life-up':
            lives++;
            document.getElementById("lives-value").innerText = lives;
            break;
    }
}

/**
 * Create a power-up status bar
 * @param {string} type - Power-up type
 * @param {number} duration - Duration in ms (null for infinite like shield)
 */
function createPowerupBar(type, duration) {
    const bar = document.createElement('div');
    bar.id = `powerup-bar-${type}`;
    bar.className = 'powerup-bar';

    const names = {
        shield: 'SHIELD',
        'rapid-fire': 'RAPID FIRE',
        'spread-shot': 'SPREAD SHOT'
    };

    const colors = {
        shield: 'var(--primary-glow)',
        'rapid-fire': 'var(--secondary-glow)',
        'spread-shot': 'var(--powerup-glow)'
    };

    bar.style.borderColor = colors[type];
    bar.innerHTML = `
        <div class="powerup-bar-name">${names[type]}</div>
        <div class="powerup-bar-timer">
            <div class="powerup-bar-progress" style="background-color: ${colors[type]};"></div>
        </div>
    `;

    powerupBarsContainer.appendChild(bar);

    if (duration) {
        const progressBar = bar.querySelector('.powerup-bar-progress');
        progressBar.style.animation = `deplete ${duration / 1000}s linear forwards`;
        powerupTimeouts[type] = { bar: bar };
        setTimeout(() => { bar.remove(); }, duration);
    } else {
        // For shield, which has no duration
        powerupTimeouts[type] = { bar: bar };
    }
}

// =========================
// GAME FLOW
// =========================

/**
 * Start the game with selected settings
 * @param {string} level - Difficulty level (easy, medium, hard)
 * @param {string} mode - Game mode (classic, endless)
 */
function startGame(level, mode) {
    gameRunning = true;
    gameLevel = level;
    gameMode = mode;

    // Hide start screen, show game header
    document.getElementById("start-screen").style.display = "none";
    document.getElementById('game-header').style.visibility = 'visible';

    // Show wave display for endless mode
    if (gameMode === 'endless') {
        document.getElementById('wave-display').style.display = 'block';
    }

    // Show touch controls on mobile devices
    if (isTouchDevice()) {
        document.getElementById('touch-controls').style.display = 'flex';
    } else {
        // Show desktop abilities
        document.getElementById('desktop-abilities').style.display = 'flex';
    }

    setupEventListeners();

    // Apply difficulty settings
    const settings = DIFFICULTY_SETTINGS[level];
    jetSpeed = settings.jetSpeed;
    baseRockFallSpeed = settings.rockFallSpeed;
    baseRockSpawnRate = settings.rockSpawnRate;
    rockFallSpeed = baseRockFallSpeed;
    rockSpawnRate = baseRockSpawnRate;

    startRockSpawning();

    // Power-up movement interval
    powerupMoveInterval = setInterval(() => {
        if (paused) return;

        document.querySelectorAll(".powerup-drop").forEach(powerup => {
            let top = parseInt(powerup.style.top);

            if (top >= board.clientHeight) {
                powerup.remove();
            } else {
                powerup.style.top = (top + GAME_CONSTANTS.POWERUP_FALL_SPEED) + 'px';

                if (checkCollision(powerup, jet)) {
                    activatePowerup(powerup.dataset.type);
                    powerup.remove();
                }
            }
        });
    }, 50);
}

/**
 * Start spawning rocks/aliens
 */
function startRockSpawning() {
    rockSpawnInterval = setInterval(() => {
        if (paused || bossActive) return;

        const rock = document.createElement("div");
        rock.classList.add("rocks");

        const rand = Math.random();
        if (rand < 0.2) {
            rock.classList.add("alien-2");
            rock.dataset.health = 2;
        } else if (rand < 0.5) {
            rock.classList.add("alien-3");
            rock.dataset.speedModifier = 1.3;
        }

        rock.style.left = Math.floor(Math.random() * (board.clientWidth - 60)) + "px";
        rock.style.top = "-60px";

        board.appendChild(rock);
    }, rockSpawnRate);

    rockMoveInterval = setInterval(() => {
        if (paused || bossActive) return;

        document.querySelectorAll(".rocks:not(.explode)").forEach(rock => {
            // Check collision with player
            if (checkCollision(rock, jet) && !playerIsDead) {
                destroyRock(rock);
                loseLife();
                return;
            }

            const rockStyle = window.getComputedStyle(rock);
            let top = parseInt(rockStyle.getPropertyValue("top"));
            const speedModifier = parseFloat(rock.dataset.speedModifier) || 1;
            const newTop = top + rockFallSpeed * speedModifier;

            if (newTop >= board.clientHeight) {
                rock.remove();
                if (!playerIsDead) loseLife();
            } else {
                rock.style.top = newTop + "px";
            }
        });
    }, 100);
}

/**
 * End the game
 * @param {string} result - "win" or "over"
 */
function endGame(result) {
    gameRunning = false;

    // Clear all intervals
    clearInterval(rockMoveInterval);
    clearInterval(rockSpawnInterval);
    clearInterval(bossLoopInterval);
    clearInterval(powerupMoveInterval);

    if (laserIsActive) {
        clearInterval(laserDamageInterval);
        const laserBeam = document.querySelector(".laser-beam");
        if (laserBeam) laserBeam.remove();
    }

    // Clear all power-up bars
    powerupBarsContainer.innerHTML = '';

    // Save high score
    const isNewHighScore = saveHighScore(score);

    // Update final score displays
    const finalScoreEl = document.getElementById('final-score');
    const highScoreEl = document.getElementById('high-score-display');

    if (finalScoreEl) finalScoreEl.textContent = score;
    if (highScoreEl) highScoreEl.textContent = highScore;

    // Play appropriate sound
    if (result !== "win") {
        playSound("gameover-sound");
    }

    // Show appropriate screen
    const screenId = result === "win" ? "win-screen" : "game-over";
    document.getElementById(screenId).style.display = "flex";
}

/**
 * Restart the game
 */
function restartGame() {
    window.location.reload();
}

// =========================
// INITIALIZATION
// =========================

/**
 * Initialize the game on page load
 */
function init() {
    initAudio();
    updateMuteButtonUI();

    // Show appropriate instructions based on device
    if (isTouchDevice()) {
        const desktopInstructions = document.getElementById('desktop-instructions');
        const mobileInstructions = document.getElementById('mobile-instructions');

        if (desktopInstructions) desktopInstructions.style.display = 'none';
        if (mobileInstructions) mobileInstructions.style.display = 'block';
    }

    // Display high score on start screen
    const highScoreStartEl = document.getElementById('high-score-start');
    if (highScoreStartEl) {
        highScoreStartEl.textContent = `High Score: ${highScore}`;
    }
}

// Run initialization
init();