/* ==========================================================================
   Hero — движение.

   Всё движение считается в JS-кадрах, а не CSS-анимациями: в среде дизайна
   системная настройка «уменьшить движение» глушила CSS-анимации и облака
   стояли на месте. Поэтому здесь нет `prefers-reduced-motion` — вместо него
   один явный тумблер MOTION ниже.

     MOTION = true   дрейф облаков, мерцание звёзд, смена слова в заголовке
     MOTION = false  сцена замирает, скролл-эффект продолжает работать
   ========================================================================== */

(function () {
  "use strict";

  var MOTION = true;

  var WORDS = ["запомнят", "полюбят", "будут петь", "не забудут"];
  var STAR_COUNT = 46;
  var CYCLE = 3400; // как часто меняется слово, мс
  var OUT = 560;    // уход вверх с размытием
  var IN = 620;     // возврат снизу

  // 0 — слово на месте, 1 — уходит вверх, 2 — мгновенно переставлено вниз
  var PHASES = [
    { o: 1, y: 0, sc: 1, blur: 0, ms: IN, ease: "cubic-bezier(.22,.9,.24,1)" },
    { o: 0, y: -14, sc: 0.965, blur: 5, ms: OUT, ease: "cubic-bezier(.5,0,.75,0)" },
    { o: 0, y: 16, sc: 0.985, blur: 5, ms: 0, ease: "linear" }
  ];

  // Хеш-рандом: раскладка звёзд одинакова при каждой загрузке.
  function rnd(seed) {
    var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  var el = {
    sky: document.getElementById("hero-sky"),
    starHost: document.getElementById("hero-stars"),
    cloudA: document.getElementById("hero-cloud-a"),
    cloudB: document.getElementById("hero-cloud-b"),
    cloudC: document.getElementById("hero-cloud-c"),
    bank2: document.getElementById("hero-bank-2"),
    bank3: document.getElementById("hero-bank-3"),
    content: document.getElementById("hero-content"),
    next: document.getElementById("hero-next"),
    word: document.getElementById("hero-word")
  };

  if (!el.sky || !el.word) return;

  var state = { wordIndex: 0, phase: 0, p: 0, t: 0 };

  /* ---- звёзды ---------------------------------------------------------- */

  var seeds = [];
  var starNodes = [];

  (function buildStars() {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < STAR_COUNT; i++) {
      var a = rnd(i + 1);
      var b = rnd(i * 3.7 + 9.2);
      var c = rnd(i * 7.3 + 21.5);
      var seed = {
        x: (a * 100).toFixed(2),
        // Степень < 1.5 уплотняет звёзды к верху неба.
        y: (1 + Math.pow(b, 1.35) * 52).toFixed(2),
        s: (1.1 + c * 1.9).toFixed(2),
        ph: rnd(i * 11.9 + 4.4) * 6.283,
        sp: 0.35 + rnd(i * 5.1 + 2.2) * 0.75,
        base: 0.12 + rnd(i * 2.9 + 13.1) * 0.2
      };
      seeds.push(seed);

      var node = document.createElement("span");
      node.className = "hero__star";
      node.style.left = seed.x + "%";
      node.style.top = seed.y + "%";
      node.style.width = seed.s + "px";
      node.style.height = seed.s + "px";
      frag.appendChild(node);
      starNodes.push(node);
    }
    el.starHost.appendChild(frag);
  })();

  /* ---- кадр ------------------------------------------------------------ */

  function render() {
    var t = state.t;
    var p = state.p;
    var word = PHASES[state.phase];

    // Тизер второго экрана проявляется во второй половине скролла.
    var nt = clamp01((p - 0.45) / 0.4);
    // Ночная часть сцены гаснет по мере подъёма закатных слоёв.
    var dim = 1 - Math.min(1, p * 1.4);

    for (var i = 0; i < starNodes.length; i++) {
      var s = seeds[i];
      starNodes[i].style.opacity = (
        (s.base + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(t * s.sp + s.ph), 2.2)) * dim
      ).toFixed(3);
    }

    el.cloudA.style.opacity = (0.5 * dim).toFixed(3);
    el.cloudB.style.opacity = (0.46 * dim).toFixed(3);
    el.cloudC.style.opacity = (0.42 * dim).toFixed(3);

    // Горизонтальный дрейф: разные периоды и амплитуды у каждого облака.
    el.cloudA.style.transform =
      "translate3d(" + (Math.sin(t / 7.5) * 26).toFixed(1) + "px, " +
      (Math.sin(t / 5.1) * 6).toFixed(1) + "px, 0)";
    el.cloudB.style.transform =
      "translate3d(" + (Math.sin(t / 9.2 + 2) * -30).toFixed(1) + "px, " +
      (Math.sin(t / 6.3 + 1) * 5).toFixed(1) + "px, 0)";
    el.cloudC.style.transform =
      "translate3d(" + (Math.sin(t / 11 + 4) * -20).toFixed(1) + "px, " +
      (Math.sin(t / 7.7 + 3) * 7).toFixed(1) + "px, 0)";

    // Закатные слои поднимаются с наложением и разным масштабом.
    el.bank2.style.transform =
      "translateX(-50%) translate3d(" + (Math.sin(t / 14) * 10).toFixed(1) + "px, " +
      (p * 16).toFixed(1) + "%, 0) scale(" + (1 + p * 0.1).toFixed(3) + ")";
    el.bank3.style.transform =
      "translateX(-50%) translate3d(" + (Math.sin(t / 17 + 2) * -14).toFixed(1) + "px, " +
      (p * 11).toFixed(1) + "%, 0) scale(" + (1 + p * 0.06).toFixed(3) + ")";

    el.sky.style.transform = "translateY(" + (-p * 96).toFixed(2) + "svh)";

    el.content.style.transform = "translateY(" + (-p * 90).toFixed(1) + "px)";
    el.content.style.opacity = Math.max(0, 1 - p * 1.9).toFixed(3);

    el.next.style.opacity = nt.toFixed(3);
    el.next.style.transform = "translateY(" + ((1 - nt) * 26).toFixed(1) + "px)";

    el.word.textContent = WORDS[state.wordIndex];
    el.word.style.transition =
      "opacity " + word.ms + "ms " + word.ease +
      ", transform " + word.ms + "ms " + word.ease +
      ", filter " + word.ms + "ms " + word.ease;
    el.word.style.opacity = word.o;
    el.word.style.filter = "blur(" + word.blur + "px)";
    el.word.style.transform = "translateY(" + word.y + "px) scale(" + word.sc + ")";
  }

  /* ---- скролл ---------------------------------------------------------- */

  function onScroll() {
    var vh = document.documentElement.clientHeight || 1;
    var next = clamp01(window.scrollY / (vh * 0.85));
    if (Math.abs(next - state.p) > 0.002) {
      state.p = next;
      render();
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
  render();

  if (!MOTION) return;

  /* ---- часы ------------------------------------------------------------ */

  var start = performance.now();
  var last = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    if (now - last < 40) return; // 25 кадров/с достаточно для медленного дрейфа
    last = now;
    state.t = (now - start) / 1000;
    render();
  }

  requestAnimationFrame(loop);

  /* ---- смена слова ----------------------------------------------------- */

  setInterval(function () {
    state.phase = 1;
    render();

    setTimeout(function () {
      state.wordIndex = (state.wordIndex + 1) % WORDS.length;
      state.phase = 2; // мгновенно переставляем слово вниз, без перехода
      render();
    }, OUT);

    setTimeout(function () {
      state.phase = 0; // и отпускаем его вверх на место
      render();
    }, OUT + 40);
  }, CYCLE);
})();
