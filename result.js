document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "vegetable:lastPrediction";
    const HISTORY_KEY = "vegetable:predictionHistory";
    const content = document.getElementById("resultPageContent");
    const historyList = document.getElementById("historyList");

    const diseaseAdvice = [
        {
            keywords: ["healthy"],
            status: "Healthy",
            doList: ["Continue regular watering.", "Give proper sunlight and ventilation.", "Maintain balanced nutrients."],
            dontList: ["Do not overwater.", "Do not overcrowd nearby plants."]
        },
        {
            keywords: ["blight"],
            status: "Unhealthy",
            doList: ["Remove infected leaves immediately.", "Use a copper-based fungicide every 7-10 days.", "Keep plant area clean and dry."],
            dontList: ["Do not wet leaves late in the day.", "Do not reuse contaminated tools without cleaning."]
        },
        {
            keywords: ["mildew", "powdery"],
            status: "Unhealthy",
            doList: ["Improve airflow around the plant.", "Use sulfur- or neem-based spray.", "Water near the root zone only."],
            dontList: ["Do not keep leaves damp for long.", "Do not place plants too close together."]
        },
        {
            keywords: ["spot", "leaf spot"],
            status: "Unhealthy",
            doList: ["Prune and discard infected foliage.", "Follow a fungicide schedule.", "Increase spacing for better air movement."],
            dontList: ["Do not compost heavily infected leaves.", "Do not splash water on foliage."]
        },
        {
            keywords: ["rot"],
            status: "Unhealthy",
            doList: ["Improve soil drainage.", "Remove decayed plant parts.", "Let topsoil dry slightly between watering."],
            dontList: ["Do not allow standing water.", "Do not keep roots in soggy soil."]
        }
    ];

    function normalize(value) {
        return String(value || "").toLowerCase().trim();
    }

    function getAdvice(diseaseName) {
        const normalizedName = normalize(diseaseName);
        if (normalizedName.includes("uncertain")) {
            return {
                status: "Uncertain",
                doList: [
                    "Capture a close, clear image in good daylight.",
                    "Focus on a single affected leaf.",
                    "Retake prediction and compare top results."
                ],
                dontList: [
                    "Do not use blurry or far-away images.",
                    "Do not include multiple crops in one frame."
                ]
            };
        }
        const matched = diseaseAdvice.find((item) =>
            item.keywords.some((keyword) => normalizedName.includes(keyword))
        );

        if (matched) return matched;

        return {
            status: "Unhealthy",
            doList: ["Isolate the plant.", "Remove visibly infected leaves.", "Consult an agriculture expert for accurate diagnosis."],
            dontList: ["Do not spread tools between healthy and infected plants.", "Do not delay treatment if symptoms are increasing."]
        };
    }

    function parseConfidence(confidenceValue) {
        const parsed = parseFloat(String(confidenceValue || "").replace("%", ""));
        return Number.isFinite(parsed) ? parsed : null;
    }

    function getConfidenceClass(confidenceValue) {
        const parsed = parseConfidence(confidenceValue);
        if (parsed === null) return "confidence-medium";
        if (parsed >= 80) return "confidence-high";
        if (parsed >= 50) return "confidence-medium";
        return "confidence-low";
    }

    function getSeverity(saved) {
        const name = normalize(saved?.disease);
        const score = parseConfidence(saved?.confidence);
        if (name.includes("unwanted")) return "High";
        if (name.includes("uncertain") || saved?.is_uncertain) return "Medium";
        if (name.includes("healthy")) return "Low";
        if (score !== null && score >= 80) return "High";
        return "Medium";
    }

    function getSeverityClass(level) {
        if (level === "Low") return "severity-low";
        if (level === "High") return "severity-high";
        return "severity-medium";
    }

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
        return `<div class="uncertain-box"><strong>Quality Alert:</strong> ${reasonsText}. Please capture a clearer image for better prediction.</div>`;
    }

    function renderBullets(items) {
        return items.map((item) => `<li>${item}</li>`).join("");
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

    function attachDownloadHandler(saved) {
        const downloadBtn = document.getElementById("downloadReportBtn");
        if (!downloadBtn) return;
        downloadBtn.addEventListener("click", () => {
            const reportLines = [
                "Vegetable Disease Report",
                "------------------------",
                `Date: ${new Date(saved?.timestamp || Date.now()).toLocaleString()}`,
                `Prediction: ${saved?.disease || "Unknown"}`,
                `Confidence: ${saved?.confidence || "N/A"}`,
                `Status: ${getAdvice(saved?.disease).status}`
            ];
            const blob = new Blob([reportLines.join("\n")], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `prediction-report-${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    function renderEmptyState() {
        content.innerHTML = `
            <div class="error-box">
                No result found. Please go back and run prediction first.
            </div>
        `;
    }

    function renderHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            const history = raw ? JSON.parse(raw) : [];
            const safeHistory = Array.isArray(history) ? history : [];

            if (!safeHistory.length) {
                historyList.innerHTML = "<p>No recent predictions yet.</p>";
                return;
            }

            historyList.innerHTML = safeHistory.map((item) => {
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
            historyList.innerHTML = "<p>Unable to load history.</p>";
        }
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            renderEmptyState();
            renderHistory();
            return;
        }

        const saved = JSON.parse(raw);
        if (!saved || typeof saved !== "object") {
            renderEmptyState();
            renderHistory();
            return;
        }

        const advice = getAdvice(saved.disease);
        const confidence = saved.confidence || "N/A";
        const confidenceClass = getConfidenceClass(confidence);
        const severity = getSeverity(saved);
        const severityClass = getSeverityClass(severity);
        const uncertainNote = advice.status === "Uncertain"
            ? `<div class="uncertain-box">Prediction is uncertain. The image may be outside trained classes or have low visual quality.</div>`
            : "";
        const qualityNote = renderQualityNote(saved.quality);
        const topPredictionsMarkup = renderTopPredictions(saved.top_predictions);

        content.innerHTML = `
            <div class="prediction">
                <h3>${saved.disease || "Unknown"}</h3>
                <div class="confidence ${confidenceClass}">${confidence}</div>
                <p class="status-line"><strong>Severity:</strong> <span class="severity-badge ${severityClass}">${severity}</span></p>
                <p class="status-line"><strong>Status:</strong> ${advice.status}</p>
                ${uncertainNote}
                ${qualityNote}
                ${topPredictionsMarkup}
                <div class="guidance-grid">
                    <div class="guide-card do-card">
                        <h4>Do</h4>
                        <ul>${renderBullets(advice.doList)}</ul>
                    </div>
                    <div class="guide-card dont-card">
                        <h4>Don't</h4>
                        <ul>${renderBullets(advice.dontList)}</ul>
                    </div>
                </div>
            </div>
        `;
        attachDownloadHandler(saved);
    } catch (_) {
        renderEmptyState();
    }

    renderHistory();
});
