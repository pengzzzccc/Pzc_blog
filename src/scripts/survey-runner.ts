export interface SurveyOption {
  value: string;
  label: string;
}

export interface SurveyQuestion {
  id: string;
  code: string;
  sectionId: string;
  sectionTitle: string;
  type: 'single-choice' | 'multi-choice' | 'likert-scale';
  required: boolean;
  text: string;
  dimension?: string;
  options: SurveyOption[];
}

export interface SurveyDimension {
  id: string;
  category: string;
  categoryLabel: string;
  name: string;
  shortLabel: string;
  questions: string[];
  formula: string;
  description: string;
}

export interface SurveyRunnerPayload {
  slug: string;
  lang: 'zh' | 'en';
  title: string;
  accessGate?: {
    enabled: boolean;
    sha256: string;
  };
  questions: SurveyQuestion[];
  scoring?: {
    type: 'radar';
    scaleMin: number;
    scaleMax: number;
    dimensions: SurveyDimension[];
  };
  labels: {
    progress: string;
    missingPrompt: string;
    gateShow: string;
    gateHide: string;
    resultTitle: string;
    resultSubtitle: string;
  };
}

type AnswersMap = Record<string, string | string[]>;

interface ComputedDimension extends SurveyDimension {
  score: number;
  values: number[];
}

interface ComputedCategory {
  category: string;
  categoryLabel: string;
  score: number;
}

/** Pure-TS SHA-256 hex digest so passcode gating works over both HTTPS and local LAN HTTP preview. */
export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatVars(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildRadarSvg(
  dimensions: ComputedDimension[],
  scaleMin: number,
  scaleMax: number,
  dark: boolean,
  header?: { title: string; subtitle: string },
): string {
  const count = dimensions.length;
  const width = 760;
  const headerOffset = header ? 66 : 0;
  const height = 640 + headerOffset;
  const cx = width / 2;
  const cy = 320 + headerOffset;
  const radius = 200;

  const palette = dark
    ? {
        bg: '#171717',
        ring: '#333333',
        ringOuter: '#525252',
        axis: '#2b2b2b',
        tick: '#a3a3a3',
        label: '#f5f5f5',
        subLabel: '#a3a3a3',
        polyFill: 'rgba(56, 189, 248, 0.24)',
        polyStroke: '#38bdf8',
        pointFill: '#0ea5e9',
        pointStroke: '#171717',
        scoreText: '#7dd3fc',
        headerTitle: '#fafafa',
        headerSub: '#a3a3a3',
      }
    : {
        bg: '#ffffff',
        ring: '#e5e5e5',
        ringOuter: '#a3a3a3',
        axis: '#e5e5e5',
        tick: '#737373',
        label: '#171717',
        subLabel: '#525252',
        polyFill: 'rgba(2, 132, 199, 0.18)',
        polyStroke: '#0284c7',
        pointFill: '#0284c7',
        pointStroke: '#ffffff',
        scoreText: '#0369a1',
        headerTitle: '#171717',
        headerSub: '#525252',
      };

  const font = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="12-dimension radar chart">`,
  );
  parts.push(`<rect width="${width}" height="${height}" rx="12" fill="${palette.bg}" />`);

  if (header) {
    parts.push(
      `<text x="${cx}" y="38" text-anchor="middle" font-family="${font}" font-size="20" font-weight="700" fill="${palette.headerTitle}">${escapeXml(header.title)}</text>`,
    );
    parts.push(
      `<text x="${cx}" y="62" text-anchor="middle" font-family="${font}" font-size="13" fill="${palette.headerSub}">${escapeXml(header.subtitle)}</text>`,
    );
  }

  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / count;

  // Concentric polygons (levels scaleMin..scaleMax)
  const startLevel = Math.max(1, Math.round(scaleMin));
  const steps = Math.max(startLevel, Math.round(scaleMax));
  for (let level = startLevel; level <= steps; level++) {
    const r = (radius * level) / scaleMax;
    const pts = dimensions
      .map((_, i) => {
        const a = angleFor(i);
        return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
      })
      .join(' ');
    const stroke = level === steps ? palette.ringOuter : palette.ring;
    const strokeWidth = level === steps ? 1.5 : 1;
    parts.push(`<polygon points="${pts}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" />`);
    parts.push(
      `<text x="${(cx + 6).toFixed(1)}" y="${(cy - r + 4).toFixed(1)}" font-family="${font}" font-size="11" fill="${palette.tick}">${level}</text>`,
    );
  }

  // Radial axes & outer vertex labels
  for (let i = 0; i < count; i++) {
    const dim = dimensions[i];
    const a = angleFor(i);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const x2 = cx + radius * cos;
    const y2 = cy + radius * sin;
    parts.push(
      `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${palette.axis}" stroke-width="1" />`,
    );

    const labelR = radius + 28;
    const lx = cx + labelR * cos;
    const ly = cy + labelR * sin;
    const anchor = Math.abs(cos) < 0.15 ? 'middle' : cos > 0 ? 'start' : 'end';
    const dyBase = Math.abs(sin) > 0.88 ? (sin < 0 ? -8 : 10) : 0;

    parts.push(
      `<text x="${lx.toFixed(1)}" y="${(ly + dyBase).toFixed(1)}" text-anchor="${anchor}" font-family="${font}" font-size="13" font-weight="600" fill="${palette.label}">${escapeXml(dim.shortLabel)}</text>`,
    );
    parts.push(
      `<text x="${lx.toFixed(1)}" y="${(ly + dyBase + 16).toFixed(1)}" text-anchor="${anchor}" font-family="${font}" font-size="11" fill="${palette.scoreText}">${escapeXml(dim.categoryLabel)} · ${dim.score.toFixed(2)}</text>`,
    );
  }

  // Score polygon
  const dataPoints = dimensions.map((dim, i) => {
    const clamped = Math.max(0, Math.min(scaleMax, dim.score));
    const ratio = scaleMax > 0 ? clamped / scaleMax : 0;
    const r = radius * ratio;
    const a = angleFor(i);
    return {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
    };
  });

  const polyPts = dataPoints.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  parts.push(
    `<polygon points="${polyPts}" fill="${palette.polyFill}" stroke="${palette.polyStroke}" stroke-width="2.5" stroke-linejoin="round" />`,
  );

  for (const pt of dataPoints) {
    parts.push(
      `<circle cx="${pt.x.toFixed(2)}" cy="${pt.y.toFixed(2)}" r="4.5" fill="${palette.pointFill}" stroke="${palette.pointStroke}" stroke-width="2" />`,
    );
  }

  parts.push('</svg>');
  return parts.join('');
}

