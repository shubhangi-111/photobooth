/* ==========================================
   PIXEL BOOTH — CAMERA + PHOTO ENGINE
========================================== */

const camera = document.getElementById("camera");
const filterOverlay = document.getElementById("filterOverlay");
const countdown = document.getElementById("countdown");
const flash = document.getElementById("flash");

const captureButton = document.getElementById("captureButton");
const flipCameraButton = document.getElementById("flipCamera");
const mirrorToggleButton = document.getElementById("mirrorToggle");

const resultSection = document.getElementById("resultSection");
const resultCanvas = document.getElementById("resultCanvas");
const resultContext = resultCanvas.getContext("2d");

const retakeButton = document.getElementById("retakeButton");
const downloadButton = document.getElementById("downloadButton");

const statusText = document.querySelector(".status");
const statusDot = document.querySelector(".status-dot");


/* ==========================================
   STATE
========================================== */

let cameraStream = null;
let facingMode = "user";
let mirrorEnabled = true;

let selectedFilter = "none";
let selectedLayout = "strip";
let photoCount = 4;

let capturedPhotos = [];
let captureInProgress = false;

let currentFilterStyle = "none";

const PHOTO_WIDTH = 480;
const PHOTO_HEIGHT = 360;


/* ==========================================
   FILTER DEFINITIONS
========================================== */

const filters = {
    none: {
        css: "none",
        overlay: "transparent"
    },

    grayscale: {
        css: "grayscale(1)",
        overlay: "transparent"
    },

    vintage: {
        css: "sepia(0.55) contrast(0.9) saturate(0.8)",
        overlay: "rgba(180, 120, 65, 0.10)"
    },

    warm: {
        css: "sepia(0.18) saturate(1.3)",
        overlay: "rgba(255, 155, 75, 0.07)"
    },

    cool: {
        css: "hue-rotate(12deg) saturate(0.85)",
        overlay: "rgba(100, 175, 255, 0.08)"
    },

    y2k: {
        css: "saturate(1.55) contrast(1.08) hue-rotate(-8deg)",
        overlay: "rgba(255, 100, 180, 0.06)"
    }
};


/* ==========================================
   CAMERA STATUS
========================================== */

function setStatus(message, ready = false) {
    statusText.lastChild.textContent = " " + message;

    statusDot.style.background = ready ? "#76977e" : "#e6ad70";
    statusDot.style.boxShadow = ready
        ? "0 0 0 4px #76977e20"
        : "0 0 0 4px #e6ad7020";
}


/* ==========================================
   START CAMERA
========================================== */

async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("USE HTTPS OR LOCALHOST");
        alert(
            "Your browser needs a secure connection to access the camera. " +
            "Open this project through localhost or GitHub Pages HTTPS."
        );
        return;
    }

    setStatus("CONNECTING...");

    try {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }

        cameraStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 960 }
            }
        });

        camera.srcObject = cameraStream;

        await new Promise(resolve => {
            if (camera.readyState >= 2) {
                resolve();
            } else {
                camera.onloadedmetadata = resolve;
            }
        });

        await camera.play();

        updateCameraTransform();
        applyFilter();
        setStatus("CAMERA READY", true);

    } catch (error) {
        console.error("Camera error:", error);

        setStatus("CAMERA UNAVAILABLE");

        alert(
            "We couldn't access your camera.\n\n" +
            "Check your browser's camera permission and close other apps " +
            "that may be using the camera.\n\n" +
            "Error: " + error.message
        );
    }
}


/* ==========================================
   CAMERA FLIP + MIRROR MODE
========================================== */

function updateCameraTransform() {
    const flip = mirrorEnabled ? -1 : 1;

    camera.style.transform = `scaleX(${flip})`;
}

flipCameraButton.addEventListener("click", async () => {
    facingMode = facingMode === "user" ? "environment" : "user";

    await startCamera();
});

mirrorToggleButton.addEventListener("click", () => {
    mirrorEnabled = !mirrorEnabled;

    updateCameraTransform();

    mirrorToggleButton.style.background = mirrorEnabled
        ? "#fce8ef"
        : "#fffdf9";

    mirrorToggleButton.style.borderColor = mirrorEnabled
        ? "#e98ca8"
        : "#e9e2d9";
});


/* ==========================================
   FILTER SELECTION
========================================== */

function applyFilter() {
    const filter = filters[selectedFilter];

    currentFilterStyle = filter.css;

    camera.style.filter = filter.css;

    filterOverlay.style.background = filter.overlay;
}

document.querySelectorAll(".filter-option").forEach(button => {
    button.addEventListener("click", () => {
        selectedFilter = button.dataset.filter;

        document.querySelectorAll(".filter-option").forEach(option => {
            option.classList.toggle("active", option === button);
        });

        applyFilter();
    });
});


/* ==========================================
   PHOTO COUNT
========================================== */

