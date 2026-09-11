(() => {
  const DEFAULT_QUESTIONS = [
    { id: "demo-1", type: "single", question: "示例：2 + 2 等于多少？", options: { A: "3", B: "4", C: "5", D: "6" }, answer: ["B"] },
    { id: "demo-2", type: "multiple", question: "示例：下面哪些是偶数？", options: { A: "1", B: "2", C: "3", D: "4" }, answer: ["B", "D"] }
  ];

  const $ = (id) => document.getElementById(id);
  const els = {
    homeView: $("homeView"), quizView: $("quizView"), statTotal: $("statTotal"), statWrong: $("statWrong"), statMastered: $("statMastered"),
    startRandom: $("startRandom"), startWrong: $("startWrong"), backHome: $("backHome"), modeLabel: $("modeLabel"), progressLabel: $("progressLabel"),
    questionType: $("questionType"), questionText: $("questionText"), wrongCount: $("wrongCount"), options: $("options"), feedback: $("feedback"),
    submitAnswer: $("submitAnswer"), nextQuestion: $("nextQuestion"), resetProgress: $("resetProgress"), openImport: $("openImport"),
    importDialog: $("importDialog"), fileInput: $("fileInput"), importStatus: $("importStatus")
  };

  let questions = loadQuestions();
  let progress = loadProgress();
  let session = { mode: null, queue: [], index: 0, answered: false };

  function loadQuestions() {
    try {
      const saved = JSON.parse(localStorage.getItem("quiz.questions") || "null");
      return Array.isArray(saved) && saved.length ? saved : DEFAULT_QUESTIONS;
    } catch { return DEFAULT_QUESTIONS; }
  }

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem("quiz.progress") || "{}") || {}; }
    catch { return {}; }
  }

  function saveAll() {
    localStorage.setItem("quiz.questions", JSON.stringify(questions));
    localStorage.setItem("quiz.progress", JSON.stringify(progress));
  }

  function normalizeAnswer(a) {
    const arr = Array.isArray(a) ? a : String(a || "").split(/[|,，\s]+/);
    return [...new Set(arr.map(v => String(v).trim().toUpperCase()).filter(Boolean))].sort();
  }

  function normalizeQuestion(q, index) {
    const type = q.type === "multiple" ? "multiple" : "single";
    const options = q.options || { A: q.A, B: q.B, C: q.C, D: q.D };
    const cleanOptions = {};
    for (const key of ["A", "B", "C", "D", "E", "F"]) {
      if (options?.[key] != null && String(options[key]).trim() !== "") cleanOptions[key] = String(options[key]).trim();
    }
    const answer = normalizeAnswer(q.answer);
    if (!q.question || !answer.length || Object.keys(cleanOptions).length < 2) throw new Error(`第 ${index + 1} 题格式不完整`);
    return { id: String(q.id || `q-${Date.now()}-${index}`), type, question: String(q.question).trim(), options: cleanOptions, answer };
  }

  function shuffle(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function getWrongQuestions() {
    return questions.filter(q => (progress[q.id]?.wrongCount || 0) > 0 && !progress[q.id]?.mastered);
  }

  function renderStats() {
    const wrong = getWrongQuestions().length;
    const mastered = Object.values(progress).filter(x => x.mastered).length;
    els.statTotal.textContent = questions.length;
    els.statWrong.textContent = wrong;
    els.statMastered.textContent = mastered;
  }

  function showView(view) {
    els.homeView.classList.toggle("active", view === "home");
    els.quizView.classList.toggle("active", view === "quiz");
    if (view === "home") renderStats();
  }

  function start(mode) {
    const source = mode === "wrong" ? getWrongQuestions() : questions;
    if (!source.length) {
      alert(mode === "wrong" ? "目前没有未掌握的错题。" : "题库为空，请先导入题目。");
      return;
    }
    session = { mode, queue: shuffle(source), index: 0, answered: false };
    showView("quiz");
    renderQuestion();
  }

  function currentQuestion() { return session.queue[session.index]; }

  function renderQuestion() {
    const q = currentQuestion();
    if (!q) {
      alert("本轮完成。\n可以继续随机刷题，或回到错题模式。 ");
      showView("home");
      return;
    }
    session.answered = false;
    els.modeLabel.textContent = session.mode === "wrong" ? "错题模式" : "随机模式";
    els.progressLabel.textContent = `${session.index + 1} / ${session.queue.length}`;
    els.questionType.textContent = q.type === "multiple" ? "多选题" : "单选题";
    els.questionText.textContent = q.question;
    els.wrongCount.textContent = (progress[q.id]?.wrongCount || 0) ? `错过 ${progress[q.id].wrongCount} 次` : "";
    els.feedback.className = "feedback hidden";
    els.feedback.textContent = "";
    els.submitAnswer.classList.remove("hidden");
    els.nextQuestion.classList.add("hidden");
    els.options.innerHTML = "";

    Object.entries(q.options).forEach(([key, text]) => {
      const label = document.createElement("label");
      label.className = "option";
      label.dataset.key = key;
      const input = document.createElement("input");
      input.type = q.type === "multiple" ? "checkbox" : "radio";
      input.name = "answer";
      input.value = key;
      const span = document.createElement("span");
      span.textContent = `${key}. ${text}`;
      label.append(input, span);
      els.options.append(label);
    });
  }

  function submitAnswer() {
    if (session.answered) return;
    const q = currentQuestion();
    const selected = [...els.options.querySelectorAll("input:checked")].map(i => i.value).sort();
    if (!selected.length) { alert("请先选择答案。"); return; }
    const correct = normalizeAnswer(q.answer);
    const ok = selected.length === correct.length && selected.every((v, i) => v === correct[i]);

    const rec = progress[q.id] || { wrongCount: 0, correctCount: 0, mastered: false };
    if (ok) {
      rec.correctCount = (rec.correctCount || 0) + 1;
      if ((rec.wrongCount || 0) > 0 && rec.correctCount >= 2) rec.mastered = true;
    } else {
      rec.wrongCount = (rec.wrongCount || 0) + 1;
      rec.correctCount = 0;
      rec.mastered = false;
    }
    progress[q.id] = rec;
    saveAll();
    session.answered = true;

    [...els.options.querySelectorAll(".option")].forEach(label => {
      const key = label.dataset.key;
      const input = label.querySelector("input");
      input.disabled = true;
      if (correct.includes(key)) label.classList.add("correct");
      if (selected.includes(key) && !correct.includes(key)) label.classList.add("incorrect");
    });

    els.feedback.className = `feedback ${ok ? "good" : "bad"}`;
    els.feedback.textContent = ok ? "回答正确。" : `回答错误。正确答案：${correct.join("、")}`;
    els.submitAnswer.classList.add("hidden");
    els.nextQuestion.classList.remove("hidden");
  }

  function nextQuestion() {
    session.index += 1;
    renderQuestion();
  }

  function resetProgress() {
    if (!confirm("只清空答题记录和错题记录，题库会保留。确定继续吗？")) return;
    progress = {};
    saveAll();
    renderStats();
  }

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (c === '"' && inQuotes && n === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = !inQuotes;
      else if (c === ',' && !inQuotes) { row.push(cell); cell = ""; }
      else if ((c === '\n' || c === '\r') && !inQuotes) {
        if (c === '\r' && n === '\n') i++;
        row.push(cell); cell = "";
        if (row.some(v => v.trim() !== "")) rows.push(row);
        row = [];
      } else cell += c;
    }
    row.push(cell); if (row.some(v => v.trim() !== "")) rows.push(row);
    if (rows.length < 2) throw new Error("CSV 没有数据行");
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
  }

  async function importFile(file) {
    const text = await file.text();
    let raw;
    if (file.name.toLowerCase().endsWith(".json")) raw = JSON.parse(text);
    else raw = parseCSV(text);
    if (!Array.isArray(raw)) throw new Error("题库必须是数组");
    const normalized = raw.map(normalizeQuestion);
    if (!normalized.length) throw new Error("没有可导入的题目");
    questions = normalized;
    progress = {};
    saveAll();
    renderStats();
    return normalized.length;
  }

  els.startRandom.addEventListener("click", () => start("random"));
  els.startWrong.addEventListener("click", () => start("wrong"));
  els.backHome.addEventListener("click", () => showView("home"));
  els.submitAnswer.addEventListener("click", submitAnswer);
  els.nextQuestion.addEventListener("click", nextQuestion);
  els.resetProgress.addEventListener("click", resetProgress);
  els.openImport.addEventListener("click", () => els.importDialog.showModal());
  els.fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      els.importStatus.textContent = "正在导入…";
      const count = await importFile(file);
      els.importStatus.textContent = `导入成功：${count} 道题。旧答题记录已清空。`;
    } catch (err) {
      els.importStatus.textContent = `导入失败：${err.message}`;
    } finally { e.target.value = ""; }
  });

  renderStats();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
