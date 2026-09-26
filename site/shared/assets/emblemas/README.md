# Escudos próprios do site

Arte própria dos times (pixel art, emblemas originais etc.), usada no modo
padrão `TEAM_LOGOS = 'escudos'` de `shared/config.js`.

- Mesmos nomes de arquivo das logos oficiais (veja `../times/README.md`),
  por exemplo `loud.png`, `t1.png`.
- PNG com fundo transparente, 256×256 px, de preferência menos de ~30 KB.
- Time sem arquivo aqui usa o escudo gerado automaticamente (sigla + cores).

## Trocar rápido entre escudos e logos oficiais

Em `shared/config.js`:

```js
export const TEAM_LOGOS = 'escudos';            // todos com escudo próprio
export const TEAM_LOGOS = 'oficiais';           // todos com logo oficial
export const OFFICIAL_LOGOS_ALLOWED = ['loud']; // só a LOUD com logo oficial
```
