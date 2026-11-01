# Modelos de e-mail do Supabase

Cole cada arquivo em **Authentication → Emails → Templates** no painel do Supabase
(aba "Source"), com o assunto indicado:

| Modelo no Supabase   | Arquivo                   | Assunto                                  |
|----------------------|---------------------------|------------------------------------------|
| Confirm sign up      | `confirmar-cadastro.html` | Confirme seu e-mail no Rift Arcade       |
| Reset password       | `redefinir-senha.html`    | Redefinir sua senha do Rift Arcade       |
| Change email address | `trocar-email.html`       | Confirme seu novo e-mail no Rift Arcade  |

`{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}` e `{{ .Data.username }}`
são preenchidos pelo Supabase na hora do envio.
