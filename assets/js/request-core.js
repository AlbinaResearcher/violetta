/* Pure request rules shared by the form and Node tests. No network or storage. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VivobitRequest = factory();
})(typeof window === 'undefined' ? this : window, function () {
  'use strict';
  var products = ['song', 'clip', 'time', 'undecided'];
  var channels = ['telegram', 'vk', 'avito'];
  function clean(value, max) { return String(value || '').trim().slice(0, max); }
  function normalize(input) {
    return {
      recipient: clean(input.recipient, 2), occasion: clean(input.occasion, 2),
      product: clean(input.product, 20), channel: clean(input.channel, 20),
      name: clean(input.name, 100), contact: clean(input.contact, 200)
    };
  }
  function validate(data) {
    if (!/^[0-9]$/.test(data.recipient)) return { field: 'recipient', message: 'Выберите, для кого песня.' };
    if (!/^(?:[0-9]|10)$/.test(data.occasion)) return { field: 'occasion', message: 'Выберите повод.' };
    if (!products.includes(data.product)) return { field: 'product', message: 'Выберите подарок.' };
    if (!channels.includes(data.channel)) return { field: 'channel', message: 'Выберите способ связи.' };
    if (!data.contact) return { field: 'contact', message: 'Укажите контакт для связи.' };
    if (data.channel === 'telegram' && !/^(?:@|(?:https?:\/\/)?t\.me\/)?[a-zA-Z][a-zA-Z0-9_]{4,31}\/?$/.test(data.contact)) {
      return { field: 'contact', message: 'Укажите Telegram в формате @nickname или t.me/nickname.' };
    }
    if (data.channel === 'vk' && !/^(?:https?:\/\/)?(?:www\.)?(?:vk\.com|vk\.ru)\/[a-zA-Z0-9_.-]+\/?$/.test(data.contact)) {
      return { field: 'contact', message: 'Укажите ссылку на страницу: vk.com/имя_страницы.' };
    }
    if (data.channel === 'avito') {
      try {
        var url = new URL(/^https?:\/\//i.test(data.contact) ? data.contact : 'https://' + data.contact);
        if (!['avito.ru', 'www.avito.ru'].includes(url.hostname) || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || !/^\/(?:user\/[a-zA-Z0-9_-]+(?:\/profile)?|brands\/[a-zA-Z0-9_-]+)\/?$/.test(url.pathname)) throw new Error('Invalid profile');
      } catch (error) { return { field: 'contact', message: 'Укажите ссылку на профиль Авито: avito.ru/user/… или avito.ru/brands/…' }; }
    }
    return null;
  }
  function format(data, options) {
    return [
      data.product === 'undecided' ? 'Здравствуйте! Хочу обсудить подарок.' : 'Здравствуйте! Хочу оформить заказ.',
      'Для кого: ' + options.recipients[Number(data.recipient)][1],
      'Повод: ' + options.occasions[Number(data.occasion)][1],
      'Подарок: ' + options.products[products.indexOf(data.product)][1],
      ...(data.name ? ['Меня зовут: ' + data.name] : []),
      'Удобный способ связи: ' + options.channels[channels.indexOf(data.channel)],
      'Контакт: ' + data.contact
    ].join('\n');
  }
  return { normalize: normalize, validate: validate, format: format };
});
