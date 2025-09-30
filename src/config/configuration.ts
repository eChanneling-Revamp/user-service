export default () => ({
  port: parseInt(process.env.PORT || '3002', 10) || 3002,
  database: {
    provider: 'supabase',
  },
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_TOKEN_SECRET,
    refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET,
    accessTokenExpires: process.env.JWT_ACCESS_TOKEN_EXPIRES || '15m',
    refreshTokenExpires: process.env.JWT_REFRESH_TOKEN_EXPIRES || '7d',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
    },
    azure: {
      clientId: process.env.AZURE_CLIENT_ID,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
      redirectUri: process.env.AZURE_REDIRECT_URI,
      tenant: process.env.AZURE_TENANT || 'common',
    },
  },
});