document.querySelectorAll(".count-option").forEach(button => {
    button.addEventListener("click", () => {
        photoCount = Number(button.dataset.count);

        document.querySelectorAll(".count-option").forEach(option => {
            option.classList.toggle("active", option === button);
        });
    });
});


/* ==========================================
   LAYOUT SELECTION
========================================== */

document.querySelectorAll(".layout-option").forEach(button => {
    button.addEventListener("click", () => {
        selectedLayout = button.dataset.layout;

        document.querySelectorAll(".layout-option").forEach(option => {
            option.classList.toggle("active", option === button);
        });
    });
});


/* ==========================================
   COUNTDOWN
========================================== */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCountdown(number = 3) {
    countdown.classList.remove("hidden");

    for (let numberLeft = number; numberLeft >= 1; numberLeft--) {
        countdown.textContent = numberLeft;

        // Restart the countdown animation.
        countdown.style.animation = "none";
        void countdown.offsetWidth;
        countdown.style.animation = "";

        await sleep(850);
    }

    countdown.textContent = "✦";

    await sleep(250);

    countdown.classList.add("hidden");
}


/* ==========================================
   CAMERA FLASH
========================================== */

function triggerFlash() {
    flash.classList.remove("active");

    void flash.offsetWidth;

    flash.classList.add("active");
}


/* ==========================================
   CAPTURE PHOTO
========================================== */

function capturePhoto() {
    if (!cameraStream || camera.readyState < 2) {
        throw new Error("The camera is not ready yet.");
    }

    const canvas = document.createElement("canvas");

    canvas.width = PHOTO_WIDTH;
    canvas.height = PHOTO_HEIGHT;

    const context = canvas.getContext("2d");

    const sourceWidth = camera.videoWidth;
    const sourceHeight = camera.videoHeight;

    // Crop to the same 4:3 aspect ratio as the preview.
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = PHOTO_WIDTH / PHOTO_HEIGHT;

    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;
    let cropX = 0;
    let cropY = 0;

    if (sourceRatio > targetRatio) {
        cropWidth = sourceHeight * targetRatio;
        cropX = (sourceWidth - cropWidth) / 2;
    } else {
        cropHeight = sourceWidth / targetRatio;
        cropY = (sourceHeight - cropHeight) / 2;
    }

    context.save();

    // Captured photos follow the current mirror preference.
    if (mirrorEnabled) {
        context.translate(PHOTO_WIDTH, 0);
        context.scale(-1, 1);
    }

    context.filter = currentFilterStyle;

    context.drawImage(
        camera,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        PHOTO_WIDTH,
        PHOTO_HEIGHT
    );

    context.restore();

    // Apply the subtle filter tint to the actual photo.
    const tint = filters[selectedFilter].overlay;

    if (tint !== "transparent") {
        context.save();
        context.globalCompositeOperation = "source-over";
        context.fillStyle = tint;
        context.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
        context.restore();
    }

    return canvas;
}


/* ==========================================
   CAPTURE SEQUENCE
========================================== */

captureButton.addEventListener("click", startCaptureSequence);

async function startCaptureSequence() {
    if (captureInProgress) return;

    if (!cameraStream || camera.readyState < 2) {
        alert("Please wait for the camera to become ready.");
        return;
    }

    captureInProgress = true;
    capturedPhotos = [];

    captureButton.disabled = true;
    captureButton.style.opacity = "0.5";

    try {
        for (let i = 0; i < photoCount; i++) {
            await runCountdown(3);

            triggerFlash();

            capturedPhotos.push(capturePhoto());

            // A short pause between automatic shots.
            if (i < photoCount - 1) {
                await sleep(650);
            }
        }

        generatePhotoComposition();

        resultSection.classList.remove("hidden");

        resultSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        console.error("Capture error:", error);
        alert("Something went wrong while capturing. Please try again.");
    } finally {
        captureInProgress = false;

        captureButton.disabled = false;
        captureButton.style.opacity = "1";

        countdown.classList.add("hidden");
    }
}


/* ==========================================
   COMPOSITION HELPERS
========================================== */

function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();

    context.roundRect(
        x,
        y,
        width,
        height,
        radius
    );
}

function drawPhoto(context, photo, x, y, width, height) {
    const sourceRatio = photo.width / photo.height;
    const targetRatio = width / height;

    let cropWidth = photo.width;
    let cropHeight = photo.height;
    let cropX = 0;
    let cropY = 0;

    if (sourceRatio > targetRatio) {
        cropWidth = photo.height * targetRatio;
        cropX = (photo.width - cropWidth) / 2;
    } else {
        cropHeight = photo.width / targetRatio;
        cropY = (photo.height - cropHeight) / 2;
    }

    context.drawImage(
        photo,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        x,
        y,
        width,
        height
    );
}


/* ==========================================
   PHOTO STRIP
========================================== */

