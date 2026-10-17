# Emblemas dos elos (ranqueada)

- `originais/`: as imagens enviadas (435×457, fundo transparente).
- `<elo>.webp`: recorte com a mesma moldura para todos (o Desafiante fica
  maior, como deve), 256 px de largura. Usado nos cartões grandes.
- `<elo>-icone.webp`: recorte justo, 64×64, para os ícones pequenos (listas).

Para trocar um emblema, substitua o original e gere de novo (Pillow):
recorte comum `(57, 61, 378, 396)` e recorte justo pelo `getbbox()`.
