const path = require('path');

module.exports = ({ env }) => {
  const client = env('DATABASE_CLIENT', 'sqlite');
  const filename = env('DATABASE_FILENAME', '.tmp/data.db');
  const resolvedFilename = path.isAbsolute(filename)
    ? filename
    : path.join(__dirname, '..', filename);

  return {
    connection: {
      client,
      connection: {
        filename: resolvedFilename,
      },
      useNullAsDefault: true,
      debug: false,
    },
  };
};
