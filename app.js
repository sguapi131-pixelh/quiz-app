(() => {
  const labels = ["A", "B", "C", "D", "E", "F"];
  const PROGRESS_KEY = "quiz.progress.source-docx.v1";
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

  async function decodeBuiltInQuestions() {
    if (!window.QUIZ_DATA_GZIP_B64) throw new Error("题库数据缺失");
    const bin = atob(window.QUIZ_DATA_GZIP_B64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    let jsonText;
    if ("DecompressionStream" in window) {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      jsonText = await new Response(stream).text();
    } else if (window.pako && typeof window.pako.ungzip === "function") {
      jsonText = window.pako.ungzip(bytes, { to: "string" });
    } else {
      throw new Error("当前浏览器不支持题库解压，请刷新后重试");
    }
    const raw = JSON.parse(jsonText);
    const out = raw.map(([t, sourceNumber, question, optionTexts, answer, id]) => {
      const options = {};
      optionTexts.forEach((text, i) => { options[labels[i]] = text; });
      return { id, type: t === "m" ? "multiple" : "single", sourceNumber, question, options, answer: String(answer).split("").filter(Boolean) };
    });
    if (out.length !== 750) throw new Error(`题库数量异常：${out.length}`);
    return out;
  }

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function saveProgress() { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); }

  function normalizeAnswer(a) {
    return [...new Set((Array.isArray(a) ? a : []).map(v => String(v).trim().toUpperCase()).filter(Boolean))].sort();
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
    els.statTotal.textContent = questions.length;
    els.statWrong.textContent = getWrongQuestions().length;
    els.statMastered.textContent = Object.values(progress).filter(x => x.mastered).length;
  }

  function showView(view) {
    els.homeView.classList.toggle("active", view === "home");
    els.quizView.classList.toggle("active", view === "quiz");
    if (view === "home") renderStats();
  }

  function start(mode) {
    const source = mode === "wrong" ? getWrongQuestions() : questions;
    if (!source.length) {
      alert(mode === "wrong" ? "目前没有未掌握的错题。" : "题库加载失败。");
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

  async function init() {
    try {
      questions = await decodeBuiltInQuestions();
      localStorage.removeItem("quiz.questions");
      progress = loadProgress();
      els.startRandom.addEventListener("click", () => start("random"));
      els.startWrong.addEventListener("click", () => start("wrong"));
      els.backHome.addEventListener("click", () => showView("home"));
      els.submitAnswer.addEventListener("click", submitAnswer);
      els.nextQuestion.addEventListener("click", nextQuestion);
      els.resetProgress.addEventListener("click", resetProgress);
      renderStats();
    } catch (err) {
      document.body.innerHTML = `<main class="app-shell"><div class="panel"><h2>题库加载失败</h2><p>${err.message}</p></div></main>`;
    }
  }

  init();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
