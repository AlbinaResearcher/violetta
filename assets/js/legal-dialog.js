/* Read same-origin documents without leaving or storing the request draft. */
(function () {
  'use strict';
  var dialog = document.getElementById('legal-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  var content = document.getElementById('legal-content');
  var title = document.getElementById('legal-title');
  var close = document.getElementById('legal-close');
  var generation = 0;
  var opener;
  var documents = { 'privacy.html': 'Политика обработки данных', 'offer.html': 'Условия заказа' };
  async function openDocument(href) {
    if (!documents[href]) return;
    var current = ++generation;
    title.textContent = documents[href];
    content.textContent = 'Загружаем документ…';
    content.setAttribute('aria-busy', 'true');
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('legal-open');
    close.focus();
    try {
      var response = await fetch(href, { credentials: 'omit' });
      if (!response.ok) throw new Error('Document unavailable');
      var parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
      var main = parsed.querySelector('main');
      if (!main) throw new Error('Document unavailable');
      if (current !== generation || !dialog.open) return;
      content.replaceChildren(...Array.from(main.childNodes, function (node) { return document.importNode(node, true); }));
      content.scrollTop = 0;
    } catch (error) {
      if (current !== generation || !dialog.open) return;
      var fallback = document.createElement('a');
      fallback.href = href; fallback.target = '_blank'; fallback.rel = 'noopener';
      fallback.textContent = 'Открыть документ в новой вкладке';
      content.replaceChildren(document.createTextNode('Не удалось загрузить документ. Ваша заявка остаётся на странице. '), fallback);
    } finally {
      if (current === generation) content.removeAttribute('aria-busy');
    }
  }
  document.querySelectorAll('a[data-legal]').forEach(function (link) {
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', function (event) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); opener = link; openDocument(link.getAttribute('href'));
    });
  });
  close.addEventListener('click', function () { dialog.close(); });
  content.addEventListener('click', function (event) {
    var link = event.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href');
    if (/^index\.html(?:#.*)?$/.test(href)) { event.preventDefault(); dialog.close(); }
    else if (documents[href] && !link.target) { event.preventDefault(); openDocument(href); }
  });
  dialog.addEventListener('close', function () {
    generation++;
    document.documentElement.classList.remove('legal-open');
    content.removeAttribute('aria-busy');
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  });
})();
