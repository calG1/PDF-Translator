const state = {
    pdfDoc: null,
    apiKey: '',
    provider: 'free', // Default
    targetLang: 'es',
    pages: [], // Store page text items for translation
    scale: 1.5, // High resolution rendering
};

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const translateBtn = document.getElementById('translateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const pdfContainer = document.getElementById('pdfContainer');
const statusLog = document.getElementById('statusLog');
const emptyState = document.getElementById('emptyState');
const targetLangSelect = document.getElementById('targetLang');
const apiKeyInput = document.getElementById('apiKey');
const providerSelect = document.getElementById('providerSelect');
const helpBtn = document.getElementById('helpBtn');
const apiKeyHelp = document.getElementById('apiKeyHelp');
const openaiInstructions = document.getElementById('openaiInstructions');
const geminiInstructions = document.getElementById('geminiInstructions');
const googleInstructions = document.getElementById('googleInstructions');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
// Progress Elements (Generic for OCR and Translation)
const progressContainer = document.getElementById('progressContainer');
const progressStatusText = document.getElementById('progressStatusText');
const progressBar = document.getElementById('progressBar');
const progressPercentage = document.getElementById('progressPercentage');

// Event Listeners
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
translateBtn.addEventListener('click', translatePDF);
downloadBtn.addEventListener('click', downloadPDF);

apiKeyInput.addEventListener('change', (e) => state.apiKey = e.target.value);
targetLangSelect.addEventListener('change', (e) => state.targetLang = e.target.value);
providerSelect.addEventListener('change', (e) => {
    state.provider = e.target.value;
    updateHelpText();
    updateHelpText();
});

// Theme Logic
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    themeIcon.setAttribute('data-lucide', isLight ? 'sun' : 'moon');
    lucide.createIcons();
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

// Init Theme
if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
    themeIcon.setAttribute('data-lucide', 'sun');
}

helpBtn.addEventListener('click', () => {
    const isVisible = apiKeyHelp.style.display === 'block';
    apiKeyHelp.style.display = isVisible ? 'none' : 'block';
    updateHelpText();
});

function updateHelpText() {
    openaiInstructions.style.display = 'none';
    geminiInstructions.style.display = 'none';
    googleInstructions.style.display = 'none';

    // Reset state first
    apiKeyInput.disabled = false;
    apiKeyInput.placeholder = "Paste your API key here";
    if (state.apiKey) apiKeyInput.value = state.apiKey;

    if (state.provider === 'openai') {
        openaiInstructions.style.display = 'block';
    } else if (state.provider === 'gemini') {
        geminiInstructions.style.display = 'block';
    } else if (state.provider === 'google') {
        googleInstructions.style.display = 'block';
    } else {
        // Free mode
        apiKeyHelp.style.display = 'none';
        apiKeyInput.disabled = true;
        apiKeyInput.value = '';
        apiKeyInput.placeholder = "✅ No API Key required for Free Mode";
    }
}

function log(msg) {
    const time = new Date().toLocaleTimeString();
    statusLog.textContent += `[${time}] ${msg}\n`;
    statusLog.scrollTop = statusLog.scrollHeight;
    console.log(`[App] ${msg}`);
}

// File Handling
function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        loadPDF(files[0]);
    } else {
        alert('Please upload a valid PDF file.');
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) loadPDF(file);
}