function drawStrip() {
    const padding = 28;
    const gap = 16;
    const footerHeight = 85;

    const photoWidth = 420;
    const photoHeight = 315;

    const canvasWidth = photoWidth + padding * 2;

    const canvasHeight =
        padding * 2 +
        photoCount * photoHeight +
        (photoCount - 1) * gap +
        footerHeight;

    resultCanvas.width = canvasWidth;
    resultCanvas.height = canvasHeight;

    resultContext.fillStyle = "#fffaf3";
    resultContext.fillRect(0, 0, canvasWidth, canvasHeight);

    capturedPhotos.forEach((photo, index) => {
        const x = padding;
        const y = padding + index * (photoHeight + gap);

        resultContext.save();

        resultContext.shadowColor = "#55463b18";
        resultContext.shadowBlur = 8;
        resultContext.shadowOffsetY = 3;

        resultContext.fillStyle = "#ffffff";
        resultContext.fillRect(x - 4, y - 4, photoWidth + 8, photoHeight + 8);

        resultContext.restore();

        drawPhoto(
            resultContext,
            photo,
            x,
            y,
            photoWidth,
            photoHeight
        );
    });

    drawFooter(canvasWidth, canvasHeight);
}


/* ==========================================
   2 × 2 GRID
========================================== */

function drawGrid() {
    const padding = 28;
    const gap = 12;
    const cellWidth = 350;
    const cellHeight = 262.5;
    const footerHeight = 85;

    resultCanvas.width = padding * 2 + cellWidth * 2 + gap;
    resultCanvas.height = padding * 2 + cellHeight * 2 + gap + footerHeight;

    resultContext.fillStyle = "#fffaf3";
    resultContext.fillRect(0, 0, resultCanvas.width, resultCanvas.height);

    capturedPhotos.forEach((photo, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);

        const x = padding + column * (cellWidth + gap);
        const y = padding + row * (cellHeight + gap);

        resultContext.fillStyle = "#ffffff";
        resultContext.fillRect(x - 3, y - 3, cellWidth + 6, cellHeight + 6);

        drawPhoto(resultContext, photo, x, y, cellWidth, cellHeight);
    });

    drawFooter(resultCanvas.width, resultCanvas.height);
}


/* ==========================================
   POLAROID LAYOUT
========================================== */

function drawPolaroid() {
    const photo = capturedPhotos[capturedPhotos.length - 1];

    const width = 500;
    const height = 580;

    resultCanvas.width = width;
    resultCanvas.height = height;

    resultContext.fillStyle = "#fffaf3";
    resultContext.fillRect(0, 0, width, height);

    // Polaroid paper.
    resultContext.fillStyle = "#ffffff";
    resultContext.fillRect(30, 25, 440, 530);

    // Photo.
    drawPhoto(resultContext, photo, 55, 50, 390, 370);

    // Caption.
    resultContext.fillStyle = "#37302e";
    resultContext.textAlign = "center";
    resultContext.font = "24px Georgia";
    resultContext.fillText("little moments ✦", width / 2, 465);

    resultContext.fillStyle = "#9b8b83";
    resultContext.font = "12px Arial";
    resultContext.fillText(getDateStamp(), width / 2, 495);
}


/* ==========================================
   FOOTER
========================================== */

function getDateStamp() {
    return new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric"
    }).toUpperCase();
}

function drawFooter(width, height) {
    resultContext.fillStyle = "#fffaf3";

    resultContext.fillRect(
        0,
        height - 75,
        width,
        75
    );

    resultContext.textAlign = "center";
    resultContext.fillStyle = "#d96e90";
    resultContext.font = "bold 17px Arial";

    resultContext.fillText(
        "PIXEL BOOTH ✦",
        width / 2,
        height - 43
    );

    resultContext.fillStyle = "#a3978c";
    resultContext.font = "11px Arial";

    resultContext.fillText(
        getDateStamp(),
        width / 2,
        height - 23
    );
}


/* ==========================================
   GENERATE FINAL COMPOSITION
========================================== */

function generatePhotoComposition() {
    if (selectedLayout === "strip") {
        drawStrip();
    } else if (selectedLayout === "grid") {
        drawGrid();
    } else if (selectedLayout === "polaroid") {
        drawPolaroid();
    }
}


/* ==========================================
   RETAKE
========================================== */

retakeButton.addEventListener("click", () => {
    capturedPhotos = [];

    resultSection.classList.add("hidden");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});


/* ==========================================
   DOWNLOAD PNG
========================================== */

downloadButton.addEventListener("click", () => {
    if (!capturedPhotos.length) return;

    const link = document.createElement("a");

    link.download = `pixel-booth-${Date.now()}.png`;
    link.href = resultCanvas.toDataURL("image/png");

    link.click();
});


/* ==========================================
   CLEAN UP CAMERA
========================================== */

window.addEventListener("beforeunload", () => {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
});


/* ==========================================
   INITIALIZE
========================================== */

startCamera();