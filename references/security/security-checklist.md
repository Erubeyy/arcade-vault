## Checklist de seguridad básico

  - [ ] RLS: Row Level Security habilitado en ambas tablas: `games` y `scores`
  - [ ] Minimum password length — mínimo 8 caracteres
  - [ ] Leaked password protection — (el warning 4)
  - [ ] Max signup rate — limitar signups por IP (anti-bot)
  - [ ] Headers de seguridad en Next.js
  
  Ej:

```ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

// En la config de Next.js:
headers: async () => [
  { source: '/(.*)', headers: securityHeaders }
]
```

## Por el lado de Supabase:

- [ ] TODO: vayan al panel de warnings y errores de Supabase