async function loadPDF(file) {
    try {
        log(`Loading ${file.name}...`);
        state.filename = file.name;
        emptyState.style.display = 'none';
        pdfContainer.innerHTML = ''; // Clear previous
        translateBtn.disabled = true; // Disable until loaded/OCR done

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        state.pdfDoc = await loadingTask.promise;

        log(`PDF Loaded. Pages: ${state.pdfDoc.numPages}`);

        // Check if OCR is enabled
        const useOCR = document.getElementById('ocrToggle').checked;
        if (useOCR) {
            progressContainer.style.display = 'block';
            progressStatusText.textContent = "Starting OCR...";
            progressBar.style.width = '0%';
            progressPercentage.textContent = '0%';
            translateBtn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Processing OCR...`;
        } else {
            progressContainer.style.display = 'none';
        }

        await renderAllPages();

        translateBtn.disabled = false;
        translateBtn.innerHTML = `<i data-lucide="sparkles"></i> <span>Translate PDF</span>`;
        lucide.createIcons();
        if (useOCR) {
            progressContainer.style.display = 'none';
            log('OCR Complete for all pages.');
        }

        log('Ready to translate.');
    } catch (err) {
        console.error(err);
        log('Error loading PDF: ' + err.message);
        alert('Failed to load PDF.');
        translateBtn.disabled = false; // Re-enable on error just in case
        translateBtn.innerHTML = `<i data-lucide="sparkles"></i> <span>Translate PDF</span>`;
        progressContainer.style.display = 'none';
        lucide.createIcons();
    }
}

async function renderAllPages() {
    state.pages = []; // Reset pages data

    for (let i = 1; i <= state.pdfDoc.numPages; i++) {
        await renderPage(i);
    }
}

async function renderPage(pageNum) {
    const page = await state.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: state.scale });

    // Create Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'page-wrapper';
    wrapper.style.width = `${viewport.width}px`;
    wrapper.style.height = `${viewport.height}px`;
    pdfContainer.appendChild(wrapper);

    // Render Canvas (Original PDF Background)
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.className = 'page-canvas';
    wrapper.appendChild(canvas);

    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;

    // Extract Text (Native or OCR)
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'text-layer';
    wrapper.appendChild(textLayerDiv);

    const pageTextItems = [];
    const useOCR = document.getElementById('ocrToggle').checked;

    if (useOCR) {
        log(`Running OCR on page ${pageNum}... (this takes a moment)`);

        // Update Progress UI for Page Start
        const totalPages = state.pdfDoc.numPages;
        progressStatusText.textContent = `OCR Page ${pageNum} of ${totalPages}`;
        // Base progress for starting the page
        const baseProgress = ((pageNum - 1) / totalPages) * 100;
        progressBar.style.width = `${baseProgress}%`;
        progressPercentage.textContent = `${Math.round(baseProgress)}%`;


        // Tesseract needs an image. Canvas is ready.
        const imgData = canvas.toDataURL('image/jpeg', 0.8);

        try {
            log(`Initializing Tesseract v5...`);

            // Tesseract v5 recognize
            const { data: { words } } = await Tesseract.recognize(
                imgData,
                'eng',
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            // Progress within page (0 to 1)
                            const pageProgress = m.progress;
                            // Map 0-1 to share of total totalPages
                            // Total progress = baseProgress + (pageProgress * (100/totalPages))
                            const currentTotalProgress = baseProgress + (pageProgress * (100 / totalPages));

                            progressBar.style.width = `${currentTotalProgress}%`;
                            progressPercentage.textContent = `${Math.round(currentTotalProgress)}%`;
                        }
                    }
                }
            );

            log(`OCR Complete. Found ${words.length} words. Grouping...`);

            // Custom Grouping Logic
            const groups = [];
            let currentGroup = [];

            words.forEach(word => {
                if (word.confidence < 50 || !word.text.trim()) return;

                if (currentGroup.length === 0) {
                    currentGroup.push(word);
                    return;
                }

                const lastWord = currentGroup[currentGroup.length - 1];

                // Metrics
                const verticalGap = Math.abs(word.bbox.y0 - lastWord.bbox.y0);
                const horizontalGap = word.bbox.x0 - lastWord.bbox.x1;
                const fontHeight = lastWord.bbox.y1 - lastWord.bbox.y0;

                // Thresholds
                // Vertical: Must be roughly on same line (allow half height variance)
                const isSameLine = verticalGap < (fontHeight * 0.5);

                // Horizontal: "5 space widths". 
                // Approx space width is 0.3 * height. 5 spaces = 1.5 * height.
                // We use 2.0 * height as a generous threshold for "same sentence", 
                // but strict enough to separate columns.
                const isClose = horizontalGap < (fontHeight * 2.5);

                if (isSameLine && isClose) {
                    currentGroup.push(word);
                } else {
                    // Flush
                    groups.push(currentGroup);
                    currentGroup = [word];
                }
            });
            // Flush last
            if (currentGroup.length > 0) groups.push(currentGroup);

            // Render Groups
            groups.forEach(group => {
                const text = group.map(w => w.text).join(' ');

                // Calculate union bbox
                const x0 = group[0].bbox.x0;
                const y0 = Math.min(...group.map(w => w.bbox.y0));
                const x1 = group[group.length - 1].bbox.x1;
                // use max y1 to cover descenders
                const y1 = Math.max(...group.map(w => w.bbox.y1));

                const w = x1 - x0;
                const h = y1 - y0;

                const el = document.createElement('div');
                el.textContent = text;
                el.className = 'text-item';

                // Adaptive Background & Canvas Erasure
                const bg = getAverageColor(context, x0, y0, w, h);

                // Expand the erasure box slightly
                context.fillStyle = bg;
                context.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);

                el.style.backgroundColor = 'transparent';

                // Text color
                const rgb = bg.match(/\d+/g);
                if (rgb) {
                    const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
                    el.style.color = brightness < 128 ? 'white' : 'black';
                } else {
                    el.style.color = 'black';
                }

                // Style
                el.style.left = `${x0}px`;
                el.style.top = `${y0}px`;
                el.style.fontSize = `${h * 0.9}px`; // Rough text fit
                el.style.fontFamily = 'sans-serif';
                el.style.padding = '0 1px';
                el.style.boxSizing = 'border-box';

                // Attach
                pageTextItems.push({
                    original: text,
                    element: el,
                    width: w / state.scale,
                });

                textLayerDiv.appendChild(el);
            });

        } catch (ocrErr) {
            console.error(ocrErr);
            log(`OCR Failed on page ${pageNum}. Falling back to standard text.`);
            // For now, let's just alert
        }

    } else {
        // Standard PDF Text Extraction
        const textContent = await page.getTextContent();
        const styles = textContent.styles;

        textContent.items.forEach(item => {
            if (!item.str.trim()) return;

            const el = document.createElement('div');
            el.textContent = item.str;
            el.className = 'text-item';

            // Get font style info
            const fontStyle = styles[item.fontName] || {};

            // Transform Calculation
            const tx = multiplyTransform(viewport.transform, item.transform);

            // Font Size
            let fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);

            // Position
            const ascent = fontStyle.ascent || 0.9;
            const scaledFontSize = fontSize * state.scale;

            // Adjust Top
            const yOffset = tx[5] - (scaledFontSize * ascent);

            el.style.left = `${tx[4]}px`;
            el.style.top = `${yOffset}px`;
            el.style.fontSize = `${scaledFontSize}px`;

            // Font Family
            if (fontStyle.fontFamily) {
                el.style.fontFamily = fontStyle.fontFamily;
            } else {
                el.style.fontFamily = 'sans-serif';
            }

            el.style.padding = '0 1px';
            el.style.boxSizing = 'border-box';

            pageTextItems.push({
                original: item.str,
                element: el,
                width: item.width
            });

            textLayerDiv.appendChild(el);
        });
    }

    state.pages.push(pageTextItems);
}

// Translation Logic
async function translatePDF() {
    translateBtn.disabled = true;
    translateBtn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Translating...`;

    // Show progress container
    progressContainer.style.display = 'block';
    progressStatusText.textContent = "Starting Translation...";
    progressBar.style.width = '0%';
    progressPercentage.textContent = '0%';

    // Auto-detect provider if key mismatch
    if (state.apiKey) {
        if (state.apiKey.startsWith('AIza')) {
            // Both Gemini and Google Cloud use AIza prefix usually, but let's default to what logic says or keep user choice if already Google
            // If user selected google, keep it. If OpenAI selected but key is AIza, guess.
            if (state.provider === 'openai') {
                state.provider = 'gemini'; // Default fallback
                providerSelect.value = 'gemini';
                updateHelpText();
                log('Detected Google-like Key. Switched provider.');
            }
        } else if (state.apiKey.startsWith('sk-')) {
            state.provider = 'openai';
            providerSelect.value = 'openai';
            updateHelpText();
        }
    }

    try {
        const provider = state.provider;
        let performTranslation;

        // If provider is not free and no key, warn (unless mock mode requested technically, but let's assume specific selection)
        if (provider !== 'free' && !state.apiKey) {
            // Check if mock implicitly
            performTranslation = mockTranslate;
        } else {
            if (provider === 'openai') performTranslation = realTranslateOpenAI;
            else if (provider === 'gemini') performTranslation = realTranslateGemini;
            else if (provider === 'google') performTranslation = realTranslateGoogle;
            else if (provider === 'free') performTranslation = realTranslateFree;
            else performTranslation = mockTranslate;
        }

        log(`Starting translation (Provider: ${provider})...`);

        // Collect all text to process efficiently
        const totalPages = state.pages.length;
        for (let i = 0; i < totalPages; i++) {
            log(`Translating page ${i + 1}/${totalPages}...`);

            // Update Progress
            const pct = Math.round(((i) / totalPages) * 100);
            progressBar.style.width = `${pct}%`;
            progressPercentage.textContent = `${pct}%`;
            progressStatusText.textContent = `Translating Page ${i + 1} of ${totalPages}`;

            const pageItems = state.pages[i];

            // Extract strings
            const texts = pageItems.map(p => p.original);

            // Translate batch
            let translatedTexts;
            try {
                translatedTexts = await performTranslation(texts, state.targetLang);
            } catch (prioError) {
                // If batch fails, maybe try smaller chunks or just fail page
                throw prioError;
            }

            // Update DOM
            pageItems.forEach((item, index) => {
                if (translatedTexts && translatedTexts[index]) {
                    item.element.textContent = translatedTexts[index];
                    item.element.dataset.translated = "true";

                    // Auto-scaling logic
                    // Calculate original width in current viewport pixels
                    // item.width is PDF units. state.scale is the scale factor used for viewport.
                    const originalPixelWidth = item.width * state.scale;

                    // We allow a tiny buffer (5%) because PDF rendering can be slightly different from DOM font rendering
                    const maxAllowedWidth = originalPixelWidth * 1.05;

                    // Measure current width of the new text
                    const currentWidth = item.element.offsetWidth;

                    if (currentWidth > maxAllowedWidth) {
                        // Calculate ratio to shrink
                        const ratio = maxAllowedWidth / currentWidth;
                        const currentFontSize = parseFloat(item.element.style.fontSize);

                        // Apply new font size
                        const newFontSize = currentFontSize * ratio;
                        item.element.style.fontSize = `${newFontSize}px`;

                        // Optional: Adjust top position to keep baseline somewhat aligned if font shrinks drastically
                        // But simpler is safer for now.
                    }
                }
            });

            // End of page success, bump progress slightly visually?
            // Or just wait for next iteration
        }

        // Finalize 100%
        progressBar.style.width = '100%';
        progressPercentage.textContent = '100%';
        progressStatusText.textContent = "Translation Complete!";

        log('Translation complete!');
        downloadBtn.style.display = 'flex';

        // Hide progress after a short delay
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 2000);

    } catch (err) {
        console.error(err);
        log('Translation failed: ' + err.message);
        alert('Translation failed. Check console for details.');
        progressContainer.style.display = 'none';
    } finally {
        translateBtn.disabled = false;
        translateBtn.innerHTML = `<i data-lucide="sparkles"></i> <span>Translate PDF</span>`;
        lucide.createIcons();
    }
}

async function mockTranslate(texts, lang) {
    // Simulate delay
    await new Promise(r => setTimeout(r, 500));
    const prefix = `[${lang.toUpperCase()}]`;
    return texts.map(t => {
        if (/^[\d\s\W]+$/.test(t)) return t;
        return `${prefix} ${t}`;
    });
}

async function realTranslateOpenAI(texts, lang) {
    const API_URL = 'https://api.openai.com/v1/chat/completions';
    const prompt = `Translate the following array of text strings into ${lang}. Return ONLY a JSON array of strings. Maintain original order exactly. \n\n${JSON.stringify(texts)}`;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are a helpful translator helper." },
                { role: "user", content: prompt }
            ],
            temperature: 0.3
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const content = data.choices[0].message.content;
    return parseJSONResponse(content, texts);
}

