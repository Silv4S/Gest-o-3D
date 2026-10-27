# 🖨️ Gestão 3D

Sistema web para gestão de um negócio de impressão 3D: **fluxo de caixa**, **pedidos**, **clientes**, **insumos (estoque)**, **precificação** e **dashboard** com gráficos da produção do mês.

Roda 100% no navegador (HTML + JS puro, sem servidor, sem build). Os dados ficam no `localStorage` do navegador — **não são enviados ao GitHub**.

## Abas

| Aba | O que faz |
|---|---|
| Dashboard | KPIs e gráficos do mês: entradas × saídas, saldo acumulado, horas de impressão por dia, pedidos por status, últimos 6 meses, saídas por categoria, top clientes, alerta de estoque baixo |
| Fluxo de caixa | Entradas e saídas por mês, categoria e forma de pagamento |
| Pedidos | Cliente, valor, custo, horas, filamento, canal (Direta/Shopee), status e pagamento |
| Clientes | Cadastro e total comprado por cliente |
| Insumos | Estoque de filamento e embalagens, estoque mínimo, “Registrar compra” (lança a saída no caixa) |
| Precificação | Mesma lógica da planilha: energia + depreciação + filamento + modelagem + manutenção + colaborador + embalagem → preço direto e preço Shopee |
| Dados | Backup/restauração em JSON e exportação CSV |

## Automações
- Marcar um pedido como **Pago** cria a entrada no fluxo de caixa (e desmarcar remove).
- Marcar como **Pronto/Entregue** baixa os gramas de filamento do estoque.
- **Registrar compra** de insumo soma ao estoque e lança a saída.
- Em Precificação, **Criar pedido com este preço** já abre o pedido preenchido.

## Publicar no GitHub Pages
```bash
git init -b main
git add .
git commit -m "Gestão 3D"
git remote add origin https://github.com/SEU_USUARIO/gestao-3d.git
git push -u origin main
```
No repositório: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.
O site ficará em `https://SEU_USUARIO.github.io/gestao-3d/`.

> ⚠️ Em repositório público qualquer pessoa pode abrir o site, mas só vê **os próprios dados do navegador dela** (vazio). Faça backup JSON periodicamente — limpar o navegador apaga os dados.

## Estrutura
```
index.html
css/style.css
js/calc.js     # fórmulas de precificação
js/app.js      # telas, dados e gráficos
vendor/chart.umd.js   # Chart.js 4.4.7 (MIT)
```
