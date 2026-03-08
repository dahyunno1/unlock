import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

document.body.addEventListener('click', function () {
    document.getElementById('bgm').play();
  }, { once: true });
// ==========================================
// 1. Global Config & State
// ==========================================
const CONFIG = {
    targetZoom: 6.0
};

const STATE = {
    mode: 'IDLE',
    autoRotationY: 0
};

let dom = {
    ui: null, 
    lockContent: null
};

let scene, camera, renderer, cssRenderer, phoneMesh, controls;
let targetRotation = new THREE.Vector2();
let mouse = new THREE.Vector2();

// ==========================================
// 2. Initialization
// ==========================================
init();
animate();

function init() {
    dom.ui = document.getElementById('phone-screen-ui');
    dom.lockContent = document.getElementById('lock-content');

    // ★ 추가됨: 뒷면이 비치지 않도록 기본 CSS 속성 추가
    if (dom.ui) {
        dom.ui.style.backfaceVisibility = 'hidden';
        dom.ui.style.WebkitBackfaceVisibility = 'hidden';
    }

    initThreeJS();
    initEvents();
    
    // ★ 추가됨: 초기화 완료 후 웹캠 실행
    initWebcam();
}

function initThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 8;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    document.getElementById('webgl-container').appendChild(renderer.domElement);

    cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(window.innerWidth, window.innerHeight);
    Object.assign(cssRenderer.domElement.style, { position: 'absolute', top: '0', left: '0' });
    document.getElementById('css3d-container').appendChild(cssRenderer.domElement);

    // ========================================================
    // 🎨 [UPGRADE] 스마트폰 3D 모델링 디테일 추가
    // ========================================================

    // 1. 둥근 모서리 바디 만들기 (Shape & ExtrudeGeometry)
    const width = 2.2;
    const height = 4.4;
    const radius = 0.25; // 모서리 둥글기
    
    const shape = new THREE.Shape();
    shape.moveTo(-width/2, -height/2 + radius);
    shape.lineTo(-width/2, height/2 - radius);
    shape.quadraticCurveTo(-width/2, height/2, -width/2 + radius, height/2);
    shape.lineTo(width/2 - radius, height/2);
    shape.quadraticCurveTo(width/2, height/2, width/2, height/2 - radius);
    shape.lineTo(width/2, -height/2 + radius);
    shape.quadraticCurveTo(width/2, -height/2, width/2 - radius, -height/2);
    shape.lineTo(-width/2 + radius, -height/2);
    shape.quadraticCurveTo(-width/2, -height/2, -width/2, -height/2 + radius);

    const extrudeSettings = { 
        depth: 0.15,        // 두께
        bevelEnabled: true, // 테두리 곡면(베벨) 활성화
        bevelSegments: 4, 
        steps: 1, 
        bevelSize: 0.03, 
        bevelThickness: 0.03 
    };
    const phoneGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    phoneGeo.center(); // 기준점을 정중앙으로 맞춤

    // 2. 프리미엄 재질 적용 (MeshPhysicalMaterial로 유리 같은 광택 구현)
    const phoneMat = new THREE.MeshPhysicalMaterial({ 
        color: 0x777777,       // 어두운 베젤 색상
        metalness: 0.8,        // 메탈 느낌
        roughness: 0.2,        // 매끄러움
        clearcoat: 1.0,        // 유리 코팅 광택
        clearcoatRoughness: 0.1
    });
    
    phoneMesh = new THREE.Mesh(phoneGeo, phoneMat);
    scene.add(phoneMesh);

    // 3. 후면 카메라 모듈 (카메라 섬 & 렌즈) 추가
    // 카메라 섬 (Bump)
    const bumpGeo = new THREE.BoxGeometry(0.7, 0.8, 0.05);
    const bumpMat = new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, roughness: 0.4, clearcoat: 0.5 });
    const bump = new THREE.Mesh(bumpGeo, bumpMat);
    bump.position.set(0.55, 1.4, -0.1); // 폰 후면 좌측 상단으로 배치
    phoneMesh.add(bump);

    // 카메라 렌즈 1 (메인 렌즈)
    const lensGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.06, 32);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.9, roughness: 0.1 });
    const lens1 = new THREE.Mesh(lensGeo, lensMat);
    lens1.rotation.x = Math.PI / 2; // 원기둥을 세워서 부착
    lens1.position.set(0, 0.2, -0.01);
    bump.add(lens1);

    // 카메라 렌즈 2 (서브 렌즈)
    const lens2 = lens1.clone();
    lens2.position.set(0, -0.2, -0.01);
    bump.add(lens2);

    // ========================================================

    // 4. CSS3D 스크린(UI) 부착 (기존 코드 유지)
    const screenObject = new CSS3DObject(dom.ui);
    const scaleFactor = 2.1 / 360; 
    screenObject.scale.set(scaleFactor, scaleFactor, scaleFactor);
    screenObject.position.set(0, 0, 0.11); // 베벨 두께를 고려해 z축 살짝 띄움
    phoneMesh.add(screenObject);

    // 조명 세팅 (광택이 잘 보이도록 조명 추가)
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    
    // 반사광을 위한 추가 조명
    const backLight = new THREE.DirectionalLight(0xaabbff, 1.0);
    backLight.position.set(-5, -5, -7);
    scene.add(backLight);

    controls = new OrbitControls(camera, cssRenderer.domElement);
    controls.enableRotate = false; controls.enableZoom = false;
    controls.enableDamping = false;
}