async function realTranslateGemini(texts, lang) {
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    let model = 'gemini-1.5-flash'; // Default start

    // Helper to perform the call
    const generate = async (modelName) => {
        // Ensure model name has 'models/' prefix if missing
        const cleanName = modelName.includes('/') ? modelName.split('/')[1] : modelName;
        const url = `${baseUrl}/models/${cleanName}:generateContent?key=${state.apiKey}`;

        const prompt = `Translate the following array of text strings into ${lang}. Return ONLY a JSON array of strings. Maintain original order exactly. \n\n${JSON.stringify(texts)}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        return data;
    };

    try {
        log(`Trying Gemini model: ${model}...`);
        const data = await generate(model);

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error(data.error?.message || "No translation candidates returned (Safety filter?)");
        }

        const content = data.candidates[0].content.parts[0].text;
        return parseJSONResponse(content, texts);
    } catch (err) {
        log(`Model ${model} failed: ${err.message}`);
        log('Attempting to discover available models...');

        // Auto-discovery
        try {
            const listUrl = `${baseUrl}/models?key=${state.apiKey}`;
            const listResp = await fetch(listUrl);
            const listData = await listResp.json();

            if (listData.models) {
                // Find first model that supports generateContent
                const validModel = listData.models.find(m =>
                    m.supportedGenerationMethods &&
                    m.supportedGenerationMethods.includes('generateContent') &&
                    (m.name.includes('gemini') || m.name.includes('flash') || m.name.includes('pro'))
                );

                if (validModel) {
                    log(`Found available model: ${validModel.name}. Retrying...`);
                    const data = await generate(validModel.name);

                    if (!data.candidates || data.candidates.length === 0) {
                        throw new Error("Retry failed: No candidates returned.");
                    }

                    const content = data.candidates[0].content.parts[0].text;
                    return parseJSONResponse(content, texts);
                }
            }
            throw new Error("No suitable Gemini models found for this API key.");
        } catch (discoveryErr) {
            throw new Error(`Auto-discovery failed: ${discoveryErr.message}`);
        }
    }
}

async function realTranslateGoogle(texts, lang) {
    const API_URL = `https://translation.googleapis.com/language/translate/v2?key=${state.apiKey}`;

    // Google Cloud Translation V2 API
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            q: texts,
            target: lang,
            format: 'text' // or html
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    // Structure: { data: { translations: [ { translatedText: "..." }, ... ] } }
    if (data.data && data.data.translations) {
        return data.data.translations.map(t => {
            // Google Translate returns HTML entities (e.g. &#39;) sometimes even if format is text
            // Decoding them simply:
            const txt = document.createElement("textarea");
            txt.innerHTML = t.translatedText;
            return txt.value;
        });
    }

    throw new Error('Invalid response from Google Translate API');
}

async function realTranslateFree(texts, lang) {
    const translated = [];
    const sourceLang = 'en';
    const pair = `${sourceLang}|${lang}`;
    const delay = ms => new Promise(res => setTimeout(res, ms));

    log("Using Free API (MyMemory). Speed is limited...");

    for (const text of texts) {
        if (!text.trim() || /^\d+$/.test(text)) {
            translated.push(text);
            continue;
        }

        try {
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.responseStatus === 200) {
                translated.push(data.responseData.translatedText);
            } else {
                translated.push(text);
            }
            await delay(200); // Be nice to API
        } catch (e) {
            translated.push(text);
        }
    }
    return translated;
}

