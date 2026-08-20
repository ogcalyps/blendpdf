module.exports = ({ env }) => ({
  'users-permissions': {
    config: {
      jwtSecret: env('ADMIN_JWT_SECRET') || env('JWT_SECRET') || 'fallback-change-in-production',
    },
  },
  i18n: {
    enabled: true,
    config: {
      defaultLocale: 'en',
      locales: ['en', 'ar'],
    },
  },
});
