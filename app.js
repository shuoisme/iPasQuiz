const bankSelect = document.getElementById("bankSelect");
const countSelect = document.getElementById("countSelect");
const qBox = document.getElementById("qBox");
const stat = document.getElementById("stat");
const btnWrong = document.getElementById("btnWrong");
const btnResetWrong = document.getElementById("btnResetWrong");
const btnSubmit = document.getElementById("btnSubmit");
const resultBox = document.getElementById("resultBox");

const BANKS = window.BANKS || {};
const bankIds = Object.keys(BANKS);

let currentBankId = bankIds[0] || null;
let onlyWrong = false;
let queue = [];   // 這回合要刷的「題目索引清單」
let idx = 0;      // 目前在 queue 的位置
let answers = {}; // key: qIndex(原始題目索引) -> value: "A"/"B"/"C"/"D"

// -------------------- utils --------------------
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function wrongKey(bankId) { return `WRONG_${bankId}`; }

function getWrongSet(bankId) {
  try { return new Set(JSON.parse(localStorage.getItem(wrongKey(bankId)) || "[]")); }
  catch { return new Set(); }
}

function saveWrongSet(bankId, set) {
  localStorage.setItem(wrongKey(bankId), JSON.stringify([...set]));
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// -------------------- init --------------------
function buildSelect() {
  bankSelect.innerHTML = "";
  for (const id of bankIds) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = BANKS[id]?.title || id;
    bankSelect.appendChild(opt);
  }
  if (currentBankId) bankSelect.value = currentBankId;
}

function clearResult() {
  resultBox.style.display = "none";
  resultBox.innerHTML = "";
}

function clearAnswers() {
  answers = {};
}

// -------------------- queue building --------------------
function rebuildQueue() {
  const bank = BANKS[currentBankId];
  if (!bank) return;

  const qs = bank.questions || [];
  const wrong = getWrongSet(currentBankId);

  // 題目池
  let pool = [];
  if (onlyWrong) {
    pool = qs.map((_, i) => i).filter(i => wrong.has(i));
  } else {
    pool = qs.map((_, i) => i);
  }

  // 亂數
  shuffleInPlace(pool);

  // 題數
  const selected = countSelect.value;
  if (selected !== "all") {
    queue = pool.slice(0, Number(selected));
  } else {
    queue = pool;
  }

  idx = 0;

  // 重新出題：清空作答 & 結果
  clearAnswers();
  clearResult();

  render();
}

// -------------------- render --------------------
function renderOption(letter, text, chosen) {
  const tag = chosen === letter ? " ✅已選" : "";
  return `<button class="opt" id="opt_${letter}">(${letter}) ${escapeHtml(text)}${tag}</button>`;
}

function render() {
  const bank = BANKS[currentBankId];
  if (!bank) {
    qBox.textContent = "尚未載入題庫。";
    stat.textContent = "0 / 0";
    btnSubmit.disabled = true;
    return;
  }

  const qs = bank.questions || [];
  const total = queue.length;

  stat.textContent = total ? `${idx + 1} / ${total}` : `0 / 0`;
  btnSubmit.disabled = total === 0;

  if (!total) {
    qBox.innerHTML = `
      <div style="font-weight:800">目前沒有題目可刷</div>
      <div class="muted" style="margin-top:6px">
        可能是你開了「只刷錯題」但目前沒有錯題；或題庫沒有題目。
      </div>
    `;
    return;
  }

  const qIndex = queue[idx];
  const q = qs[qIndex];
  const chosen = answers[qIndex] || null;

  qBox.innerHTML = `
    <div class="muted">${escapeHtml(bank.title)}</div>
    <div class="qtitle">${qIndex + 1}. ${escapeHtml(q.q)}</div>

    ${renderOption("A", q.A, chosen)}
    ${renderOption("B", q.B, chosen)}
    ${renderOption("C", q.C, chosen)}
    ${renderOption("D", q.D, chosen)}

    <div class="hr"></div>

    <div class="row" style="justify-content:space-between;align-items:center">
      <button class="navbtn" id="prev">上一題</button>
      <span class="pill">已作答：${Object.keys(answers).filter(k => queue.includes(Number(k))).length} / ${total}</span>
      <button class="navbtn" id="next">下一題</button>
    </div>

    <div class="muted" style="margin-top:10px">
      作答時不顯示答案，請按右上「交卷 / 對答案」一次看全部正解。
    </div>
  `;

  // nav
  document.getElementById("prev").onclick = () => { idx = Math.max(0, idx - 1); render(); };
  document.getElementById("next").onclick = () => { idx = Math.min(queue.length - 1, idx + 1); render(); };

  // option click
  for (const choice of ["A","B","C","D"]) {
    document.getElementById(`opt_${choice}`).onclick = () => onAnswer(choice, qIndex);
  }
}

