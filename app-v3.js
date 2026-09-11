(() => {
  const LABELS = ["A", "B", "C", "D", "E", "F"];
  const PROGRESS_KEY = "quiz.progress.source-docx.v1";
  const EXCLUDED = new Set([
    "single:11", "single:98", "single:149", "single:199", "single:205", "single:232", "single:246",
    "multiple:41", "multiple:174", "multiple:199", "multiple:201", "multiple:203", "multiple:209",
    "multiple:228", "multiple:233", "multiple:250", "multiple:252", "multiple:278", "multiple:324",
    "multiple:329", "multiple:331", "multiple:332", "multiple:333", "multiple:336", "multiple:339", "multiple:350"
  ]);

  let questions = [];
  let progress = {};
  let session = { mode: null, queue: [], index: 0, answered: false };

  const $ = (id) => document.getElementById(id);
  const els = {
    homeView: $("homeView"), quizView: $("quizView"), statTotal: $("statTotal"), statWrong: $("statWrong"), statMastered: $("statMastered"),
    startRandom: $("startRandom"), startWrong: $("startWrong"), backHome: $("backHome"), modeLabel: $("modeLabel"), progressLabel: $("progressLabel"),
    questionType: $("questionType"), questionText: $("questionText"), wrongCount: $("wrongCount"), options: $("options"), feedback: $("feedback"),
    submitAnswer: $("submitAnswer"), nextQuestion: $("nextQuestion"), resetProgress: $("resetProgress")
  };

  function loadBuiltInQuestions() {
    const raw = window.QUIZ_DATA;
    if (!Array.isArray(raw)) throw new Error("内置题库数据缺失");
    if (raw.length !== 750) throw new Error(`源题库数量异常：${raw.length}（应为 750）`);

    const ids = new Set();
    const all = raw.map((row, idx) => {
      if (!Array.isArray(row) || row.length !== 6) throw new Error(`第 ${idx + 1} 条题库结构异常`);
      const [t, sourceNumber, question, optionTexts, answerText, id] = row;
      const type = t === "m" ? "multiple" : (t === "s" ? "single" : null);
      if (!type || !question || !Array.isArray(optionTexts) || optionTexts.length < 2 || optionTexts.length > 6 || !id) {
        throw new Error(`第 ${idx + 1} 条题库内容不完整`);
      }
      if (ids.has(id)) throw new Error(`题库 ID 重复：${id}`);
      ids.add(id);
      const options = {};
      optionTexts.forEach((text, i) => { options[LABELS[i]] = String(text); });
      const answer = [...new Set(String(answerText || "").toUpperCase().split("").filter(Boolean))].sort();
      if (!answer.length || answer.some(key => !(key in options))) throw new Error(`原题 ${sourceNumber} 的答案与选项不匹配`);
      if (type === "single" && answer.length !== 1) throw new Error(`原题 ${sourceNumber} 单选答案数量异常`);
      return { id: String(id), type, sourceNumber, question: String(question), options, answer };
    });

    const sourceSingle = all.filter(q => q.type === "single").length;
    const sourceMultiple = all.filter(q => q.type === "multiple").length;
    if (sourceSingle !== 354 || sourceMultiple !== 396) {
      throw new Error(`源题型数量异常：单选 ${sourceSingle} / 多选 ${sourceMultiple}`);
    }

    const active = all.filter(q => !EXCLUDED.has(`${q.type}:${String(q.sourceNumber)}`));
    const activeSingle = active.filter(q => q.type === "single").length;
    const activeMultiple = active.filter(q => q.type === "multiple").length;
    if (active.length !== 724 || activeSingle !== 347 || activeMultiple !== 377) {
      throw new Error(`异常题隔离后数量不符：总计 ${active.length}，单选 ${activeSingle}，多选 ${activeMultiple}`);
    }
    return active;
  }

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}") || {}; }
    catch { return {}; }
  }
  function saveProgress() { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); }
  function normalizeAnswer(a) { return [...new Set((Array.isArray(a) ? a : []).map(v => String(v).trim().toUpperCase()).filter(Boolean))].sort(); }

  function shuffle(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function getWrongQuestions() { return questions.filter(q => (progress[q.id]?.wrongCount || 0) > 0 && !progress[q.id]?.mastered); }

  function renderStats() {
    els.statTotal.textContent = questions.length;
    els.statWrong.textContent = getWrongQuestions().length;
    els.statMastered.textContent = questions.filter(q => progress[q.id]?.mastered).length;
  }

  function showView(view) {
    els.homeView.classList.toggle("active", view === "home");
    els.quizView.classList.toggle("active", view === "quiz");
    if (view === "home") renderStats();
  }

  function start(mode) {
    const source = mode === "wrong" ? getWrongQuestions() : questions;
    if (!source.length) {
      alert(mode === "wrong" ? "目前没有未掌握的错题。" : "题库为空。");
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
      alert("本轮完成。可以继续随机刷题，或进入错题模式。");
      showView("home");
      return;
    }
    session.answered = false;
    els.modeLabel.textContent = session.mode === "wrong" ? "错题模式" : "随机模式";
    els.progressLabel.textContent = `${session.index + 1} / ${session.queue.length}`;
    els.questionType.textContent = `${q.type === "multiple" ? "多选题" : "单选题"} · 原题 ${q.sourceNumber}`;
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
    saveProgress();
    session.answered = true;

    [...els.options.querySelectorAll(".option")].forEach(label => {
      const key = label.dataset.key;
      label.querySelector("input").disabled = true;
      if (correct.includes(key)) label.classList.add("correct");
      if (selected.includes(key) && !correct.includes(key)) label.classList.add("incorrect");
    });

    els.feedback.className = `feedback ${ok ? "good" : "bad"}`;
    els.feedback.textContent = `${ok ? "回答正确" : "回答错误"}。正确答案：${correct.join("、")}`;
    els.submitAnswer.classList.add("hidden");
    els.nextQuestion.classList.remove("hidden");
  }

  function nextQuestion() { session.index += 1; renderQuestion(); }

  function resetProgress() {
    if (!confirm("确定清空答题记录和错题记录吗？题库不会删除。")) return;
    progress = {};
    saveProgress();
    renderStats();
  }

  function init() {
    try {
      questions = loadBuiltInQuestions();
      localStorage.removeItem("quiz.questions");
      progress = loadProgress();
      const activeIds = new Set(questions.map(q => q.id));
      let changed = false;
      Object.keys(progress).forEach(id => {
        if (!activeIds.has(id)) { delete progress[id]; changed = true; }
      });
      if (changed) saveProgress();
      els.startRandom.addEventListener("click", () => start("random"));
      els.startWrong.addEventListener("click", () => start("wrong"));
      els.backHome.addEventListener("click", () => showView("home"));
      els.submitAnswer.addEventListener("click", submitAnswer);
      els.nextQuestion.addEventListener("click", nextQuestion);
      els.resetProgress.addEventListener("click", resetProgress);
      renderStats();
    } catch (err) {
      document.body.innerHTML = `<main class="app-shell"><div class="panel"><h2>题库加载失败</h2><p>${String(err && err.message ? err.message : err)}</p></div></main>`;
    }
  }

  init();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
