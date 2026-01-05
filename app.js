const bankSelect = document.getElementById("bankSelect");
const qBox = document.getElementById("qBox");
const stat = document.getElementById("stat");
const btnWrong = document.getElementById("btnWrong");
const btnResetWrong = document.getElementById("btnResetWrong");

const BANKS = window.BANKS || {};
const bankIds = Object.keys(BANKS);

let currentBankId = bankIds[0] || null;
let onlyWrong = false;
let queue = [];
let idx = 0;

function wrongKey(bankId) { return `WRONG_${bankId}`; }

function getWrongSet(bankId) {
  try { return new Set(JSON.parse(localStorage.getItem(wrongKey(bankId)) || "[]")); }
  catch { return new Set(); }
}
function saveWrongSet(bankId, set) {
  localStorage.setItem(wrongKey(bankId), JSON.stringify([...set]));
}

function buildSelect() {
  bankSelect.innerHTML = "";
  for (const id of bankIds) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = BANKS[id].title || id;
    bankSelect.appendChild(opt);
  }
  bankSelect.value = currentBankId;
}

function rebuildQueue() {
  const bank = BANKS[currentBankId];
  if (!bank) return;

  const qs = bank.questions || [];
  if (!onlyWrong) {
    queue = qs.map((_, i) => i);
  } else {
    const wrong = getWrongSet(currentBankId);
    queue = qs.map((_, i) => i).filter(i => wrong.has(i));
  }

  idx = 0;
  render();
}

function render() {
  const bank = BANKS[currentBankId];
  if (!bank) {
    qBox.textContent = "尚未載入題庫。";
    stat.textContent = "0 / 0";
    return;
  }

  const qs = bank.questions || [];
  const total = queue.length;
  stat.textContent = total ? `${idx + 1} / ${total}` : `0 / 0`;

  if (!total) {
    qBox.innerHTML = `
      <div style="font-weight:700">目前沒有題目可刷</div>
      <div class="muted" style="margin-top:6px">
        可能是「只刷錯題」模式開著，但你還沒有錯題。
      </div>
    `;
    return;
  }

  const qIndex = queue[idx];
  const q = qs[qIndex];
  const wrongSet = getWrongSet(currentBankId);
  const isWrong = wrongSet.has(qIndex);

  qBox.innerHTML = `
    <div class="muted">${bank.title}</div>
    <div style="font-size:18px;font-weight:800;margin-top:8px">${qIndex + 1}. ${escapeHtml(q.q)}</div>

    ${renderOption("A", q.A)}
    ${renderOption("B", q.B)}
    ${renderOption("C", q.C)}
    ${renderOption("D", q.D)}

    <div class="row" style="margin-top:12px;justify-content:space-between">
      <button id="prev">上一題</button>
      <span class="pill">${isWrong ? "已列入錯題" : "未列入錯題"}</span>
      <button id="next">下一題</button>
    </div>
  `;

  document.getElementById("prev").onclick = () => { idx = Math.max(0, idx - 1); render(); };
  document.getElementById("next").onclick = () => { idx = Math.min(queue.length - 1, idx + 1); render(); };

  for (const choice of ["A","B","C","D"]) {
    document.getElementById(`opt_${choice}`).onclick = () => onAnswer(choice, q.ans, qIndex);
  }
}

function renderOption(letter, text) {
  return `<button class="opt" id="opt_${letter}">(${letter}) ${escapeHtml(text)}</button>`;
}

function onAnswer(pick, ans, qIndex) {
  const bank = BANKS[currentBankId];
  const q = bank.questions[qIndex];
  const wrongSet = getWrongSet(currentBankId);

  if (pick === ans) {
    // 答對 → 從錯題移除
    if (wrongSet.has(qIndex)) {
      wrongSet.delete(qIndex);
      saveWrongSet(currentBankId, wrongSet);
    }
    alert("✅ 答對");
  } else {
    // 答錯 → 加入錯題
    wrongSet.add(qIndex);
    saveWrongSet(currentBankId, wrongSet);

    // 🔥 關鍵：抓正確選項的「文字內容」
    const correctText = q[ans];

    alert(
      `❌ 答錯\n\n正確答案是：\n(${ans}) ${correctText}`
    );
  }

  // 自動跳下一題
  if (idx < queue.length - 1) idx++;
  render();
}


function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

// events
bankSelect.onchange = () => {
  currentBankId = bankSelect.value;
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

buildSelect();
rebuildQueue();
