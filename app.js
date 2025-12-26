// DOM Elements
const jet = document.getElementById("jet");
const board = document.getElementById("board");
const shieldEffect = document.getElementById("shield-effect");
const powerupBarsContainer = document.getElementById("powerup-bars-container");

// Game State & Intervals
let lives = 3, score = 0, gameRunning = false, paused = false, gameLevel = "medium", gameMode = "classic";
let rockMoveInterval, rockSpawnInterval, bossLoopInterval, laserDamageInterval, powerupMoveInterval;
let baseRockFallSpeed, baseRockSpawnRate;

// Endless Mode State
let currentWave = 1;
let aliensKilledThisWave = 0;
let aliensPerWave = 20;

// Player & Control State
let moveLeft = false, moveRight = false, moveUp = false, moveDown = false;
let canShoot = true;
let isTouching = false;
let touchOffsetX, touchOffsetY;
let playerIsDead = false;

// Joystick State
let joystickActive = false;
let joystickBaseX = 0, joystickBaseY = 0;
let joystickStickX = 0, joystickStickY = 0;
let joystickMaxDistance = 0;

// Power-up State
let consecutiveHits = 0, homingRocketsReady = false, laserReady = false, laserIsActive = false;
let shieldActive = false;
let rapidFireActive = false;
let spreadShotActive = false;
let powerupTimeouts = {}; // Object to store power-up timers

// Boss State
let bossActive = false, bossIsVulnerable = false;
let bossHealth, bossMaxHealth, bossSettings = {};
let bossElement, bossHealthBar, bossHealthContainer;

const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

