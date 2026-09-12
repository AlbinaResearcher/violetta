const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const request = require('../assets/js/request-core.js');
const root = path.resolve(__dirname, '..');

function setup(t) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.matchMedia = query => ({ matches: query.includes('reduced-motion'), addEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.play = async function () { this.dispatchEvent(new w.Event('playing')); };
  const errors = [];
  w.addEventListener('error', e => errors.push(e.error));
  for (const script of w.document.querySelectorAll('script[src]')) {
    w.eval(fs.readFileSync(path.join(root, script.getAttribute('src')), 'utf8'));
  }
  assert.deepEqual(errors, []);
  return { w, d: w.document, errors };
}
function fillRequest(w, d) {
  const form = d.getElementById('request-form');
  form.elements.recipient.value = '1';
  form.elements.occasion.value = '1';
  form.elements.product.value = 'clip';
  form.elements.name.value = 'Альбина';
  form.elements.contact.value = '@example_user';
  return form;
}

test('exported pages have unique IDs, resolvable local links and no design runtime', () => {
  for (const name of ['index.html', 'privacy.html', 'offer.html']) {
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    const d = new JSDOM(text).window.document;
    assert.doesNotMatch(text, /{{|<sc-for|<sc-if|<dc-import|support\.js|data-design-action/);
    const ids = [...d.querySelectorAll('[id]')].map(n => n.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const el of d.querySelectorAll('[href], [src]')) {
      const value = el.getAttribute('href') || el.getAttribute('src');
      if (/^[a-z]+:/i.test(value)) continue;
      const [file, hash] = value.split('#');
      if (file) assert.ok(fs.existsSync(path.join(root, decodeURIComponent(file))), `${name}: ${value}`);
      else if (hash) assert.ok(d.getElementById(hash), `${name}: ${value}`);
      else assert.fail(`Placeholder URL in ${name}`);
    }
    d.defaultView.close();
  }
});

test('all authored sections and all FAQ answers exist without JavaScript', () => {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  const d = dom.window.document;
  assert.deepEqual([...d.querySelectorAll('main > section')].map(n => n.id), ['how','examples','pricing','faq','request']);
  assert.equal(d.querySelectorAll('.faq-item').length, 6);
  for (const answer of d.querySelectorAll('.faq-answer')) assert.ok(answer.textContent.trim().length > 50);
  assert.equal(d.getElementById('request-submit').disabled, true);
  assert.equal(d.getElementById('request-form').method, 'post');
  dom.window.close();
});

test('mobile disclosure closes on Escape and restores trigger focus', t => {
  const { w, d } = setup(t);
  const toggle = d.querySelector('.menu-toggle');
  toggle.click();
  assert.equal(d.getElementById('mobile-menu').hidden, false);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(d.getElementById('mobile-menu').hidden, true);
  assert.equal(d.activeElement, toggle);
  toggle.click();
  d.querySelector('#mobile-menu a[href="#how"]').click();
  assert.equal(d.getElementById('mobile-menu').hidden, true);
  assert.equal(d.activeElement.id, 'how');
});

test('tariff CTA selects the corresponding package without discarding the form', t => {
  const { w, d } = setup(t);
  const form = fillRequest(w, d);
  for (const product of ['song','clip','time','undecided']) {
    d.querySelector(`[data-product="${product}"]`).click();
    assert.equal(form.elements.product.value, product);
    assert.equal(form.elements.name.value, 'Альбина');
  }
});

test('song tabs support arrow keys and never simulate playback for missing audio', t => {
  const { w, d } = setup(t);
  d.getElementById('song-tab-0').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  assert.equal(d.activeElement.id, 'song-tab-4');
  assert.equal(d.getElementById('song-title').textContent, 'Папина пластинка');
  assert.equal(d.querySelectorAll('[role="tab"][tabindex="0"]').length, 1);
  assert.equal(d.getElementById('song-play').disabled, true);
  assert.equal(d.getElementById('song-current').textContent, '0:00');
  assert.equal(d.getElementById('song-audio').hasAttribute('src'), false);
  assert.match(d.getElementById('song-status').textContent, /скоро/);
});

test('media progress and play state come from audio events when a source is configured', async t => {
  const { w, d } = setup(t);
  w.VivobitData.songs[1].audioSrc = 'assets/audio/example.mp3';
  d.getElementById('song-tab-1').click();
  const audio = d.getElementById('song-audio');
  Object.defineProperty(audio, 'duration', { value: 200 });
  audio.currentTime = 50;
  audio.dispatchEvent(new w.Event('loadedmetadata'));
  audio.dispatchEvent(new w.Event('timeupdate'));
  assert.equal(d.getElementById('song-seek').value, '25');
  assert.equal(d.getElementById('song-current').textContent, '0:50');
  assert.equal(d.getElementById('song-duration').textContent, '3:20');
  d.getElementById('song-play').click();
  await Promise.resolve();
  assert.equal(d.getElementById('song-play').dataset.playing, 'true');
  audio.dispatchEvent(new w.Event('error'));
  assert.match(d.getElementById('song-status').textContent, /недоступна/);
});

test('valid request becomes an editable message, with no false delivery confirmation', async t => {
  const { w, d } = setup(t);
  const form = fillRequest(w, d);
  assert.equal(form.checkValidity(), true);
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(form.hidden, true);
  assert.equal(d.getElementById('request-handoff').hidden, false);
  const message = d.getElementById('request-message').value;
  assert.match(message, /Для кого: Маме/);
  assert.match(message, /Подарок: Песня \+ видеоклип/);
  assert.match(message, /@example_user/);
  assert.doesNotMatch(d.getElementById('request-handoff').textContent, /Заявка уже у нас|успешно отправлена/);
  let copied;
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async text => { copied = text; } } });
  d.getElementById('copy-request').click();
  await Promise.resolve();
  assert.equal(copied, message);
  d.getElementById('edit-request').click();
  assert.equal(form.hidden, false);
  assert.equal(form.elements.name.value, 'Альбина');
});

test('invalid contact prevents the handoff; channel change updates visible guidance', t => {
  const { w, d } = setup(t);
  const form = fillRequest(w, d);
  form.elements.contact.value = 'x';
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(d.getElementById('request-handoff').hidden, true);
  assert.match(d.getElementById('request-status').textContent, /Telegram/);
  const vk = d.querySelector('input[name="channel"][value="vk"]');
  vk.checked = true; vk.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(form.elements.contact.validationMessage, '');
  assert.equal(form.elements.contact.placeholder, 'vk.com/...');
});

test('request rules reject unknown choices and preserve literal user text safely', () => {
  const good = request.normalize({ recipient:'1', occasion:'10', product:'song', channel:'vk', contact:' https://vk.com/example_user ', name:' <b>Вера</b> ' });
  assert.equal(request.validate(good), null);
  assert.equal(good.name, '<b>Вера</b>');
  assert.equal(request.validate({...good, recipient:'99'}).field, 'recipient');
  assert.equal(request.validate({...good, product:'free'}).field, 'product');
  assert.equal(request.validate({...good, contact:'javascript:alert(1)'}).field, 'contact');
});