// -------------------- answering --------------------
function onAnswer(pick, qIndex) {
  // 只記錄，不判對錯
  answers[qIndex] = pick;

  // 自動下一題（你不想自動跳就把這段註解掉）
  if (idx < queue.length - 1) idx++;

  render();
}

// -------------------- submit & grade --------------------
function submitAndGrade() {
  const bank = BANKS[currentBankId];
  if (!bank) return;

  const qs = bank.questions || [];
  const wrongSet = getWrongSet(currentBankId);

  const currentQueue = queue.slice(); // 本回合題目索引
  if (currentQueue.length === 0) return;

  // 重新計算本回合錯題：先移除本回合涉及的舊錯題，再依交卷結果加入
  for (const qIndex of currentQueue) {
    if (wrongSet.has(qIndex)) wrongSet.delete(qIndex);
  }

  let correct = 0;
  let unanswered = 0;

  let html = `
    <div class="split">
      <div style="font-weight:900;font-size:18px">交卷結果</div>
      <span class="pill">${escapeHtml(bank.title)}</span>
    </div>
    <div class="hr"></div>
  `;

  currentQueue.forEach((qIndex, n) => {
    const q = qs[qIndex];
    const my = answers[qIndex] || null;
    const ans = q.ans;

    const isCorrect = (my === ans);
    if (!my) unanswered++;
    if (isCorrect) correct++;

    // 錯題更新：未作答也當錯題（你想「未作答不算錯」我也可以改）
    if (!isCorrect) wrongSet.add(qIndex);

    const correctText = q[ans]; // ✅ 正確選項全文
    const myText = my ? q[my] : "";

    html += `
      <div class="card ${isCorrect ? "ok" : "warn"}" style="margin-top:10px">
        <div style="font-weight:900">${n + 1}. ${escapeHtml(q.q)}</div>

        <div class="muted" style="margin-top:6px">
          你的答案：${my ? `<b>(${escapeHtml(my)})</b> ${escapeHtml(myText)}` : `<b>（未作答）</b>`}
        </div>

        <div style="margin-top:8px;font-weight:900">
          ${isCorrect ? "✅ 正確" : "❌ 錯誤"}
        </div>

        <div style="margin-top:8px">
          正確答案：<b>(${escapeHtml(ans)})</b> ${escapeHtml(correctText)}
        </div>
      </div>
    `;
  });

  const total = currentQueue.length;
  const rate = total ? Math.round((correct / total) * 100) : 0;

  const summary = `
    <div class="row" style="align-items:center;justify-content:space-between">
      <span class="pill">得分：${correct} / ${total}（${rate}%）</span>
      <span class="pill">未作答：${unanswered}</span>
      <span class="pill">錯題已更新</span>
    </div>
    <div class="hr"></div>
  `;

  // 存錯題
  saveWrongSet(currentBankId, wrongSet);

  // 顯示結果
  resultBox.style.display = "block";
  resultBox.innerHTML = summary + html;

  resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

// -------------------- events --------------------
bankSelect.onchange = () => {
  currentBankId = bankSelect.value;
  rebuildQueue();
};

countSelect.onchange = () => {
  rebuildQueue();
};

btnWrong.onclick = () => {
  onlyWrong = !onlyWrong;
  btnWrong.textContent = `只刷錯題：${onlyWrong ? "開" : "關"}`;
  rebuildQueue();
};

btnResetWrong.onclick = () => {
  localStorage.removeItem(wrongKey(currentBankId));
  rebuildQueue();
};

btnSubmit.onclick = () => {
  submitAndGrade();
};

// -------------------- start --------------------
buildSelect();
rebuildQueue();
