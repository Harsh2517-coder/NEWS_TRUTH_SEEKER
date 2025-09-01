// News Truth Seeker Application
class NewsAnalyzer {
    constructor() {
        this.currentMode = 'url';
        this.currentFile = null;
        this.charts = {};
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeTheme();
        this.setupFileUpload();
    }

    bindEvents() {
        // Mode switching
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchMode(e.target.dataset.mode));
        });

        // Analysis buttons
        document.getElementById('analyze-url').addEventListener('click', () => this.analyzeURL());
        document.getElementById('analyze-text').addEventListener('click', () => this.analyzeText());
        document.getElementById('analyze-file').addEventListener('click', () => this.analyzeFile());

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        // Try again button
        document.getElementById('try-again').addEventListener('click', () => this.hideError());

        // Enter key handling
        document.getElementById('news-url').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.analyzeURL();
        });

        // Smooth scrolling for navigation
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    switchMode(mode) {
        this.currentMode = mode;
        
        // Update buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Update sections
        document.querySelectorAll('.input-section').forEach(section => {
            section.classList.toggle('active', section.id === `${mode}-input`);
        });

        // Clear previous results and errors
        this.hideResults();
        this.hideError();
    }

    async analyzeURL() {
        const urlInput = document.getElementById('news-url');
        const url = urlInput.value.trim();

        if (!url) {
            this.showError('Please enter a valid URL');
            return;
        }

        if (!this.isValidURL(url)) {
            this.showError('Please enter a valid HTTP/HTTPS URL');
            return;
        }

        const payload = { url };
        await this.performAnalysis(payload);
    }

    async analyzeText() {
        const titleInput = document.getElementById('article-title');
        const textInput = document.getElementById('article-text');
        
        const title = titleInput.value.trim();
        const text = textInput.value.trim();

        if (!text) {
            this.showError('Please enter some article text to analyze');
            return;
        }

        if (text.length < 50) {
            this.showError('Please enter at least 50 characters for meaningful analysis');
            return;
        }

        const payload = {
            manual: true,
            title: title || 'Untitled Article',
            text: text
        };

        await this.performAnalysis(payload);
    }

    async analyzeFile() {
        if (!this.currentFile) {
            this.showError('Please upload a file first');
            return;
        }

        try {
            this.showLoading();

            // Upload file first
            const formData = new FormData();
            formData.append('file', this.currentFile);

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const uploadData = await uploadResponse.json();

            if (!uploadData.success) {
                throw new Error(uploadData.error || 'File upload failed');
            }

            // Analyze the extracted text
            const payload = {
                manual: true,
                title: uploadData.filename || 'Uploaded Document',
                text: uploadData.text
            };

            await this.performAnalysis(payload, false); // Don't show loading again

        } catch (error) {
            this.hideLoading();
            this.showError(error.message);
        }
    }

    async performAnalysis(payload, showLoading = true) {
        try {
            if (showLoading) {
                this.showLoading();
            }

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Analysis failed');
            }

            this.hideLoading();
            this.displayResults(data);

        } catch (error) {
            this.hideLoading();
            this.showError(error.message);
        }
    }

    displayResults(data) {
        this.hideError();
        
        const resultsSection = document.getElementById('results');
        
        resultsSection.innerHTML = `
            <div class="results-header">
                <h2 class="results-title">${this.escapeHtml(data.title)}</h2>
                <div class="language-badge">
                    <i class="fas fa-language"></i>
                    <span>Language: ${data.language.toUpperCase()}</span>
                </div>
            </div>

            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Bias Classification</div>
                    <div class="metric-value">${data.bias_analysis.bias}</div>
                    <div class="metric-description">Overall bias detection</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Polarity Score</div>
                    <div class="metric-value">${data.bias_analysis.polarity}</div>
                    <div class="metric-description">Sentiment direction (-1 to 1)</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Subjectivity</div>
                    <div class="metric-value">${data.bias_analysis.subjectivity}</div>
                    <div class="metric-description">Opinion vs. fact (0 to 1)</div>
                </div>
                ${this.getReliabilityMetric(data.source_reliability)}
            </div>

            <div class="analysis-section">
                <h3 class="section-title">
                    <i class="fas fa-chart-line"></i>
                    Bias Visualization
                </h3>
                <div class="chart-container">
                    <canvas id="bias-chart" width="400" height="200"></canvas>
                </div>
            </div>

            ${this.getPoliticalAnalysis(data.political_leaning)}
            ${this.getSourceReliability(data.source_reliability)}
            ${this.getSentenceBreakdown(data.tone_breakdown)}
            ${this.getArticleText(data)}
        `;

        resultsSection.style.display = 'block';
        
        // Create bias visualization
        this.createBiasChart(data.bias_analysis);
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Setup expandable sections
        this.setupExpandableSections();
    }

    getReliabilityMetric(reliability) {
        if (typeof reliability.score === 'number') {
            return `
                <div class="metric-card">
                    <div class="metric-label">Source Reliability</div>
                    <div class="metric-value">${reliability.score}</div>
                    <div class="metric-description">${reliability.label}</div>
                </div>
            `;
        }
        return '';
    }

    getPoliticalAnalysis(politicalData) {
        if (!politicalData || Object.keys(politicalData).length === 0) {
            return `
                <div class="analysis-section">
                    <h3 class="section-title">
                        <i class="fas fa-vote-yea"></i>
                        Political Sentiment Analysis
                    </h3>
                    <p style="color: hsl(var(--on-surface-variant)); text-align: center; padding: 2rem;">
                        No significant political party mentions detected in this article.
                    </p>
                </div>
            `;
        }

        const politicalItems = Object.entries(politicalData)
            .map(([party, score]) => {
                const sentiment = this.getSentimentClass(score);
                const icon = this.getSentimentIcon(score);
                return `
                    <div class="political-item">
                        <span class="political-party">${party}</span>
                        <span class="sentiment-score ${sentiment}">
                            <i class="${icon}"></i>
                            ${score.toFixed(3)}
                        </span>
                    </div>
                `;
            })
            .join('');

        return `
            <div class="analysis-section">
                <h3 class="section-title">
                    <i class="fas fa-vote-yea"></i>
                    Political Sentiment Analysis
                </h3>
                <div style="margin-bottom: 1rem;">
                    ${politicalItems}
                </div>
                <div class="chart-container">
                    <canvas id="political-chart" width="400" height="200"></canvas>
                </div>
            </div>
        `;
    }

    getSourceReliability(reliability) {
        if (typeof reliability.score !== 'number') {
            return `
                <div class="analysis-section">
                    <h3 class="section-title">
                        <i class="fas fa-shield-alt"></i>
                        Source Reliability
                    </h3>
                    <div class="reliability-gauge">
                        <p style="color: hsl(var(--on-surface-variant)); text-align: center;">
                            Source reliability data not available for this content.
                        </p>
                    </div>
                </div>
            `;
        }

        const reliabilityClass = this.getReliabilityClass(reliability.score);
        
        return `
            <div class="analysis-section">
                <h3 class="section-title">
                    <i class="fas fa-shield-alt"></i>
                    Source Reliability
                </h3>
                <div class="reliability-gauge">
                    <div class="reliability-score ${reliabilityClass}">${reliability.score}/100</div>
                    <div class="reliability-label ${reliabilityClass}">${reliability.label}</div>
                    <div class="chart-container">
                        <canvas id="reliability-chart" width="300" height="300"></canvas>
                    </div>
                </div>
            </div>
        `;
    }

    getSentenceBreakdown(toneData) {
        if (!toneData || toneData.length === 0) {
            return '';
        }

        const sentences = toneData
            .slice(0, 10) // Limit to first 10 sentences
            .map(item => {
                const sentimentClass = this.getSentimentClass(item.polarity);
                const mentions = item.mentions && item.mentions.length > 0 
                    ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: hsl(var(--primary));">
                         <i class="fas fa-tags"></i> ${item.mentions.join(', ')}
                       </div>` 
                    : '';
                
                return `
                    <div class="sentence-item sentence-${sentimentClass}">
                        <div class="sentence-text">${this.escapeHtml(item.sentence)}</div>
                        <div class="sentence-metrics">
                            <span>Polarity: ${item.polarity.toFixed(3)}</span>
                            <span>Subjectivity: ${item.subjectivity.toFixed(3)}</span>
                        </div>
                        ${mentions}
                    </div>
                `;
            })
            .join('');

        return `
            <div class="expandable-section">
                <div class="expandable-header">
                    <h3 class="section-title" style="margin-bottom: 0;">
                        <i class="fas fa-microscope"></i>
                        Sentence-by-Sentence Analysis
                    </h3>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div class="expandable-content">
                    ${sentences}
                </div>
            </div>
        `;
    }

    getArticleText(data) {
        if (!data.text) return '';

        const showTranslation = data.translated_text && data.language !== 'en';
        
        return `
            <div class="expandable-section">
                <div class="expandable-header">
                    <h3 class="section-title" style="margin-bottom: 0;">
                        <i class="fas fa-file-text"></i>
                        Article Content
                    </h3>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div class="expandable-content">
                    ${showTranslation ? `
                        <div style="margin-bottom: 1rem;">
                            <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">
                                <input type="radio" name="text-version" value="translated" checked style="margin-right: 0.5rem;">
                                Translated to English
                            </label>
                            <label style="font-weight: 600; margin-bottom: 1rem; display: block;">
                                <input type="radio" name="text-version" value="original" style="margin-right: 0.5rem;">
                                Original (${data.language.toUpperCase()})
                            </label>
                        </div>
                        <div id="translated-text" class="text-display">
                            ${this.escapeHtml(data.translated_text)}
                        </div>
                        <div id="original-text" class="text-display" style="display: none;">
                            ${this.escapeHtml(data.text)}
                        </div>
                    ` : `
                        <div class="text-display">
                            ${this.escapeHtml(data.text)}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    createBiasChart(biasData) {
        const ctx = document.getElementById('bias-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.bias) {
            this.charts.bias.destroy();
        }

        this.charts.bias = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Polarity', 'Subjectivity'],
                datasets: [{
                    label: 'Bias Metrics',
                    data: [biasData.polarity, biasData.subjectivity],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.6)',
                        'rgba(16, 185, 129, 0.6)'
                    ],
                    borderColor: [
                        'rgba(59, 130, 246, 1)',
                        'rgba(16, 185, 129, 1)'
                    ],
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label;
                                const value = context.parsed.y;
                                if (label === 'Polarity') {
                                    return `Polarity: ${value.toFixed(3)} (${value > 0 ? 'Positive' : value < 0 ? 'Negative' : 'Neutral'})`;
                                } else {
                                    return `Subjectivity: ${value.toFixed(3)} (${value > 0.5 ? 'Subjective' : 'Objective'})`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        min: -1,
                        max: 1,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    setupExpandableSections() {
        document.querySelectorAll('.expandable-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                const icon = header.querySelector('i:last-child');
                
                content.classList.toggle('expanded');
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            });
        });

        // Setup text version switching
        document.querySelectorAll('input[name="text-version"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const translatedDiv = document.getElementById('translated-text');
                const originalDiv = document.getElementById('original-text');
                
                if (e.target.value === 'translated') {
                    translatedDiv.style.display = 'block';
                    originalDiv.style.display = 'none';
                } else {
                    translatedDiv.style.display = 'none';
                    originalDiv.style.display = 'block';
                }
            });
        });
    }

    setupFileUpload() {
        const dropArea = document.getElementById('file-drop-area');
        const fileInput = document.getElementById('file-input-element');
        const browseBtn = document.querySelector('.browse-btn');
        const fileInfo = document.getElementById('file-info');
        const analyzeBtn = document.getElementById('analyze-file');

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
        });

        // Handle dropped files
        dropArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFileSelect(files[0]);
        }, false);

        // Handle browse button click
        browseBtn.addEventListener('click', () => fileInput.click());
        dropArea.addEventListener('click', () => fileInput.click());

        // Handle file input change
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        // Handle file removal
        document.addEventListener('click', (e) => {
            if (e.target.closest('.remove-file')) {
                this.removeFile();
            }
        });
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    handleFileSelect(file) {
        if (!file) return;

        // Validate file type
        const allowedTypes = ['text/plain', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            this.showError('Please upload a .txt or .pdf file only');
            return;
        }

        // Validate file size (16MB)
        if (file.size > 16 * 1024 * 1024) {
            this.showError('File size must be less than 16MB');
            return;
        }

        this.currentFile = file;
        this.showFileInfo(file);
    }

    showFileInfo(file) {
        const fileInfo = document.getElementById('file-info');
        const fileName = fileInfo.querySelector('.file-name');
        const analyzeBtn = document.getElementById('analyze-file');

        fileName.textContent = file.name;
        fileInfo.style.display = 'block';
        analyzeBtn.style.display = 'block';

        this.hideError();
    }

    removeFile() {
        this.currentFile = null;
        document.getElementById('file-info').style.display = 'none';
        document.getElementById('analyze-file').style.display = 'none';
        document.getElementById('file-input-element').value = '';
    }

    getSentimentClass(score) {
        if (score > 0.2) return 'positive';
        if (score < -0.2) return 'negative';
        return 'neutral';
    }

    getSentimentIcon(score) {
        if (score > 0.2) return 'fas fa-smile';
        if (score < -0.2) return 'fas fa-frown';
        return 'fas fa-meh';
    }

    getReliabilityClass(score) {
        if (score >= 80) return 'reliability-high';
        if (score >= 60) return 'reliability-medium';
        return 'reliability-low';
    }

    isValidURL(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
        this.hideResults();
        this.hideError();
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error').style.display = 'block';
        this.hideLoading();
        this.hideResults();
        
        // Scroll to error
        document.getElementById('error').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    hideError() {
        document.getElementById('error').style.display = 'none';
    }

    hideResults() {
        document.getElementById('results').style.display = 'none';
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        const themeIcon = document.querySelector('#theme-toggle i');
        themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NewsAnalyzer();
});

// Add smooth scroll behavior for better UX
document.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (window.scrollY > 100) {
        header.style.background = 'hsla(var(--surface) / 0.95)';
    } else {
        header.style.background = 'hsl(var(--surface))';
    }
});