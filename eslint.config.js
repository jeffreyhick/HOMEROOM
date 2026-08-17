import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: '@/lib/supabase', message: 'Only *.repo.ts and lib/auth.ts (Rule 2).' }],
          patterns: [{ group: ['**/*.repo'], message: 'Repos are imported only by hooks (use*.ts).' }],
        },
      ],
    },
  },
  {
    files: ['src/**/*.repo.ts', 'src/lib/auth.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/*.repo'], message: 'Repos do not import other repos.' }] },
      ],
    },
  },
  {
    files: ['src/**/use*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: '@/lib/supabase', message: 'Hooks call repos, never supabase (Rule 2).' }],
        },
      ],
    },
  },
)