function mainGameLoop() {
  if (paused || !gameRunning) { requestAnimationFrame(mainGameLoop); return; }
  if (!playerIsDead) {
      // Use joystick input for mobile, keyboard input for desktop
      if (isTouchDevice() && joystickActive) {
          // Joystick movement is handled in joystick handlers
      } else if (!isTouching) {
          let left = parseInt(window.getComputedStyle(jet).getPropertyValue("left"));
          let bottom = parseInt(window.getComputedStyle(jet).getPropertyValue("bottom"));
          if (moveLeft && left > 0) jet.style.left = (left - jetSpeed) + "px";
          if (moveRight && left < (board.clientWidth - jet.clientWidth)) jet.style.left = (left + jetSpeed) + "px";
          if (moveUp && bottom < (board.clientHeight - jet.clientHeight)) jet.style.bottom = (bottom + jetSpeed) + "px";
          if (moveDown && bottom > 10) jet.style.bottom = (bottom - jetSpeed) + "px";
      }
      const tiltAngle = 10;
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
mainGameLoop();

function setupEventListeners() {
    if (isTouchDevice()) {
        // Setup joystick
        setupJoystick();
        // Keep old touch controls as fallback (but joystick takes priority)
        board.addEventListener('touchstart', handleTouchStart, { passive: false });
        board.addEventListener('touchmove', handleTouchMove, { passive: false });
        board.addEventListener('touchend', handleTouchEnd, { passive: false });
        // Button controls
        document.getElementById('fire-button').addEventListener('touchstart', (e) => { e.preventDefault(); if(canShoot) fireBullet(); });
        document.getElementById('rocket-button').addEventListener('touchstart', (e) => { e.preventDefault(); activateHomingRockets(); });
        document.getElementById('laser-button').addEventListener('touchstart', (e) => { e.preventDefault(); activateLaser(); });
        const pauseButton = document.getElementById('pause-button');
        if (pauseButton) {
            pauseButton.addEventListener('touchstart', (e) => { e.preventDefault(); if (gameRunning) togglePause(); });
        }
    } else {
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
    }
}

function handleKeyDown(e) {
  const key = e.key.toLowerCase();
  if (key === "p") { if (gameRunning) togglePause(); return; }
  if (playerIsDead) return;
  if (homingRocketsReady && key === 'q') { activateHomingRockets(); return; }
  if (laserReady && key === 'e') { activateLaser(); return; }
  if (!gameRunning || paused) return;
  if (["arrowleft", "a"].includes(key)) moveLeft = true;
  if (["arrowright", "d"].includes(key)) moveRight = true;
  if (["arrowup", "w"].includes(key)) moveUp = true;
  if (["arrowdown", "s"].includes(key)) moveDown = true;
  if (key === " " && canShoot) { e.preventDefault(); fireBullet(); }
}
function handleKeyUp(e) {
  const key = e.key.toLowerCase();
  if (["arrowleft", "a"].includes(key)) moveLeft = false;
  if (["arrowright", "d"].includes(key)) moveRight = false;
  if (["arrowup", "w"].includes(key)) moveUp = false;
  if (["arrowdown", "s"].includes(key)) moveDown = false;
}
function handleTouchStart(e) {
    if (playerIsDead) return;
    // Don't activate drag if touching joystick area
    const joystickContainer = document.getElementById('joystick-container');
    if (joystickContainer && joystickContainer.contains(e.target)) return;
    if (e.target === jet) {
        e.preventDefault(); isTouching = true;
        const touch = e.touches[0]; const jetRect = jet.getBoundingClientRect();
        touchOffsetX = touch.clientX - jetRect.left;
        touchOffsetY = touch.clientY - jetRect.top;
    }
}
function handleTouchMove(e) {
    if (playerIsDead) return;
    if (isTouching) {
        e.preventDefault(); const touch = e.touches[0];
        let newX = touch.clientX - touchOffsetX; let newY = touch.clientY - touchOffsetY;
        const boardRect = board.getBoundingClientRect();
        newX = Math.max(boardRect.left, Math.min(newX, boardRect.right - jet.clientWidth));
        newY = Math.max(boardRect.top, Math.min(newY, boardRect.bottom - jet.clientHeight));
        jet.style.left = (newX - boardRect.left) + 'px';
        jet.style.bottom = (boardRect.bottom - newY - jet.clientHeight) + 'px';
    }
}
function handleTouchEnd(e) { e.preventDefault(); isTouching = false; }
function togglePause(){
    paused=!paused;
    const pauseScreen = document.getElementById("pause-screen");
    const pauseMessage = document.getElementById("pause-message");
    pauseScreen.style.display = paused ? "flex" : "none";
    if (pauseMessage) {
        pauseMessage.textContent = isTouchDevice() ? "Tap ⏸ to Resume" : "Press 'P' to Resume";
    }
}

// Joystick Functions
function setupJoystick() {
    const joystickContainer = document.getElementById('joystick-container');
    const joystickStick = document.getElementById('joystick-stick');
    
    if (!joystickContainer || !joystickStick) return;
    
    const joystickBase = document.getElementById('joystick-base');
    const baseRect = joystickBase.getBoundingClientRect();
    joystickMaxDistance = baseRect.width * 0.35; // Max distance stick can move from center
    
    joystickContainer.addEventListener('touchstart', handleJoystickStart, { passive: false });
    joystickContainer.addEventListener('touchmove', handleJoystickMove, { passive: false });
    joystickContainer.addEventListener('touchend', handleJoystickEnd, { passive: false });
    joystickContainer.addEventListener('touchcancel', handleJoystickEnd, { passive: false });
}

function handleJoystickStart(e) {
    if (playerIsDead || !gameRunning || paused) return;
    e.preventDefault();
    e.stopPropagation(); // Prevent other touch handlers
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

function handleJoystickMove(e) {
    if (!joystickActive) return;
    e.preventDefault();
    e.stopPropagation(); // Prevent other touch handlers
    const touch = e.touches[0];
    if (touch) {
        updateJoystickPosition(touch.clientX, touch.clientY);
    }
}

function handleJoystickEnd(e) {
    if (!joystickActive) return;
    e.preventDefault();
    e.stopPropagation(); // Prevent other touch handlers
    joystickActive = false;
    const joystickContainer = document.getElementById('joystick-container');
    const joystickStick = document.getElementById('joystick-stick');
    joystickContainer.classList.remove('active');
    
    // Reset joystick stick to center
    joystickStick.style.transform = 'translate(-50%, -50%)';
    
    // Reset movement
    moveLeft = moveRight = moveUp = moveDown = false;
}

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
    const threshold = 0.3; // Dead zone threshold
    moveLeft = normalizedX < -threshold;
    moveRight = normalizedX > threshold;
    moveUp = normalizedY < -threshold;
    moveDown = normalizedY > threshold;
    
    // Apply movement to jet
    if (!playerIsDead && gameRunning && !paused) {
        let left = parseInt(window.getComputedStyle(jet).getPropertyValue("left"));
        let bottom = parseInt(window.getComputedStyle(jet).getPropertyValue("bottom"));
        
        // Apply movement with intensity based on joystick distance
        const intensity = Math.min(1, distance / joystickMaxDistance);
        const speed = jetSpeed * intensity;
        
        if (moveLeft && left > 0) jet.style.left = (left - speed) + "px";
        if (moveRight && left < (board.clientWidth - jet.clientWidth)) jet.style.left = (left + speed) + "px";
        if (moveUp && bottom < (board.clientHeight - jet.clientHeight)) jet.style.bottom = (bottom + speed) + "px";
        if (moveDown && bottom > 10) jet.style.bottom = (bottom - speed) + "px";
    }
}

function fireBullet() {
    if (!canShoot) return;
    const cooldown = rapidFireActive ? 100 : 250;
    canShoot = false;
    setTimeout(() => { canShoot = true; }, cooldown);
    document.getElementById("shoot-sound").play();
    if (spreadShotActive) {
        createSingleBullet(0, 0);
        createSingleBullet(-15, -0.2);
        createSingleBullet(15, 0.2);
    } else {
        createSingleBullet(0, 0);
    }
}

function createSingleBullet(offsetX, angle) {
    const bullet = document.createElement("div");
    bullet.classList.add("bullets");
    board.appendChild(bullet);
    let jetRect = jet.getBoundingClientRect();
    let boardRect = board.getBoundingClientRect();
    let startX = jetRect.left - boardRect.left + jetRect.width / 2 - bullet.clientWidth / 2 + offsetX;
    let startBottom = jet.clientHeight + (jetRect.bottom - boardRect.bottom) * -1;
    bullet.style.left = startX + "px";
    bullet.style.bottom = startBottom + "px";
    let bulletInterval = setInterval(() => {
        if (paused) return;
        let currentBottom = parseInt(bullet.style.bottom);
        let currentLeft = parseInt(bullet.style.left);
        let newBottom = currentBottom + 10;
        let newLeft = currentLeft + (10 * angle);
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

function checkBulletCollision(bullet, bulletInterval) {
    if (bossActive && bossIsVulnerable && checkCollision(bullet, bossElement)) {
        damageBoss(1);
        bullet.remove();
        clearInterval(bulletInterval);
        return true;
    }
    if (!bossActive) {
        for (let rock of document.querySelectorAll(".rocks:not(.explode)")) {
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

function activateLaser(){if(laserIsActive||!laserReady)return;laserReady=!1,laserIsActive=!0,updatePowerupUI(),jet.classList.add("jet-charge"),document.getElementById("laser-charge-sound").play(),setTimeout(()=>{jet.classList.remove("jet-charge"),document.getElementById("laser-fire-sound").play(),triggerScreenShake();const e=document.createElement("div");e.classList.add("laser-beam"),board.appendChild(e),laserDamageInterval=setInterval(()=>{if(paused)return;let t=jet.getBoundingClientRect();e.style.left=t.left-board.getBoundingClientRect().left+t.width/2-5+"px",e.style.bottom=jet.clientHeight+(t.bottom-board.getBoundingClientRect().bottom)*-1+"px";for(let o of document.querySelectorAll(".rocks:not(.explode)"))checkCollision(e,o)&&destroyRock(o);bossActive&&bossIsVulnerable&&checkCollision(e,bossElement)&&(damageBoss(.25,!1),createImpactParticles(t.left+t.width/2,bossElement.getBoundingClientRect().bottom))},20),setTimeout(()=>{laserIsActive=!1,clearInterval(laserDamageInterval),e.remove(),resetHitStreak()},3e3)},200)}
function activateHomingRockets(){if(!homingRocketsReady)return;homingRocketsReady=!1;const e=document.getElementById("homing-rocket-powerup");e.classList.add("on-cooldown"),document.getElementById("rocket-launch-sound").play();updatePowerupUI();let t=bossActive&&bossIsVulnerable?Array(4).fill(bossElement):Array.from(document.querySelectorAll(".rocks:not(.explode)")).sort((e,t)=>t.getBoundingClientRect().top-e.getBoundingClientRect().top).slice(0,4);t.forEach((e,t)=>{setTimeout(()=>fireSingleRocket(e,t),100*t)});let o=15;const s=e.querySelector(".powerup-status");s.textContent=`CD (${o}s)`;let l=setInterval(()=>{o--,s.textContent=`CD (${o}s)`,o<=0&&(clearInterval(l),homingRocketsReady=!0,e.classList.remove("on-cooldown"),updatePowerupUI(),s.textContent="ROCKETS (Q)")},1e3)}
function fireSingleRocket(e,t){const o=document.createElement("div");o.classList.add("homing-rocket"),board.appendChild(o);let s=jet.getBoundingClientRect(),l=board.getBoundingClientRect();const n=t%2==0,i=n?s.left-l.left-5:s.right-l.left-o.clientWidth+5;o.style.left=i+"px",o.style.bottom=jet.clientHeight+10+"px",o.style.transform=`rotate(${n?-90:90}deg)`;const a=setInterval(()=>{if(!document.body.contains(o)||paused)return void clearInterval(a);const e=document.createElement("div"),t=o.getBoundingClientRect();e.classList.add("particle"),e.style.width="5px",e.style.height="5px",e.style.left=t.left-l.left+t.width/2+"px",e.style.top=t.top-l.top+t.height/2+"px",board.appendChild(e),setTimeout(()=>e.remove(),400)},30);setTimeout(()=>{const e=n?i-40:i+40;o.style.left=e+"px",o.style.bottom=jet.clientHeight+80+"px"},50),setTimeout(()=>{if(!e||!document.body.contains(e))return o.remove(),void clearInterval(a);const t=e.getBoundingClientRect(),s=o.getBoundingClientRect(),n=s.left+s.width/2,r=s.top+s.height/2,c=t.left+t.width/2,d=t.top+t.height/2;o.style.transform=`rotate(${180/Math.PI*Math.atan2(d-r,c-n)+90}deg)`,o.style.left=c-l.left-o.clientWidth/2+"px",o.style.top=d-l.top-o.clientHeight/2+"px"},300),setTimeout(()=>{if(!e||!document.body.contains(e))return o.remove(),void clearInterval(a);const t=e.getBoundingClientRect();createImpactParticles(t.left+t.width/2,t.top+t.height/2),triggerScreenShake(),destroyTarget(e,5),o.remove(),clearInterval(a)},800)}
function updatePowerupUI(){if(consecutiveHits>=7&&!laserReady&&!laserIsActive)laserReady=!0;document.getElementById("laser-button").disabled=!laserReady,document.getElementById("laser-beam-powerup").classList.toggle("visible",laserReady);const e=document.getElementById("homing-rocket-powerup");document.getElementById("rocket-button").disabled=!homingRocketsReady,e.classList.toggle("visible",homingRocketsReady||e.classList.contains("on-cooldown"))}
function resetHitStreak(){laserIsActive||(consecutiveHits=0,laserReady=!1,updatePowerupUI())}

function destroyRock(e) {
    if (e.classList.contains("explode")) return;
    e.classList.add("explode");
    document.getElementById("explosion-sound").play();
    if (Math.random() < 0.2) {
        const rockRect = e.getBoundingClientRect();
        createPowerupDrop(rockRect.left, rockRect.top);
    }
    handleAlienDefeat();
    setTimeout(() => e.remove(), 300);
}

function destroyTarget(e,t=1){"boss"===e.id?damageBoss(t,!0):e.classList.contains("explode")||destroyRock(e)}

function handleAlienDefeat() {
    score++;
    document.getElementById("score-value").innerText = score;
    document.getElementById("points").innerText = score;
    if (score === 7 && !document.querySelector("#homing-rocket-powerup.on-cooldown")) {
        homingRocketsReady = true;
        updatePowerupUI();
    }
    if (gameMode === 'classic' && score >= 20 && !bossActive) {
        initiateBossBattle();
    } else if (gameMode === 'endless' && !bossActive) {
        aliensKilledThisWave++;
        if (aliensKilledThisWave >= aliensPerWave) {
            initiateBossBattle();
        }
    }
}

function loseLife() {
    if (playerIsDead) return;
    if (shieldActive) {
        shieldActive = false;
        shieldEffect.style.display = 'none';
        document.getElementById("shield-break-sound").play();
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
        document.getElementById("explosion-sound").play();
        document.getElementById('jet-flare').style.display = 'none';
        jet.classList.add("jet-destroyed");
        clearInterval(rockSpawnInterval);
        gameRunning = false;
        setTimeout(() => {
            endGame("over");
        }, 2000);
    }
}

function checkCollision(e,t){if(!e||!t)return!1;const o=e.getBoundingClientRect(),s=t.getBoundingClientRect();return!(o.right<s.left||o.left>s.right||o.bottom<s.top||o.top>s.bottom)}
function triggerScreenShake(){board.classList.add("shake"),setTimeout(()=>board.classList.remove("shake"),200)}
function createImpactParticles(e,t){for(let o=0;o<10;o++){const s=document.createElement("div");s.classList.add("particle"),s.style.left=e+"px",s.style.top=t+"px";const l=2*Math.PI*Math.random(),n=50*Math.random()+20;s.style.setProperty("--x",Math.cos(l)*n+"px"),s.style.setProperty("--y",Math.sin(l)*n+"px"),board.appendChild(s),setTimeout(()=>s.remove(),500)}}

function initiateBossBattle() {
    bossActive = true;
    bossIsVulnerable = false;
    clearInterval(rockSpawnInterval);
    clearInterval(rockMoveInterval);
    document.querySelectorAll('.rocks').forEach(e => e.remove());
    const bossAlert = document.getElementById('boss-alert');
    bossAlert.style.display = 'block';
    setTimeout(() => {
        bossAlert.style.display = 'none';
        triggerScreenShake();
        const baseSettings = {
            easy: { health: 100, speed: 1, fireRate: 1500 },
            medium: { health: 150, speed: 2, fireRate: 1000 },
            hard: { health: 200, speed: 3, fireRate: 850 }
        }[gameLevel];
        if (gameMode === 'endless') {
            bossSettings.health = baseSettings.health + 25 * (currentWave - 1);
            bossSettings.speed = Math.min(5, baseSettings.speed + 0.2 * (currentWave - 1));
            bossSettings.fireRate = Math.max(400, baseSettings.fireRate - 50 * (currentWave - 1));
        } else {
            bossSettings = { ...baseSettings };
        }
        bossMaxHealth = bossSettings.health;
        bossHealth = bossMaxHealth;
        bossElement = document.getElementById("boss");
        bossHealthBar = document.getElementById("boss-health-bar");
        bossHealthContainer = document.getElementById("boss-health-container");
        bossElement.style.display = "block";
        bossHealthContainer.style.display = "block";
        bossHealthBar.style.width = "100%";
        bossElement.style.left = board.clientWidth / 2 - bossElement.clientWidth / 2 + "px";
        let e = 1, t = 0;
        bossLoopInterval = setInterval(() => {
            if (paused) return;
            let o = parseInt(window.getComputedStyle(bossElement).getPropertyValue("left"));
            let s = parseInt(window.getComputedStyle(bossElement).getPropertyValue("top"));
            s < 20 ? bossElement.style.top = s + 1 + "px" : bossIsVulnerable || (bossIsVulnerable = true);
            if (bossElement.style.transform === '') {
                let l = o + bossSettings.speed * e;
                l <= 0 ? (l = 0, e = 1) : l >= board.clientWidth - bossElement.clientWidth && (l = board.clientWidth - bossElement.clientWidth, e = -1);
                bossElement.style.left = l + "px";
            }
            if (bossIsVulnerable) {
                t += 50;
                if (t >= bossSettings.fireRate) { t = 0; fireBossTripleShot(); }
            }
            if (checkCollision(jet, bossElement) && !playerIsDead) loseLife();
        }, 50);
    }, 3200);
}

function createAndFireBossProjectile(e,t,o,s){const l=document.createElement("div");l.classList.add("boss-bullet"),board.appendChild(l);const n=board.getBoundingClientRect(),i=5;l.style.left=e-n.left-l.clientWidth/2+"px",l.style.top=t-n.top-l.clientHeight/2+"px";let a=setInterval(()=>{if(paused)return;let e=parseFloat(l.style.left),t=parseFloat(l.style.top);if(l.style.left=e+o*i+"px",l.style.top=t+s*i+"px",checkCollision(l,jet)&&!playerIsDead)return loseLife(),l.remove(),void clearInterval(a);t>board.clientHeight||t<0||e>board.clientWidth||e<0?(l.remove(),clearInterval(a)):void 0},30)}
function fireBossTripleShot(){const e=bossElement.getBoundingClientRect(),t=jet.getBoundingClientRect(),o=e.left+e.width/2,s=e.top+e.height/2,l=t.left+t.width/2,n=t.top+t.height/2,i=l-o,a=n-s,d=Math.sqrt(i*i+a*a);const r=i/d,c=a/d,u=Math.atan2(c,r);const h=u-.3,p=Math.cos(h),m=Math.sin(h);const f=u+.3,g=Math.cos(f),y=Math.sin(f);createAndFireBossProjectile(o,s,r,c),createAndFireBossProjectile(o,s,p,m),createAndFireBossProjectile(o,s,g,y)}

function damageBoss(e, t = !1) {
    if (!bossIsVulnerable) return;
    bossHealth -= e;
    bossHealthBar.style.width = `${Math.max(0, bossHealth / bossMaxHealth) * 100}%`;
    bossElement.classList.add("boss-hit-effect");
    if(t) bossElement.style.transform = "translateY(10px)";
    setTimeout(() => {
        bossElement.classList.remove("boss-hit-effect");
        bossElement.style.transform = "";
    }, 150);
    if (bossHealth <= 0) {
        bossActive = false;
        clearInterval(bossLoopInterval);
        bossElement.classList.add("explode");
        document.getElementById("explosion-sound").play();
        if (gameMode === 'endless') {
            setTimeout(startNextWave, 1000);
        } else {
            setTimeout(() => endGame("win"), 500);
        }
    }
}

function startNextWave() {
    currentWave++;
    document.getElementById('wave-value').innerText = currentWave;
    bossElement.classList.remove("explode");
    bossElement.style.display = "none";
    bossHealthContainer.style.display = "none";
    aliensKilledThisWave = 0;
    aliensPerWave += 5;
    rockFallSpeed = Math.min(15, baseRockFallSpeed + 0.5 * (currentWave - 1));
    rockSpawnRate = Math.max(300, baseRockSpawnRate - 50 * (currentWave - 1));
    setTimeout(startRockSpawning, 2000);
}

function createPowerupDrop(left, top) {
    let type;
    if (Math.random() < 0.1) {
        type = 'life-up';
    } else {
        const otherTypes = ['shield', 'rapid-fire', 'spread-shot'];
        type = otherTypes[Math.floor(Math.random() * otherTypes.length)];
    }
    const powerup = document.createElement('div');
    powerup.classList.add('powerup-drop', `${type}-powerup`);
    powerup.dataset.type = type;
    const emojis = { shield: '🛡️', 'rapid-fire': '🔥', 'spread-shot': '✨', 'life-up': '❤️' };
    powerup.innerHTML = emojis[type];
    const boardRect = board.getBoundingClientRect();
    powerup.style.left = (left - boardRect.left) + 'px';
    powerup.style.top = (top - boardRect.top) + 'px';
    board.appendChild(powerup);
}

// --- REPLACED FUNCTION ---
function activatePowerup(type) {
    document.getElementById("powerup-collect-sound").play();
    
    // Clear any existing timer and bar for this power-up type
    if (powerupTimeouts[type]) {
        clearTimeout(powerupTimeouts[type].timer);
        powerupTimeouts[type].bar.remove();
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
            createPowerupBar(type, 8000);
            powerupTimeouts[type].timer = setTimeout(() => { rapidFireActive = false; }, 8000);
            break;
        case 'spread-shot':
            spreadShotActive = true;
            createPowerupBar(type, 10000);
            powerupTimeouts[type].timer = setTimeout(() => { spreadShotActive = false; }, 10000);
            break;
        case 'life-up':
            lives++;
            document.getElementById("lives-value").innerText = lives;
            break;
    }
}

// --- NEW FUNCTION ---
function createPowerupBar(type, duration) {
    const bar = document.createElement('div');
    bar.id = `powerup-bar-${type}`;
    bar.className = 'powerup-bar';

    const names = { shield: 'SHIELD', 'rapid-fire': 'RAPID FIRE', 'spread-shot': 'SPREAD SHOT' };
    const colors = { shield: 'var(--primary-glow)', 'rapid-fire': 'var(--secondary-glow)', 'spread-shot': 'var(--powerup-glow)' };

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
    } else { // For shield, which has no duration
        powerupTimeouts[type] = { bar: bar };
    }
}

function startGame(level, mode) {
    gameRunning = true;
    gameLevel = level;
    gameMode = mode;
    document.getElementById("start-screen").style.display = "none";
    document.getElementById('game-header').style.visibility = 'visible';
    if (gameMode === 'endless') {
        document.getElementById('wave-display').style.display = 'block';
    }
    // Show touch controls on mobile devices
    if (isTouchDevice()) {
        document.getElementById('touch-controls').style.display = 'flex';
    }
    setupEventListeners();
    const jetSpeedSettings = { easy: 8, medium: 10, hard: 12 };
    const rockFallSpeedSettings = { easy: 2.5, medium: 4, hard: 6 };
    const rockSpawnRateSettings = { easy: 2400, medium: 1600, hard: 1000 };
    jetSpeed = jetSpeedSettings[level];
    baseRockFallSpeed = rockFallSpeedSettings[level];
    baseRockSpawnRate = rockSpawnRateSettings[level];
    rockFallSpeed = baseRockFallSpeed;
    rockSpawnRate = baseRockSpawnRate;
    startRockSpawning();
    
    powerupMoveInterval = setInterval(() => {
        if (paused) return;
        document.querySelectorAll(".powerup-drop").forEach(powerup => {
            let top = parseInt(powerup.style.top);
            if (top >= board.clientHeight) {
                powerup.remove();
            } else {
                powerup.style.top = top + 3 + 'px';
                if (checkCollision(powerup, jet)) {
                    activatePowerup(powerup.dataset.type);
                    powerup.remove();
                }
            }
        });
    }, 50);
}

function startRockSpawning(){
    rockSpawnInterval=setInterval(()=>{
        if(paused || bossActive) return;
        const rock=document.createElement("div");
        rock.classList.add("rocks");
        const rand=Math.random();
        if(rand<.2){rock.classList.add("alien-2"),rock.dataset.health=2}
        else if(rand<.5){rock.classList.add("alien-3"),rock.dataset.speedModifier=1.3}
        rock.style.left=Math.floor(Math.random()*(board.clientWidth-60))+"px",rock.style.top="-60px"
        ,board.appendChild(rock)
    },rockSpawnRate);

    rockMoveInterval=setInterval(()=>{
        if(paused || bossActive) return;
        document.querySelectorAll(".rocks:not(.explode)").forEach(rock=>{
            if(checkCollision(rock,jet) && !playerIsDead)return destroyRock(rock),void loseLife();
            let top=parseInt(window.getComputedStyle(rock).getPropertyValue("top"));
            const speedModifier=parseFloat(rock.dataset.speedModifier)||1;
            const newTop=top+rockFallSpeed*speedModifier;
            if(newTop>=board.clientHeight){rock.remove(); if(!playerIsDead) loseLife();}
            else{rock.style.top=newTop+"px"}
        })
    },100)
}

function endGame(result) {
    gameRunning = false;
    clearInterval(rockMoveInterval);
    clearInterval(rockSpawnInterval);
    clearInterval(bossLoopInterval);
    clearInterval(powerupMoveInterval);
    if (laserIsActive) {
        clearInterval(laserDamageInterval);
        const laserBeam = document.querySelector(".laser-beam");
        if (laserBeam) laserBeam.remove();
    }
    // Clear all power-up bars on game over
    powerupBarsContainer.innerHTML = '';

    if (result !== "win") {
        document.getElementById("gameover-sound").play();
    }
    document.getElementById(result === "win" ? "win-screen" : "game-over").style.display = "flex";
}

function restartGame(){window.location.reload()}