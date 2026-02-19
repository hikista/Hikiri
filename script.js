/* ============================================
   SAKURA NO YAKUSOKU — SCRIPT (Improved)
   ============================================ */

(function () {
  if (window.__novelAppInit) return;
  window.__novelAppInit = true;

  const NOVEL_FILE = 'novel.htm';

  document.addEventListener('DOMContentLoaded', () => {

    // === DOM Elements (sama seperti sebelumnya) ===
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
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    const loadingFileName = document.getElementById('loadingFileName');

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
    loadingFileName.textContent = NOVEL_FILE;

    // Load the novel!
    loadNovel();

    /* ==========================================
       LOAD & PARSE NOVEL FROM .HTM FILE
       ========================================== */
    async function loadNovel() {
      try {
        console.log('Fetching novel file:', NOVEL_FILE);
        const response = await fetch(NOVEL_FILE);
        if (!response.ok) throw new Error(`File "${NOVEL_FILE}" tidak ditemukan (${response.status})`);

        const html = await response.text();
        console.log('File loaded, length:', html.length);

        const parsed = parseWordHTML(html);
        console.log('Parsed paragraphs:', parsed.paragraphs.length);

        if (!parsed.paragraphs.length) {
          // Fallback: tampilkan cuplikan HTML mentah untuk debugging
          throw new Error('Tidak ada konten yang bisa dibaca. Coba periksa file novel.htm.');
        }

        // Update metadata
        if (parsed.title) document.getElementById('heroTitle').textContent = parsed.title;
        if (parsed.subtitle) document.getElementById('heroSubtitle').textContent = parsed.subtitle;
        if (parsed.author) document.getElementById('heroAuthor').textContent = parsed.author;
        if (parsed.genre) document.getElementById('statGenre').textContent = '🌸 ' + parsed.genre;

        // Render story
        renderStory(parsed.paragraphs);

        // Hitung statistik
        const allText = parsed.paragraphs.map(p => p.text).join(' ');
        const wordCount = allText.split(/\s+/).filter(w => w.length > 0).length;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));
        document.getElementById('statWords').textContent = `📖 ~${readingTime} min baca · ${wordCount.toLocaleString()} kata`;

        loadingSection.style.display = 'none';
        storySection.style.display = 'block';

        setupParagraphReveal();

      } catch (err) {
        console.error('Gagal memuat novel:', err);
        loadingSection.style.display = 'none';
        errorSection.style.display = 'flex';
        errorMessage.textContent = err.message;

        // Tampilkan petunjuk tambahan jika file mungkin ada tapi kosong
        if (err.message.includes('Tidak ada konten')) {
          const help = document.createElement('div');
          help.style.marginTop = '1rem';
          help.style.fontSize = '0.9rem';
          help.style.background = 'rgba(255,0,0,0.1)';
          help.style.padding = '1rem';
          help.innerHTML = '<strong>Debug:</strong> File ditemukan tetapi tidak mengandung paragraf. Pastikan file disimpan dengan benar sebagai "Web Page (.htm)" dan berisi teks.';
          errorSection.querySelector('.error-help').appendChild(help);
        }
      }
    }

    /* ==========================================
       PARSE WORD HTML - Versi lebih toleran
       ========================================== */
    function parseWordHTML(html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      let title = '';
      let subtitle = '';
      let author = '';
      let genre = '';
      const paragraphs = [];

      // Coba ambil dari <title>
      const docTitle = doc.querySelector('title');
      if (docTitle && docTitle.textContent.trim()) {
        title = cleanText(docTitle.textContent);
      }

      // Cari semua elemen yang mungkin berisi teks: p, div, h1-h6, span (jika dalam body)
      const body = doc.body;
      if (!body) return { title, subtitle, author, genre, paragraphs };

      // Ambil semua elemen yang biasanya menampung teks
      const elements = body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, span');
      let isFirstParagraph = true;

      elements.forEach(el => {
        let text = cleanText(el.textContent);
        if (!text) return;

        // Skip elemen yang hanya berisi spasi atau kosong
        if (text.length < 1) return;

        // Coba deteksi judul dari elemen dengan class tertentu
        if (!title && (el.classList.contains('MsoTitle') || el.tagName === 'H1')) {
          title = text;
          return;
        }

        // Deteksi subtitle
        if (!subtitle && (el.classList.contains('MsoSubtitle') || el.tagName === 'H2')) {
          subtitle = text;
          return;
        }

        // Deteksi author
        const authorMatch = text.match(/^(?:Author|Writer|By|Penulis|Pengarang)\s*[:\-–—]\s*(.+)/i);
        if (authorMatch && !author) {
          author = authorMatch[1].trim();
          return;
        }

        // Deteksi genre
        const genreMatch = text.match(/^(?:Genre|Kategori)\s*[:\-–—]\s*(.+)/i);
        if (genreMatch && !genre) {
          genre = genreMatch[1].trim();
          return;
        }

        // Deteksi scene break
        const sceneBreakRegex = /^[✿\*\-=~·•◆◇★☆♦♠♣♥❀❁❃✾✿❊❋※。・\s]{3,}$/;
        if (sceneBreakRegex.test(text.replace(/\s/g, '')) && text.length <= 20) {
          paragraphs.push({ type: 'scene-break', text: '✿ ✿ ✿' });
          return;
        }

        // Deteksi "The End"
        if (/^[\—\-–]+\s*(The End|Tamat|Fin|End|Selesai|おわり|終)\s*[\—\-–]+$/i.test(text)) {
          paragraphs.push({ type: 'story-end', text: text });
          return;
        }

        // Tentukan tipe paragraf
        let type = 'normal';
        if (isFirstParagraph) {
          type = 'drop-cap';
          isFirstParagraph = false;
        }

        // Cek apakah teks miring dan terpusat (gunakan gaya atau tag)
        const style = el.getAttribute('style') || '';
        const isCentered = style.includes('text-align:center') || style.includes('text-align: center');
        const hasItalicTag = el.querySelector('i, em') !== null;
        const isItalic = hasItalicTag || style.includes('font-style:italic') || style.includes('font-style: italic');

        if (isCentered && isItalic) {
          type = 'last-line';
        } else if (isCentered && (isItalic || text.startsWith('"') || text.startsWith('"'))) {
          type = 'dialogue';
        }

        paragraphs.push({ type, text });
      });

      // Jika tidak ada paragraf sama sekali, coba ambil semua teks langsung dari body
      if (paragraphs.length === 0) {
        const bodyText = cleanText(body.textContent);
        if (bodyText) {
          // Pisahkan berdasarkan baris baru (fallback sederhana)
          const lines = bodyText.split(/\n+/).filter(l => l.trim().length > 0);
          lines.forEach((line, idx) => {
            paragraphs.push({
              type: idx === 0 ? 'drop-cap' : 'normal',
              text: line
            });
          });
        }
      }

      return { title, subtitle, author, genre, paragraphs };
    }

    /* ==========================================
       CLEAN TEXT - Lebih aman
       ========================================== */
    function cleanText(text) {
      if (!text) return '';
      return text
        .replace(/<[^>]*>/g, '')           // Hapus tag HTML (untuk jaga-jaga)
        .replace(/\u00a0/g, ' ')            // &nbsp;
        .replace(/\s+/g, ' ')               // Gabungkan spasi
        .trim();
    }

    /* ==========================================
       RENDER STORY
       ========================================== */
    function renderStory(paragraphs) {
      storyContent.innerHTML = '';

      paragraphs.forEach((para) => {
        const p = document.createElement('p');
        p.textContent = para.text;
        if (para.type) p.classList.add(para.type);
        storyContent.appendChild(p);
      });
    }

    /* ==========================================
       FUNGSI LAINNYA (sama seperti sebelumnya)
       ========================================== */
    function toggleTheme() {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', currentTheme);
      localStorage.setItem('novelTheme', currentTheme);
    }

    function applyFontSize(size) {
      size = Math.max(14, Math.min(28, size));
      currentFontSize = size;
      document.documentElement.style.setProperty('--font-size', size + 'px');
      fontValue.textContent = size + 'px';
      fontSlider.value = size;
      localStorage.setItem('novelFontSize', size);
    }

    function toggleFocusMode() {
      focusModeOn = !focusModeOn;
      document.body.classList.toggle('focus-mode', focusModeOn);
      focusBtn.textContent = focusModeOn ? '👁️‍🗨️' : '👁️';
    }

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
      document.addEventListener('click', (e) => {
        if (!fontPanel.contains(e.target) && e.target !== fontSizeBtn) {
          fontPanel.classList.remove('visible');
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          fontPanel.classList.remove('visible');
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

    handleScroll();

  });
})();