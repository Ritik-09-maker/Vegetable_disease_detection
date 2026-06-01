

document.addEventListener("DOMContentLoaded", function () {

    const imageUpload = document.getElementById("imageUpload");
    const predictBtn = document.getElementById("predictBtn");
    const canvas = document.getElementById("previewCanvas");
    const cameraPreview = document.getElementById("cameraPreview");
    const startCameraBtn = document.getElementById("startCameraBtn");
    const captureBtn = document.getElementById("captureBtn");
    const resultBox = document.getElementById("result");
    const indexHistoryList = document.getElementById("indexHistoryList");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");
    const clearBtn = document.getElementById("clearBtn");

    const ctx = canvas.getContext("2d");

    let selectedFile = null;
    const STORAGE_KEY = "vegetable:lastPrediction";
    const HISTORY_KEY = "vegetable:predictionHistory";
    const HISTORY_LIMIT = 5;
    const HOLD_MS = 60_000; // minimum hold time requested
    let autoClearTimer = null;
    let cameraStream = null;

    function getQualityReasonText(reason) {
        const map = {
            too_dark: "Image is too dark",
            too_bright: "Image is too bright",
            low_contrast: "Image has low contrast",
            blurry: "Image looks blurry",
            non_leaf_like: "Leaf is not clearly visible"
        };
        return map[reason] || reason;
    }

    function renderQualityNote(quality) {
        if (!quality || !Array.isArray(quality.reasons) || !quality.reasons.length) return "";
        const reasonsText = quality.reasons.map(getQualityReasonText).join(", ");
        return `<div class="uncertain-box"><strong>Quality Alert:</strong> ${reasonsText}. Please retake a clearer leaf photo.</div>`;
    }

    function parseConfidence(confidenceValue) {
        const parsed = parseFloat(String(confidenceValue || "").replace("%", ""));
        return Number.isFinite(parsed) ? parsed : null;
    }

    function getSeverity(payload) {
        const name = String(payload?.disease || "").toLowerCase();
        const score = parseConfidence(payload?.confidence);
        if (name.includes("unwanted")) return "High";
        if (name.includes("uncertain") || payload?.is_uncertain) return "Medium";
        if (name.includes("healthy")) return "Low";
        if (score !== null && score >= 80) return "High";
        return "Medium";
    }

    function getSeverityClass(level) {
        if (level === "Low") return "severity-low";
        if (level === "High") return "severity-high";
        return "severity-medium";
    }

    function renderTopPredictions(list) {
        if (!Array.isArray(list) || !list.length) return "";
        const rows = list.slice(0, 3).map((item) => {
            const value = Number(item?.confidence) || 0;
            const label = item?.disease || "Unknown";
            return `
                <div class="top-pred-item">
                    <div class="top-pred-line">
                        <span>${label}</span>
                        <strong>${value.toFixed(2)}%</strong>
                    </div>
                    <div class="top-pred-track"><span style="width:${Math.max(0, Math.min(value, 100))}%"></span></div>
                </div>
            `;
        }).join("");
        return `<div class="top-predictions"><h4>Top Predictions</h4>${rows}</div>`;
    }

    function renderResult(payload) {
        const tsText = payload?.timestamp ? new Date(payload.timestamp).toLocaleString() : "";
        const uncertainNote = payload?.is_uncertain
            ? `<div class="uncertain-box">This image may be outside trained classes or not clear enough. Please try a clearer leaf photo.</div>`
            : "";
        const qualityNote = renderQualityNote(payload?.quality);
        const severity = getSeverity(payload);
        const severityClass = getSeverityClass(severity);
        const topPredictionsMarkup = renderTopPredictions(payload?.top_predictions);

        resultBox.innerHTML = `
            <div class="prediction">
                <h3>${payload.disease ?? "Unknown"}</h3>
                <div class="confidence">${payload.confidence ?? ""}</div>
                <p class="status-line"><strong>Severity:</strong> <span class="severity-badge ${severityClass}">${severity}</span></p>
                <p class="status-line"><strong>Status:</strong> ${getHealthStatus(payload.disease)}</p>
                ${uncertainNote}
                ${qualityNote}
                ${topPredictionsMarkup}
                ${tsText ? `<p style="margin-top:10px; opacity:0.8;">Saved: ${tsText}</p>` : ""}
                <p style="margin-top:10px; opacity:0.8;">Result will stay at least 1 minute.</p>
                <a class="btn primary view-result-btn" href="result.html">View Full Result</a>
            </div>
        `;
        resultBox.classList.remove("hidden");

        // Reset auto-clear timer so each new prediction holds for 1 minute
        if (autoClearTimer) window.clearTimeout(autoClearTimer);
        autoClearTimer = window.setTimeout(() => {
            clearResult();
        }, HOLD_MS);
    }

    function renderError(message) {
        resultBox.innerHTML = `
            <div class="error-box">
                ❌ ${message}
            </div>
        `;
        resultBox.classList.remove("hidden");
    }

    function clearResult() {
        if (autoClearTimer) {
            window.clearTimeout(autoClearTimer);
            autoClearTimer = null;
        }
        localStorage.removeItem(STORAGE_KEY);
        resultBox.innerHTML = "";
    }

    function getHealthStatus(diseaseName) {
        const value = String(diseaseName || "").toLowerCase();
        if (value.includes("uncertain")) return "Uncertain";
        if (value.includes("unwanted")) return "Non-target";
        return value.includes("healthy") ? "Healthy" : "Unhealthy";
    }

    function savePredictionHistory(payload) {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            const existing = raw ? JSON.parse(raw) : [];
            const safeExisting = Array.isArray(existing) ? existing : [];
            const updated = [payload, ...safeExisting].slice(0, HISTORY_LIMIT);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
            renderIndexHistory();
        } catch (_) {
            // Ignore storage failures to avoid blocking prediction flow.
        }
    }

    function renderIndexHistory() {
        if (!indexHistoryList) return;
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            const history = raw ? JSON.parse(raw) : [];
            const safeHistory = Array.isArray(history) ? history.slice(0, HISTORY_LIMIT) : [];

            if (!safeHistory.length) {
                indexHistoryList.innerHTML = "<p>No recent predictions yet.</p>";
                return;
            }

            indexHistoryList.innerHTML = safeHistory.map((item) => {
                const disease = item?.disease || "Unknown";
                const confidence = item?.confidence || "N/A";
                const timeText = item?.timestamp
                    ? new Date(item.timestamp).toLocaleString()
                    : "No timestamp";
                return `
                    <div class="history-item">
                        <div><strong>${disease}</strong></div>
                        <div class="history-meta">Confidence: ${confidence}</div>
                        <div class="history-meta">${timeText}</div>
                    </div>
                `;
            }).join("");
        } catch (_) {
            indexHistoryList.innerHTML = "<p>Unable to load history.</p>";
        }
    }

    function clearHistory() {
        try {
            localStorage.removeItem(HISTORY_KEY);
            renderIndexHistory();
        } catch (_) {
            indexHistoryList.innerHTML = "<p>Unable to clear history.</p>";
        }
    }

    async function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Camera is not supported in this browser.");
            return;
        }

        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            });
            cameraPreview.srcObject = cameraStream;
            cameraPreview.classList.remove("hidden");
            canvas.classList.add("hidden");
        } catch (_) {
            alert("Unable to access camera. Please allow camera permission.");
        }
    }

    function stopCamera() {
        if (!cameraStream) return;
        cameraStream.getTracks().forEach((track) => track.stop());
        cameraStream = null;
        cameraPreview.srcObject = null;
        cameraPreview.classList.add("hidden");
        canvas.classList.remove("hidden");
    }

    function captureFromCamera() {
        if (!cameraStream) {
            alert("Please start camera first.");
            return;
        }

        if (!cameraPreview.videoWidth || !cameraPreview.videoHeight) {
            alert("Camera is still loading. Please try again.");
            return;
        }

        // Draw preview for UI on the visible canvas.
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);
        canvas.classList.remove("hidden");

        // Capture full camera frame (not forced 300x300) for better model input quality.
        const captureCanvas = document.createElement("canvas");
        captureCanvas.width = cameraPreview.videoWidth;
        captureCanvas.height = cameraPreview.videoHeight;
        const captureCtx = captureCanvas.getContext("2d");
        captureCtx.drawImage(cameraPreview, 0, 0, captureCanvas.width, captureCanvas.height);

        captureCanvas.toBlob((blob) => {
            if (!blob) return;
            selectedFile = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        }, "image/jpeg", 0.92);

        stopCamera();
    }

    // Restore last result on load (so it never disappears)
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const saved = JSON.parse(raw);
            if (saved && typeof saved === "object") renderResult(saved);
        }
    } catch (_) {
        // ignore corrupted storage
    }
    renderIndexHistory();

    // Image Preview
    imageUpload.addEventListener("change", function () {

        selectedFile = this.files[0];

        if (!selectedFile) return;

        const img = new Image();

        img.onload = function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };

        img.src = URL.createObjectURL(selectedFile);
    });

    startCameraBtn?.addEventListener("click", function (e) {
        e.preventDefault();
        startCamera();
    });

    captureBtn?.addEventListener("click", function (e) {
        e.preventDefault();
        captureFromCamera();
    });

    clearBtn?.addEventListener("click", function (e) {
        e.preventDefault();
        clearResult();
        stopCamera();
        selectedFile = null;
        imageUpload.value = "";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    clearHistoryBtn?.addEventListener("click", function (e) {
        e.preventDefault();
        clearHistory();
    });

   
    // Predict
    
    predictBtn.addEventListener("click", async function (e) {

        e.preventDefault();   // important

        // Always read current file input so result changes reliably
        selectedFile = imageUpload.files && imageUpload.files[0] ? imageUpload.files[0] : selectedFile;

        if (!selectedFile) {
            alert("Please upload an image or capture photo from camera first.");
            return;
        }

        const formData = new FormData();
        formData.append("image", selectedFile);

        predictBtn.innerHTML = "Predicting...";
        predictBtn.disabled = true;

        try {
            // show loading but keep UI stable
            resultBox.innerHTML = `
                <div class="result-card">
                    <h2>⏳ Processing...</h2>
                    <p>Please wait...</p>
                </div>
            `;

            const response = await fetch("http://127.0.0.1:5000/predict", {
                method: "POST",
                body: formData
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || "Prediction failed");
            }

            const payload = {
                disease: data.disease,
                confidence: data.confidence,
                class_id: data.class_id,
                is_uncertain: Boolean(data.is_uncertain),
                top_predictions: Array.isArray(data.top_predictions) ? data.top_predictions : [],
                confidence_margin: data.confidence_margin || "",
                quality: data.quality && typeof data.quality === "object" ? data.quality : null,
                timestamp: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            savePredictionHistory(payload);
            renderResult(payload);
            window.location.href = "result.html";

            // Allow selecting the same file again to re-predict (change event won't fire otherwise)
            imageUpload.value = "";

        } catch (error) {
            // If API fails, keep last saved result available (but show the error now)
            renderError(error.message);
        }

        predictBtn.innerHTML = "Predict Disease";
        predictBtn.disabled = false;

    });

});