function parseJSONResponse(content, originalTexts) {
    try {
        // Clean up markdown code blocks if present (common in LLM output)
        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanContent);
    } catch (e) {
        console.warn("Model output not pure JSON, trying to recover", content);
        // Fallback: simple split or just return errors
        return originalTexts.map(t => "[Error] " + t);
    }
}

// Download Logic
async function downloadPDF() {
    downloadBtn.disabled = true;
    log('Generating PDF...');

    try {
        const { jsPDF } = window.jspdf;
        const newPdf = new jsPDF({
            unit: 'pt', // points match PDF generally
        });

        const wrappers = document.querySelectorAll('.page-wrapper');

        for (let i = 0; i < wrappers.length; i++) {
            const wrapper = wrappers[i];

            if (i > 0) newPdf.addPage();

            // Use html2canvas to screenshot the wrapper (visual state)
            const canvas = await html2canvas(wrapper, {
                scale: 2, // Higher quality
                useCORS: true,
                logging: false
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const pdfWidth = newPdf.internal.pageSize.getWidth();
            const pdfHeight = newPdf.internal.pageSize.getHeight();

            // Center fit
            newPdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

            log(`Processed page ${i + 1}`);
        }

        const originalName = state.filename || 'document.pdf';
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
        newPdf.save(`${nameWithoutExt}_translated.pdf`);
        log('Download started.');
    } catch (err) {
        console.error(err);
        log('Download failed: ' + err.message);
    } finally {
        downloadBtn.disabled = false;
    }
}

// Matrix Helper
function multiplyTransform(m1, m2) {
    // m1 = [a1, b1, c1, d1, e1, f1]
    // m2 = [a2, b2, c2, d2, e2, f2]
    // result = m1 * m2
    const [a1, b1, c1, d1, e1, f1] = m1;
    const [a2, b2, c2, d2, e2, f2] = m2;
    return [
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1
    ];
}

function getAverageColor(context, x, y, w, h) {
    // Safety check
    if (w <= 0 || h <= 0) return 'white';

    // Sample a small area around the edges (border) of the box to find the background
    // We avoid the center because it likely contains the black text we want to hide!
    try {
        // Sample top-left corner just inside
        const p = context.getImageData(x, y, 1, 1).data;
        // Or maybe sample a few points and average, but strict background usually is consistent.

        // Let's sample the top-left pixel. 
        // Ideally we'd scan the histogram of the border, but that's expensive.
        // Assuming solid background for simple docs.
        return `rgb(${p[0]}, ${p[1]}, ${p[2]})`;
    } catch (e) {
        return 'white';
    }
}