// ==========================================
// 3. Events & Loop
// ==========================================
function initEvents() {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    cssRenderer.domElement.addEventListener('click', onClick); 
}

function onClick() {
    if (STATE.mode === 'IDLE') {
        STATE.mode = 'ALIGNING';
        setTimeout(() => { 
            STATE.mode = 'ZOOMING'; 
            if (dom.ui) dom.ui.style.opacity = '1'; 
        }, 1000);
    } else if (STATE.mode === 'ZOOMING' && Math.abs(camera.position.z - CONFIG.targetZoom) < 0.1) {
        // 폰 화면까지 진입한 후 상태를 SCREEN_ACTIVE로 변경하고 이벤트 종료
        STATE.mode = 'SCREEN_ACTIVE';
    }
}

function onMouseMove(event) {
    if (STATE.mode !== 'IDLE') return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    targetRotation.x = mouse.y * 0.5;
    targetRotation.y = mouse.x * 0.5;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    cssRenderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (STATE.mode === 'IDLE') {
        STATE.autoRotationY += 0.015;
        phoneMesh.rotation.x = THREE.MathUtils.lerp(phoneMesh.rotation.x, targetRotation.x, 0.05);
        phoneMesh.rotation.y = THREE.MathUtils.lerp(phoneMesh.rotation.y, targetRotation.y + STATE.autoRotationY, 0.05);
    } else {
        phoneMesh.rotation.x = THREE.MathUtils.lerp(phoneMesh.rotation.x, 0, 0.08);
        phoneMesh.rotation.y = THREE.MathUtils.lerp(phoneMesh.rotation.y, 0, 0.08);
        phoneMesh.rotation.z = THREE.MathUtils.lerp(phoneMesh.rotation.z, 0, 0.08);
        
        // ZOOMING 상태이거나 화면 진입이 완료된(SCREEN_ACTIVE) 상태일 때 줌 유지
        if (['ZOOMING', 'SCREEN_ACTIVE'].includes(STATE.mode)) {
            camera.position.z = THREE.MathUtils.lerp(camera.position.z, CONFIG.targetZoom, 0.04);
            controls.enabled = false;
        }
    }

    // ★ 추가됨: 스마트폰 방향을 계산해서 UI(HTML) 숨기기/보이기 처리
    // 수정 후
    if (dom.ui) {
        if (STATE.mode === 'IDLE') {
            const dir = new THREE.Vector3();
            phoneMesh.getWorldDirection(dir);

            if (dir.z < 0) {
                dom.ui.style.opacity = '0';
                dom.ui.style.pointerEvents = 'none';
            } else {
                dom.ui.style.opacity = '0.1';
                dom.ui.style.pointerEvents = 'auto';
            }
        } else {
            // IDLE이 아닌 모든 상태(ALIGNING, ZOOMING, SCREEN_ACTIVE)에서
            // pointerEvents를 반드시 복원
            dom.ui.style.pointerEvents = 'auto';
        }
    }
    
    renderer.render(scene, camera);
    cssRenderer.render(scene, camera);
}

// ==========================================
// 📷 [신규] 웹캠 초기화 함수
// ==========================================
async function initWebcam() {
    const videoElement = document.getElementById('webcam-feed');
    
    if (!videoElement) {
        console.warn("웹캠을 띄울 <video id='webcam-feed'> 요소가 없습니다.");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'user', // 전면 카메라 우선
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });

        videoElement.srcObject = stream;
        videoElement.onloadedmetadata = () => {
            videoElement.play();
        };
        console.log("웹캠 연결 성공!");

    } catch (error) {
        console.error('웹캠을 불러오는 중 오류가 발생했습니다:', error);
    }
}

// ===========================
// 스크롤 이벤트 (패널 슬라이드 업/다운 및 메뉴 클릭 이동)
// ===========================
const infoPanel = document.getElementById('info-panel');
const scrollArrow = document.getElementById('scroll-arrow');
const menuBtns = document.querySelectorAll('.menu-btn'); 

// 마우스 휠 / 트랙패드 대응
window.addEventListener('wheel', (event) => {
    if (event.deltaY > 0) {
        infoPanel.classList.add('show');
        if (scrollArrow) scrollArrow.style.opacity = '0'; 
    } else if (event.deltaY < 0) {
        if (infoPanel.scrollTop === 0) {
            infoPanel.classList.remove('show');
            if (scrollArrow) scrollArrow.style.opacity = '1';
        }
    }
});

// 메뉴 버튼 클릭 스크롤 이동
menuBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const targetBox = document.getElementById(targetId);

        if (targetBox) {
            if (!infoPanel.classList.contains('show')) {
                infoPanel.classList.add('show');
                if (scrollArrow) scrollArrow.style.opacity = '0'; 
            }

            setTimeout(() => {
                const scrollPosition = targetBox.offsetTop - infoPanel.offsetTop; 
                
                infoPanel.scrollTo({
                    top: scrollPosition, 
                    behavior: 'smooth' 
                });
            }, 100); 
        }
    });
});

// ===========================
// 스마트폰 내부 스크롤 충돌 방지
// ===========================
const lockContentScroll = document.getElementById('lock-content');

if (lockContentScroll) {
    lockContentScroll.addEventListener('wheel', (event) => {
        event.stopPropagation(); 
    }, { passive: false });
}

const lockButtons = document.querySelectorAll('.lock-btn');
lockButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation(); 
    });
});