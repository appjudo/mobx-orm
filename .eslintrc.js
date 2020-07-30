const config = {
  root: true,
  parser: '@typescript-eslint/parser',

  ignorePatterns: [
    'build',
    'dist',
    'node_modules/',
  ],

  plugins: [
    'import',
    '@typescript-eslint',
  ],

  settings: {
    'import/resolver': {
      // Automatically loads and uses tsconfig.json config file.

      typescript: {
        'alwaysTryTypes': true,
      },
    },
  },

  extends: [
    'airbnb/base',

    // TODO: Uncomment this when we have time to deal with all the resulting errors/warnings.
    // 'plugin:@typescript-eslint/recommended',
  ],

  rules: {
    // Disable select rules from `extends` packages (above).
    'no-multi-assign': 0,
    'no-param-reassign': 0,
    'no-plusplus': 0,
    'no-nested-ternary': 0,
    'no-unused-expressions': 0,
    'no-use-before-define': 0,
    'object-curly-spacing': 0,
    'prefer-template': 0,
    'react/destructuring-assignment': 0,
    'react/jsx-curly-newline': 0,
    'react/jsx-first-prop-new-line': 0,
    'react/jsx-max-props-per-line': 0,
    'react/jsx-props-no-spreading': 0,
    'react/prop-types': 0,

    // Temporarily disable select rules from `extends` packages (above).
    'no-shadow': 0,
    'jsx-a11y/label-has-associated-control': 0,
    'jsx-a11y/click-events-have-key-events': 0,
    'react-hooks/exhaustive-deps': 0,

    // Temporary disable broken typescript-eslint rules.
    // See https://github.com/typescript-eslint/typescript-eslint/issues/1856
    'no-unused-vars': 0,

    // Tweak select rules `extends` packages (above).
    'arrow-parens': 0,
    'lines-between-class-members': 0,
    'max-classes-per-file': 0,
    'max-len': [2, {'code': 140}],
    'no-console': [2, {allow: ['warn', 'error']}],
    'no-multi-spaces': [2, {'ignoreEOLComments': true}],
    'object-curly-newline': [2, {'consistent': true, 'multiline': true}],
    'no-empty': [2, {'allowEmptyCatch': true}],

    'comma-dangle': [2, {
      'arrays': 'always-multiline',
      'objects': 'always-multiline',
      'imports': 'always-multiline',
      'exports': 'always-multiline',
      'functions': 'only-multiline',
    }],
    'no-underscore-dangle': 0,

    'import/extensions': [2, 'never'],
    
    // Additional code style rules.
    'no-return-assign': [2, 'except-parens'],

    // Additional TypeScript rules.
    '@typescript-eslint/ban-ts-ignore': 1,
    '@typescript-eslint/member-delimiter-style': 2,
    '@typescript-eslint/type-annotation-spacing': 2,
    // '@typescript-eslint/interface-name-prefix': 1,
  },
};

// In development, treat all errors as warnings.
if (process.env.NODE_ENV === 'development') {
  if (!config.plugins) config.plugins = [];
  config.plugins.push('only-warn');
}

module.exports = config;
