'use strict';

/**
 * Serves GET /i18n/locales without auth so the admin login page can load.
 * The admin panel fetches locales during init; without this, unauthenticated
 * requests return 401 and block the login form.
 */
module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    if (ctx.method === 'GET' && (ctx.path === '/i18n/locales' || ctx.path === '/api/i18n/locales')) {
      try {
        const { sanitize } = require('@strapi/utils');
        const localesService = strapi.plugin('i18n').service('locales');
        const locales = await localesService.find();
        const model = strapi.getModel('plugin::i18n.locale');
        const sanitized = await Promise.all(locales.map((l) => sanitize.contentAPI.output(l, model)));
        ctx.body = await localesService.setIsDefault(sanitized);
        ctx.type = 'json';
        return;
      } catch (err) {
        strapi.log.error('[public-locales]', err);
      }
    }
    await next();
  };
};
