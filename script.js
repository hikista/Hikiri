/* ============================================
   SAKURA NO YAKUSOKU — SCRIPT
   Loads novel from external .htm file
   Author: Hiki
   ============================================ */

(function () {
  if (window.__novelAppInit) return;
  window.__novelAppInit = true;

  /* ==========================================
     CONFIGURATION — Change this to your file!
     ========================================== */
  const NOVEL_FILE = 'novel.htm';

  document.addEventListener('DOMContentLoaded', () => {

    // === DOM Elements ===
    const progressBar = document.getElementById('progressBar');
    const sakuraContainer = document.getElementById('sakuraContainer');
    const floatingControls = document.getElementById('floatingControls');
    const themeToggle = document.getElementById('themeToggle');
    const fontSizeBtn = document.getElementById('fontSizeBtn');
    const fontPanel = document.getElementById('fontPanel');
    const fontDecrease = document.getElementById('fontDecrease');
    const fontIncrease = document.getElementById('fontIncrease');
    const fontValue = document.getElementById('fontValue');
    const fontSlider = document.getElementById('fontSlider');
    const focusBtn = document.getElementById('focusBtn');
    const backToTop = document.getElementById('backToTop');
    const startReading = document.getElementById('startReading');
    const scrollHint = document.getElementById('scrollHint');
    const storyContent = document.getElementById('storyContent');
    const storySection = document.getElementById('storySection');
    const loadingSection = document.getElementById('loadingSection');
    const trueEndingBtn = document.getElementById('trueEndingBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalYes = document.getElementById('modalYes');
    const modalNo = document.getElementById('modalNo');
    const trueEndingSection = document.getElementById('trueEndingSection');
    const trueEndingContent = document.getElementById('trueEndingContent');
    const endingBanner = document.getElementById('endingBanner');

    // === State ===
    let currentFontSize = parseInt(localStorage.getItem('novelFontSize')) || 18;
    let currentTheme = localStorage.getItem('novelTheme') || 'dark';
    let focusModeOn = false;
    let lastScrollY = 0;
    let scrollTimeout = null;
    let controlsVisible = true;

    // === Init ===
    document.documentElement.setAttribute('data-theme', currentTheme);
    applyFontSize(currentFontSize);
    createSakuraPetals();
    bindEvents();

    // Load the novel!
    loadNovel();

    /* ==========================================
       LOAD & PARSE NOVEL FROM .HTM FILE
       ========================================== */
    async function loadNovel() {
      try {
        const response = await fetch(NOVEL_FILE);
        if (!response.ok) throw new Error('File not found');

        const html = await response.text();
        const parsed = parseWordHTML(html);

        // Update hero with extracted metadata
        if (parsed.title) {
          document.getElementById('heroTitle').textContent = parsed.title;
          document.title = parsed.title + ' — by Hiki';
        }
        if (parsed.subtitle) {
          document.getElementById('heroSubtitle').textContent = parsed.subtitle;
        }
        if (parsed.author) {
          document.getElementById('heroAuthor').textContent = parsed.author;
        }
        if (parsed.genre) {
          document.getElementById('statGenre').textContent = '🌸 ' + parsed.genre;
        }

        // Render main story
        renderStory(parsed.mainStory, storyContent);

        // Render true ending if it exists
        if (parsed.trueEnding.length > 0) {
          renderStory(parsed.trueEnding, trueEndingContent);
          endingBanner.style.display = 'block';
        } else {
          endingBanner.style.display = 'none';
        }

        // Calculate stats (main story only)
        const allText = parsed.mainStory.map(p => p.text).join(' ');
        const wordCount = allText.split(/\s+/).filter(w => w.length > 0).length;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));
        document.getElementById('statWords').textContent =
          `📖 ~${readingTime} min read · ${wordCount.toLocaleString()} words`;

        // Show story, hide loading
        loadingSection.style.display = 'none';
        storySection.style.display = 'block';

        // Setup paragraph reveal
        setupParagraphReveal();

      } catch (err) {
        console.error('Failed to load novel:', err);
        // Just hide loading and show story section with a simple message
        loadingSection.style.display = 'none';
        storySection.style.display = 'block';
        storyContent.innerHTML = '<p class="visible" style="text-align:center;color:var(--text-muted);font-style:italic;">Place your novel.htm file in the same folder to begin reading.</p>';
        endingBanner.style.display = 'none';
      }
    }

    /* ==========================================
       PARSE WORD HTML
       Splits into main story + true ending
       ========================================== */
    function parseWordHTML(html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      let title = '';
      let subtitle = '';
      let author = '';
      let genre = '';
      const mainStory = [];
      const trueEnding = [];
      let isTrueEnding = false;
      let isFirstParagraph = true;
      let isFirstTrueEndingParagraph = true;

      // --- Extract Title ---
      const titleEl = doc.querySelector('.MsoTitle, h1');
      if (titleEl) {
        title = cleanText(titleEl.textContent);
      } else {
        const docTitle = doc.querySelector('title');
        if (docTitle && docTitle.textContent.trim()) {
          title = cleanText(docTitle.textContent);
        }
      }

      // --- Extract Subtitle ---
      const subtitleEl = doc.querySelector('.MsoSubtitle, h2');
      if (subtitleEl) {
        subtitle = cleanText(subtitleEl.textContent);
      }

      // --- Extract all paragraphs ---
      const allElements = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6');

      allElements.forEach(el => {
        const text = cleanText(el.textContent);

        // Skip empty
        if (!text || text === '\u00a0' || text.length < 2) return;

        // Skip title and subtitle already extracted
        if (text === title || text === subtitle) return;

        // Extract author
        const authorMatch = text.match(/^(?:Author|Writer|By|Penulis|Pengarang)\s*[:\-–—]\s*(.+)/i);
        if (authorMatch && !author) {
          author = authorMatch[1].trim();
          return;
        }

        // Extract genre
        const genreMatch = text.match(/^(?:Genre|Kategori)\s*[:\-–—]\s*(.+)/i);
        if (genreMatch && !genre) {
          genre = genreMatch[1].trim();
          return;
        }

        // Detect TRUE ENDING marker
        if (/true\s*ending/i.test(text) && (
          el.tagName.match(/^H[1-6]$/) ||
          text.length < 40
        )) {
          isTrueEnding = true;
          return;
        }

        // Detect "The End" marker (for main story end)
        if (/^[\—\-–—\s]*(The End|Tamat|Fin|End|Selesai|おわり|終)[\—\-–—\s]*$/i.test(text)) {
          if (!isTrueEnding) {
            mainStory.push({ type: 'story-end', text: text });
          } else {
            trueEnding.push({ type: 'story-end', text: text });
          }
          return;
        }

        // Detect scene breaks
        if (/^[✿\s]+$/.test(text) || /^\*\s*\*\s*\*/.test(text) ||
            /^-\s*-\s*-/.test(text) || /^[=~]{3,}$/.test(text) ||
            /^[·•◆◇★☆♦♠♣♥❀❁❃✾❊❋※]{3,}$/.test(text.replace(/\s/g, ''))) {
          const target = isTrueEnding ? trueEnding : mainStory;
          target.push({ type: 'scene-break', text: '✿ ✿ ✿' });
          return;
        }

        // Check paragraph style
        const style = el.getAttribute('style') || '';
        const isCentered = style.includes('text-align:center') || style.includes('text-align: center');
        const isItalic = el.querySelector('i, em, .MsoIntenseEmphasis') !== null ||
          style.includes('font-style:italic') || style.includes('font-style: italic');

        // Determine type
        let type = 'normal';

        if (isCentered && (isItalic || text.startsWith('"') || text.startsWith('\u201C'))) {
          type = 'dialogue';
        } else if (isCentered && isItalic) {
          type = 'last-line';
        } else if (!isTrueEnding && isFirstParagraph) {
          type = 'drop-cap';
          isFirstParagraph = false;
        } else if (isTrueEnding && isFirstTrueEndingParagraph) {
          type = 'drop-cap';
          isFirstTrueEndingParagraph = false;
        }

        const target = isTrueEnding ? trueEnding : mainStory;
        target.push({ type, text });
      });

      return { title, subtitle, author, genre, mainStory, trueEnding };
    }

    /* ==========================================
       CLEAN TEXT FROM WORD ARTIFACTS
       ========================================== */
    function cleanText(text) {
      return text
        .replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
        .replace(/\u00a0/g, ' ')
        .replace(/\r\n|\r/g, '\n')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    /* ==========================================
       RENDER STORY INTO DOM
       ========================================== */
    function renderStory(paragraphs, container) {
      container.innerHTML = '';

      paragraphs.forEach((para) => {
        const p = document.createElement('p');

        switch (para.type) {
          case 'drop-cap':
            p.className = 'drop-cap';
            p.textContent = para.text;
            break;
          case 'dialogue':
            p.className = 'dialogue';
            p.textContent = para.text;
            break;
          case 'scene-break':
            p.className = 'scene-break';
            p.textContent = para.text;
            break;
          case 'last-line':
            p.className = 'last-line';
            p.textContent = para.text;
            break;
          case 'story-end':
            p.className = 'story-end';
            p.textContent = para.text;
            break;
          default:
            p.textContent = para.text;
            break;
        }

        container.appendChild(p);
      });
    }

    /* ==========================================
       TRUE ENDING — Modal & Navigation
       ========================================== */
    function showModal() {
      modalOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function hideModal() {
      modalOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    function goToTrueEnding() {
      hideModal();
      trueEndingSection.style.display = 'block';

      // Small delay for DOM render, then scroll
      setTimeout(() => {
        trueEndingSection.scrollIntoView({ behavior: 'smooth' });

        // Setup paragraph reveal for true ending content
        const paragraphs = trueEndingContent.querySelectorAll('p');
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        paragraphs.forEach(p => observer.observe(p));
      }, 100);
    }

    /* ==========================================
       THEME TOGGLE
       ========================================== */
    function toggleTheme() {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', currentTheme);
      localStorage.setItem('novelTheme', currentTheme);
    }

    /* ==========================================
       FONT SIZE
       ========================================== */
    function applyFontSize(size) {
      size = Math.max(14, Math.min(28, size));
      currentFontSize = size;
      document.documentElement.style.setProperty('--font-size', size + 'px');
      fontValue.textContent = size + 'px';
      fontSlider.value = size;
      localStorage.setItem('novelFontSize', size);
    }

    /* ==========================================
       FOCUS MODE
       ========================================== */
    function toggleFocusMode() {
      focusModeOn = !focusModeOn;
      document.body.classList.toggle('focus-mode', focusModeOn);
      focusBtn.textContent = focusModeOn ? '👁️‍🗨️' : '👁️';
    }

    /* ==========================================
       SAKURA PETALS
       ========================================== */
    function createSakuraPetals() {
      const count = window.innerWidth < 768 ? 10 : 20;
      for (let i = 0; i < count; i++) {
        setTimeout(() => createPetal(), i * 700);
      }
      setInterval(() => createPetal(), 3000);
    }

    function createPetal() {
      const petal = document.createElement('div');
      petal.className = 'sakura-petal';
      const size = 8 + Math.random() * 14;
      const left = Math.random() * 100;
      const duration = 8 + Math.random() * 12;
      const delay = Math.random() * 2;
      const drift = -100 + Math.random() * 200;
      const spin = 180 + Math.random() * 540;
      const hue = Math.random() > 0.3 ? '340' : '320';
      const lightness = 75 + Math.random() * 15;

      petal.style.cssText = `
        left:${left}%;width:${size}px;height:${size}px;
        background:radial-gradient(ellipse at 30% 30%,hsl(${hue},80%,${lightness}%),hsl(${hue},60%,${lightness - 15}%));
        border-radius:50% 0 50% 50%;
        animation-duration:${duration}s;animation-delay:${delay}s;
        --drift:${drift}px;--spin:${spin}deg;
        filter:blur(${Math.random() > 0.5 ? 1 : 0}px);
      `;
      sakuraContainer.appendChild(petal);
      setTimeout(() => { if (petal.parentNode) petal.remove(); }, (duration + delay) * 1000);
    }

    /* ==========================================
       PARAGRAPH REVEAL ON SCROLL
       ========================================== */
    function setupParagraphReveal() {
      const paragraphs = storyContent.querySelectorAll('p');
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

      paragraphs.forEach(p => observer.observe(p));
    }

    /* ==========================================
       SCROLL HANDLING
       ========================================== */
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;

      progressBar.style.width = progress + '%';

      if (scrollTop > 600) backToTop.classList.add('visible');
      else backToTop.classList.remove('visible');

      if (scrollTop > 100) scrollHint.classList.add('hidden');
      else scrollHint.classList.remove('hidden');

      if (!focusModeOn) {
        if (scrollTop > lastScrollY && scrollTop > 200) {
          if (controlsVisible) {
            floatingControls.classList.add('hidden');
            controlsVisible = false;
          }
        } else {
          if (!controlsVisible) {
            floatingControls.classList.remove('hidden');
            controlsVisible = true;
          }
        }
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          floatingControls.classList.remove('hidden');
          controlsVisible = true;
        }, 2500);
      }

      lastScrollY = scrollTop;
    }

    /* ==========================================
       BIND EVENTS
       ========================================== */
    function bindEvents() {
      themeToggle.addEventListener('click', toggleTheme);

      fontSizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fontPanel.classList.toggle('visible');
      });

      fontDecrease.addEventListener('click', () => applyFontSize(currentFontSize - 1));
      fontIncrease.addEventListener('click', () => applyFontSize(currentFontSize + 1));
      fontSlider.addEventListener('input', (e) => applyFontSize(parseInt(e.target.value)));

      focusBtn.addEventListener('click', toggleFocusMode);

      window.addEventListener('scroll', handleScroll, { passive: true });

      startReading.addEventListener('click', () => {
        const target = storySection.style.display !== 'none' ? storySection : loadingSection;
        target.scrollIntoView({ behavior: 'smooth' });
      });

      backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      // True Ending button → show modal
      trueEndingBtn.addEventListener('click', showModal);

      // Modal Yes → go to true ending
      modalYes.addEventListener('click', goToTrueEnding);

      // Modal No → close modal
      modalNo.addEventListener('click', hideModal);

      // Click outside modal box to close
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) hideModal();
      });

      // Close font panel on outside click
      document.addEventListener('click', (e) => {
        if (!fontPanel.contains(e.target) && e.target !== fontSizeBtn) {
          fontPanel.classList.remove('visible');
        }
      });

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          fontPanel.classList.remove('visible');
          if (modalOverlay.classList.contains('active')) hideModal();
          if (focusModeOn) toggleFocusMode();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
          e.preventDefault();
          toggleTheme();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
          e.preventDefault();
          toggleFocusMode();
        }
      });
    }

    // Initial scroll check
    handleScroll();

  });
})();