export function initSurveyRunner(root: HTMLElement, payload: SurveyRunnerPayload): void {
  const gateEl = root.querySelector<HTMLElement>('[data-survey-gate]');
  const appEl = root.querySelector<HTMLElement>('[data-survey-app]');
  const formEl = root.querySelector<HTMLFormElement>('[data-survey-form]');
  const resultEl = root.querySelector<HTMLElement>('[data-survey-result]');
  if (!appEl || !formEl || !resultEl) return;

  const progressLabel = root.querySelector<HTMLElement>('[data-progress-label]');
  const progressBar = root.querySelector<HTMLElement>('[data-progress-bar]');
  const formError = root.querySelector<HTMLElement>('[data-form-error]');
  const radarMount = root.querySelector<HTMLElement>('[data-radar-mount]');
  const topMount = root.querySelector<HTMLElement>('[data-top-dimensions]');
  const categoryMount = root.querySelector<HTMLElement>('[data-category-summary]');
  const tableBody = root.querySelector<HTMLElement>('[data-dimension-table-body]');

  const draftKey = `pzc_survey_draft_${payload.slug}`;
  let latestComputed: { dimensions: ComputedDimension[]; categories: ComputedCategory[] } | null = null;

  // ---------- 1. Access Gate ----------
  if (payload.accessGate?.enabled && gateEl) {
    const expectedHash = payload.accessGate.sha256.toLowerCase();
    const sessionKey = `pzc_survey_unlocked_${payload.slug}_${expectedHash.slice(0, 8)}`;
    const gateForm = gateEl.querySelector<HTMLFormElement>('[data-gate-form]');
    const gateInput = gateEl.querySelector<HTMLInputElement>('[data-gate-input]');
    const gateError = gateEl.querySelector<HTMLElement>('[data-gate-error]');
    const gateToggle = gateEl.querySelector<HTMLButtonElement>('[data-gate-toggle]');
    const lockBtn = appEl.querySelector<HTMLButtonElement>('[data-survey-lock]');

    const unlock = () => {
      gateEl.hidden = true;
      appEl.hidden = false;
      gateError?.classList.add('hidden');
    };

    const lock = () => {
      try {
        sessionStorage.removeItem(sessionKey);
      } catch {
        // Ignore storage restrictions
      }
      if (gateInput) gateInput.value = '';
      appEl.hidden = true;
      gateEl.hidden = false;
      gateInput?.focus();
    };

    try {
      if (sessionStorage.getItem(sessionKey) === '1') {
        unlock();
      }
    } catch {
      // Ignore storage restrictions
    }

    gateToggle?.addEventListener('click', () => {
      if (!gateInput) return;
      const show = gateInput.type === 'password';
      gateInput.type = show ? 'text' : 'password';
      gateToggle.textContent = show ? payload.labels.gateHide : payload.labels.gateShow;
    });

    gateForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = gateInput?.value.trim() ?? '';
      if (raw && sha256Hex(raw) === expectedHash) {
        try {
          sessionStorage.setItem(sessionKey, '1');
        } catch {
          // Ignore storage restrictions
        }
        unlock();
      } else {
        gateError?.classList.remove('hidden');
        gateInput?.focus();
        gateInput?.select();
      }
    });

    lockBtn?.addEventListener('click', lock);
  }

  // ---------- 2. Draft & Answers Helpers ----------
  const readAnswersFromDom = (): AnswersMap => {
    const out: AnswersMap = {};
    for (const q of payload.questions) {
      if (q.type === 'multi-choice') {
        const checked = Array.from(
          formEl.querySelectorAll<HTMLInputElement>(`input[name="${q.id}"]:checked`),
        ).map((el) => el.value);
        out[q.id] = checked;
      } else {
        const selected = formEl.querySelector<HTMLInputElement>(`input[name="${q.id}"]:checked`);
        out[q.id] = selected ? selected.value : '';
      }
    }
    return out;
  };

  const applyAnswersToDom = (answers: AnswersMap): void => {
    for (const q of payload.questions) {
      const val = answers[q.id];
      const inputs = formEl.querySelectorAll<HTMLInputElement>(`input[name="${q.id}"]`);
      if (q.type === 'multi-choice') {
        const set = new Set(Array.isArray(val) ? val : []);
        inputs.forEach((inp) => {
          inp.checked = set.has(inp.value);
        });
      } else {
        const str = typeof val === 'string' ? val : '';
        inputs.forEach((inp) => {
          inp.checked = inp.value === str;
        });
      }
    }
  };

  const isAnswered = (q: SurveyQuestion, answers: AnswersMap): boolean => {
    const val = answers[q.id];
    if (q.type === 'multi-choice') return Array.isArray(val) && val.length > 0;
    return typeof val === 'string' && val.length > 0;
  };

  const updateProgress = (): void => {
    const answers = readAnswersFromDom();
    const done = payload.questions.filter((q) => isAnswered(q, answers)).length;
    const total = payload.questions.length;
    if (progressLabel) {
      progressLabel.textContent = formatVars(payload.labels.progress, { done, total });
    }
    if (progressBar) {
      progressBar.style.width = `${total > 0 ? Math.round((done / total) * 100) : 0}%`;
    }
  };

  const saveDraft = (): void => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(readAnswersFromDom()));
    } catch {
      // Ignore storage quota issues
    }
  };

  try {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      const parsed = JSON.parse(saved) as AnswersMap;
      applyAnswersToDom(parsed);
    }
  } catch {
    // Ignore malformed draft
  }
  updateProgress();

  formEl.addEventListener('change', (e) => {
    const target = e.target as HTMLElement | null;
    const card = target?.closest<HTMLElement>('[data-question-id]');
    card?.classList.remove('ring-2', 'ring-red-500');
    formError?.classList.add('hidden');
    saveDraft();
    updateProgress();
  });

  // ---------- 3. Compute & Render Results ----------
  const computeResults = (answers: AnswersMap) => {
    const dimensions: ComputedDimension[] = (payload.scoring?.dimensions ?? []).map((dim) => {
      const values = dim.questions.map((qid) => {
        const raw = answers[qid];
        const num = typeof raw === 'string' ? Number(raw) : NaN;
        return Number.isFinite(num) ? num : 0;
      });
      const sum = values.reduce((acc, v) => acc + v, 0);
      const score = values.length > 0 ? sum / values.length : 0;
      return { ...dim, score, values };
    });

    const catMap = new Map<string, { categoryLabel: string; sum: number; count: number }>();
    for (const d of dimensions) {
      const entry = catMap.get(d.category) ?? { categoryLabel: d.categoryLabel, sum: 0, count: 0 };
      entry.sum += d.score;
      entry.count += 1;
      catMap.set(d.category, entry);
    }
    const categories: ComputedCategory[] = Array.from(catMap.entries()).map(([category, v]) => ({
      category,
      categoryLabel: v.categoryLabel,
      score: v.count > 0 ? v.sum / v.count : 0,
    }));

    return { dimensions, categories };
  };

  const renderRadar = () => {
    if (!radarMount || !latestComputed || !payload.scoring) return;
    const dark = document.documentElement.classList.contains('dark');
    radarMount.innerHTML = buildRadarSvg(
      latestComputed.dimensions,
      payload.scoring.scaleMin,
      payload.scoring.scaleMax,
      dark,
    );
  };

  const renderResultPanel = (): void => {
    const answers = readAnswersFromDom();
    latestComputed = computeResults(answers);
    const { dimensions, categories } = latestComputed;

    renderRadar();

    if (topMount) {
      const top3 = [...dimensions].sort((a, b) => b.score - a.score).slice(0, 3);
      topMount.innerHTML = '';
      top3.forEach((dim, idx) => {
        const card = document.createElement('div');
        card.className = 'rounded-lg border border-neutral-200 p-4 dark:border-neutral-800';
        card.innerHTML = `
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-xs font-medium text-neutral-500 dark:text-neutral-400">#${idx + 1} · ${escapeXml(dim.categoryLabel)}</span>
            <span class="font-mono text-lg font-bold text-neutral-900 dark:text-neutral-50">${dim.score.toFixed(2)}</span>
          </div>
          <p class="mt-1 font-semibold text-neutral-900 dark:text-neutral-100">${escapeXml(dim.name)}</p>
          <p class="mt-1.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">${escapeXml(dim.description)}</p>
        `;
        topMount.appendChild(card);
      });
    }

    if (categoryMount) {
      const max = payload.scoring?.scaleMax ?? 5;
      categoryMount.innerHTML = '';
      categories.forEach((cat) => {
        const pct = Math.max(0, Math.min(100, Math.round((cat.score / max) * 100)));
        const row = document.createElement('div');
        row.className = 'space-y-1';
        row.innerHTML = `
          <div class="flex items-center justify-between text-sm">
            <span class="font-medium text-neutral-800 dark:text-neutral-200">${escapeXml(cat.categoryLabel)}</span>
            <span class="font-mono text-neutral-700 dark:text-neutral-300">${cat.score.toFixed(2)}</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div class="h-full rounded-full bg-sky-600 dark:bg-sky-400" style="width: ${pct}%"></div>
          </div>
        `;
        categoryMount.appendChild(row);
      });
    }

    if (tableBody) {
      tableBody.innerHTML = '';
      dimensions.forEach((dim) => {
        const tr = document.createElement('tr');
        tr.className = 'border-t border-neutral-200 dark:border-neutral-800';
        tr.innerHTML = `
          <td class="py-2.5 pr-3 text-neutral-600 dark:text-neutral-400">${escapeXml(dim.categoryLabel)}</td>
          <td class="py-2.5 pr-3 font-medium text-neutral-900 dark:text-neutral-100">${escapeXml(dim.name)}</td>
          <td class="py-2.5 pr-3 font-mono text-xs text-neutral-500 dark:text-neutral-400">${escapeXml(dim.formula)}</td>
          <td class="py-2.5 pr-3 font-mono text-xs text-neutral-600 dark:text-neutral-400">${dim.values.join(', ')}</td>
          <td class="py-2.5 text-right font-mono font-semibold text-neutral-900 dark:text-neutral-50">${dim.score.toFixed(2)}</td>
        `;
        tableBody.appendChild(tr);
      });
    }

    resultEl.hidden = false;
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Re-render SVG if theme changes while result panel is shown
  const themeObserver = new MutationObserver(() => {
    if (!resultEl.hidden && latestComputed) {
      renderRadar();
    }
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // ---------- 4. Form Actions ----------
  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const answers = readAnswersFromDom();
    formEl.querySelectorAll<HTMLElement>('[data-question-id]').forEach((el) => {
      el.classList.remove('ring-2', 'ring-red-500');
    });

    const missing = payload.questions.filter((q) => q.required && !isAnswered(q, answers));
    if (missing.length > 0) {
      missing.forEach((q) => {
        const card = formEl.querySelector<HTMLElement>(`[data-question-id="${q.id}"]`);
        card?.classList.add('ring-2', 'ring-red-500');
      });
      if (formError) {
        formError.textContent = formatVars(payload.labels.missingPrompt, {
          n: missing.length,
          code: missing[0].code,
        });
        formError.classList.remove('hidden');
      }
      const firstCard = formEl.querySelector<HTMLElement>(`[data-question-id="${missing[0].id}"]`);
      firstCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    formError?.classList.add('hidden');
    renderResultPanel();
  });

  root.querySelector<HTMLButtonElement>('[data-fill-demo]')?.addEventListener('click', () => {
    const demo: AnswersMap = {};
    payload.questions.forEach((q, i) => {
      if (q.type === 'multi-choice') {
        demo[q.id] = q.options.length > 0 ? [q.options[0].value] : [];
      } else if (q.type === 'single-choice') {
        demo[q.id] = q.options[0]?.value ?? '';
      } else {
        const sampleScores = [5, 4, 4, 3, 2, 4, 5, 3, 2, 4, 5, 3];
        demo[q.id] = String(sampleScores[i % sampleScores.length]);
      }
    });
    applyAnswersToDom(demo);
    formEl.querySelectorAll<HTMLElement>('[data-question-id]').forEach((el) => {
      el.classList.remove('ring-2', 'ring-red-500');
    });
    formError?.classList.add('hidden');
    saveDraft();
    updateProgress();
  });

  root.querySelector<HTMLButtonElement>('[data-survey-reset]')?.addEventListener('click', () => {
    applyAnswersToDom({});
    formEl.querySelectorAll<HTMLElement>('[data-question-id]').forEach((el) => {
      el.classList.remove('ring-2', 'ring-red-500');
    });
    formError?.classList.add('hidden');
    resultEl.hidden = true;
    latestComputed = null;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // Ignore storage errors
    }
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  root.querySelector<HTMLButtonElement>('[data-reedit]')?.addEventListener('click', () => {
    formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- 5. Export CSV & PNG ----------
  root.querySelector<HTMLButtonElement>('[data-export-csv]')?.addEventListener('click', () => {
    const answers = readAnswersFromDom();
    const computed = latestComputed ?? computeResults(answers);
    const nowIso = new Date().toISOString();

    const rows: (string | number)[][] = [
      ['Section', 'Code', 'DimensionOrCategory', 'QuestionOrFormula', 'RawValue', 'LabelOrScore'],
      ['META', 'TITLE', '', payload.title, payload.slug, nowIso],
    ];

    for (const q of payload.questions) {
      const val = answers[q.id];
      const rawStr = Array.isArray(val) ? val.join('|') : (val ?? '');
      const labelMap = new Map(q.options.map((o) => [o.value, o.label]));
      const labelStr = Array.isArray(val)
        ? val.map((v) => labelMap.get(v) ?? v).join('; ')
        : (labelMap.get(rawStr) ?? rawStr);
      rows.push([q.sectionTitle, q.code, q.dimension ?? '', q.text, rawStr, labelStr]);
    }

    for (const dim of computed.dimensions) {
      rows.push([
        'DIMENSION_SCORE',
        dim.id,
        dim.categoryLabel,
        `${dim.name} [${dim.formula}]`,
        dim.values.join('|'),
        dim.score.toFixed(2),
      ]);
    }

    for (const cat of computed.categories) {
      rows.push(['CATEGORY_AVG', cat.category, cat.categoryLabel, '', '', cat.score.toFixed(2)]);
    }

    const csvText = '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, `${payload.slug}-${timestampSlug()}.csv`);
  });

  root.querySelector<HTMLButtonElement>('[data-export-png]')?.addEventListener('click', () => {
    if (!payload.scoring) return;
    const computed = latestComputed ?? computeResults(readAnswersFromDom());
    const dark = document.documentElement.classList.contains('dark');
    const subtitle = `${payload.labels.resultSubtitle} · ${new Date().toLocaleDateString()}`;
    const svgText = buildRadarSvg(
      computed.dimensions,
      payload.scoring.scaleMin,
      payload.scoring.scaleMax,
      dark,
      { title: payload.title, subtitle },
    );

    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((pngBlob) => {
          if (pngBlob) triggerDownload(pngBlob, `${payload.slug}-radar-${timestampSlug()}.png`);
          URL.revokeObjectURL(url);
        }, 'image/png');
      } else {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  });
}
