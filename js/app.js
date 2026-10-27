(() => {
'use strict';

/* ============ Utilidades ============ */
const KEY = 'gestao3d.v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const brl = (n) => (+n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dec = (n, d = 1) => (+n || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtD = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const sum = (arr, f) => arr.reduce((a, x) => a + (+f(x) || 0), 0);
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesLabel = (ym) => `${MESES[+ym.slice(5, 7) - 1]}/${ym.slice(2, 4)}`;

const STATUS = ['Orçamento', 'Aprovado', 'Em produção', 'Pronto', 'Entregue', 'Cancelado'];
const CANAIS = ['Direta', 'Shopee', 'Outro'];
const FORMAS = ['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Shopee'];
const CAT_ENTRADA = ['Venda', 'Serviço de modelagem', 'Outros'];
const CAT_SAIDA = ['Insumos', 'Energia', 'Manutenção', 'Peças/Equipamento', 'Marketing', 'Taxas', 'Colaborador', 'Outros'];
const CAT_INSUMO = ['Filamento', 'Embalagem', 'Peças', 'Outros'];

/* ============ Dados ============ */
const DEFAULT_CONFIG = {
  potencia: 120, tarifa: 1.15, impressora: 3700, dataCompra: '2026-02-01', depAno: 0.2, vidaUtil: 10000,
  filamentoPreco: 125, filamentoPeso: 1000, colabMensal: 400, pecasMes: 100, valorHoraProjeto: 0,
  embalagem: 2, frete: 0, taxaShopee: 0.2, taxaFixaShopee: 4, margem: 1,
};
function seed() {
  const emb = (nome, qtd, preco) => ({ id: uid(), nome, categoria: 'Embalagem', unidade: 'un', estoque: 0, minimo: 0, qtdPacote: qtd, precoPacote: preco });
  return {
    config: { ...DEFAULT_CONFIG },
    clientes: [], pedidos: [], fluxo: [], seqPedido: 0,
    insumos: [
      { id: uid(), nome: 'Filamento PLA 1kg', categoria: 'Filamento', unidade: 'g', estoque: 0, minimo: 0, qtdPacote: 1000, precoPacote: 125 },
      emb('Sacola Plástica 20x30', 50, 13),
      emb('Saco Adesivado 6,5x9 (Pequeno)', 100, 4.5),
      emb('Saco Adesivado 10x15 (Médio)', 100, 8.5),
      emb('Saco Adesivado 14x14 (Grande)', 100, 18),
      emb('Saco de Envio (Correio/Shopee)', 250, 33.99),
      emb('Argola de Chaveiro', 500, 97.5),
    ],
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw); d.config = { ...DEFAULT_CONFIG, ...(d.config || {}) }; return d; }
  } catch (e) { console.warn(e); }
  return seed();
}
let db = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(db));

const custoUnit = (i) => (num(i.qtdPacote) ? num(i.precoPacote) / num(i.qtdPacote) : 0);
const cliente = (id) => db.clientes.find((c) => c.id === id);
const nomeCliente = (id) => cliente(id)?.nome || '';

/* ============ Estado de UI ============ */
const state = { tab: 'dashboard', mes: hoje().slice(0, 7), fluxoMes: hoje().slice(0, 7), fluxoTodos: false, fStatus: '', busca: '' };
let charts = [];
const killCharts = () => { charts.forEach((c) => c.destroy()); charts = []; };
const mkChart = (id, cfg) => { const el = $('#' + id); if (el) charts.push(new Chart(el, cfg)); };

/* ============ Modal de formulário ============ */
function openForm(title, fields, values, onSave, extra) {
  $('#modal-title').textContent = title;
  const form = $('#modal-form');
  form.innerHTML = '<div class="fields">' + fields.map((f) => {
    const v = values[f.k] ?? '';
    let input;
    if (f.type === 'select') input = `<select name="${f.k}">${f.options.map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
    else if (f.type === 'checkbox') input = `<input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}>`;
    else if (f.type === 'textarea') input = `<textarea name="${f.k}" rows="2">${esc(v)}</textarea>`;
    else input = `<input name="${f.k}" type="${f.type || 'text'}" ${f.type === 'number' ? 'step="any"' : ''} value="${esc(v)}" ${f.required ? 'required' : ''}>`;
    return `<div class="field" ${f.full ? 'style="grid-column:1/-1"' : ''}><label>${esc(f.label)}</label>${input}</div>`;
  }).join('') + '</div>' +
    `<div class="actions"><button type="button" class="btn sec" id="m-cancel">Cancelar</button><button class="btn">Salvar</button></div>`;
  $('#modal').classList.remove('hidden');
  $('#m-cancel').onclick = closeModal;
  form.onsubmit = (e) => {
    e.preventDefault();
    const out = {};
    fields.forEach((f) => {
      const el = form.elements[f.k];
      out[f.k] = f.type === 'checkbox' ? el.checked : f.type === 'number' ? num(el.value) : el.value.trim();
    });
    onSave(out);
    save(); closeModal(); render();
  };
  if (extra) extra(form);
}
const closeModal = () => $('#modal').classList.add('hidden');
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });

/* ============ Navegação ============ */
$('#nav').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  state.tab = b.dataset.tab;
  $$('#nav button').forEach((x) => x.classList.toggle('active', x === b));
  render();
});
function render() {
  killCharts();
  ({ dashboard: viewDashboard, fluxo: viewFluxo, pedidos: viewPedidos, clientes: viewClientes, insumos: viewInsumos, preco: viewPreco, config: viewConfig })[state.tab]();
}

/* ============ Dashboard ============ */
function viewDashboard() {
  const m = state.mes;
  const fl = db.fluxo.filter((f) => f.data.startsWith(m));
  const ent = sum(fl.filter((f) => f.tipo === 'entrada'), (f) => f.valor);
  const sai = sum(fl.filter((f) => f.tipo === 'saida'), (f) => f.valor);
  const saldoTotal = sum(db.fluxo.filter((f) => f.data <= m + '-31'), (f) => (f.tipo === 'entrada' ? f.valor : -f.valor));
  const saldoAnterior = sum(db.fluxo.filter((f) => f.data < m + '-01'), (f) => (f.tipo === 'entrada' ? f.valor : -f.valor));
  const prod = db.pedidos.filter((p) => ['Pronto', 'Entregue'].includes(p.status) && (p.dataConclusao || p.data).startsWith(m));
  const pecas = sum(prod, (p) => p.qtd);
  const horas = sum(prod, (p) => p.horas);
  const gramas = sum(prod, (p) => p.gramas);
  const fat = sum(prod, (p) => p.valor);
  const lucro = fat - sum(prod, (p) => p.custo);
  const ticket = prod.length ? fat / prod.length : 0;
  const aReceber = sum(db.pedidos.filter((p) => !p.pago && ['Aprovado', 'Em produção', 'Pronto', 'Entregue'].includes(p.status)), (p) => p.valor);
  const baixos = db.insumos.filter((i) => num(i.minimo) > 0 && num(i.estoque) <= num(i.minimo));

  $('#view').innerHTML = `
    <div class="row"><h2 class="grow">Dashboard</h2>
      <div><label>Mês</label><input type="month" id="d-mes" value="${m}"></div></div>
    <div class="grid kpis">
      ${kpi('Entradas', brl(ent), 'pos')}${kpi('Saídas', brl(sai), 'neg')}
      ${kpi('Resultado do mês', brl(ent - sai), ent - sai >= 0 ? 'pos' : 'neg')}
      ${kpi('Saldo em caixa', brl(saldoTotal), saldoTotal >= 0 ? 'pos' : 'neg')}
      ${kpi('A receber', brl(aReceber))}
      ${kpi('Peças produzidas', dec(pecas, 0))}
      ${kpi('Horas de impressão', dec(horas) + ' h')}
      ${kpi('Filamento usado', dec(gramas / 1000, 2) + ' kg')}
      ${kpi('Faturamento (produzido)', brl(fat))}
      ${kpi('Lucro estimado', brl(lucro), lucro >= 0 ? 'pos' : 'neg')}
      ${kpi('Ticket médio', brl(ticket))}
    </div>
    ${baixos.length ? `<div class="card" style="margin-bottom:12px"><h3>⚠️ Estoque baixo</h3>${baixos.map((i) => `<span class="badge warn" style="margin-right:6px">${esc(i.nome)}: ${dec(i.estoque, 0)} ${esc(i.unidade)}</span>`).join('')}</div>` : ''}
    <div class="grid charts">
      <div class="card"><h3>Entradas × Saídas por dia</h3><div class="chartbox"><canvas id="c1"></canvas></div></div>
      <div class="card"><h3>Saldo acumulado no mês</h3><div class="chartbox"><canvas id="c2"></canvas></div></div>
      <div class="card"><h3>Produção por dia (horas de impressão)</h3><div class="chartbox"><canvas id="c3"></canvas></div></div>
      <div class="card"><h3>Pedidos do mês por status</h3><div class="chartbox"><canvas id="c4"></canvas></div></div>
      <div class="card"><h3>Últimos 6 meses</h3><div class="chartbox"><canvas id="c5"></canvas></div></div>
      <div class="card"><h3>Saídas por categoria</h3><div class="chartbox"><canvas id="c6"></canvas></div></div>
      <div class="card"><h3>Top clientes do mês</h3><div class="chartbox"><canvas id="c7"></canvas></div></div>
    </div>`;
  $('#d-mes').onchange = (e) => { if (e.target.value) { state.mes = e.target.value; render(); } };

  const [y, mo] = m.split('-').map(Number);
  const nd = new Date(y, mo, 0).getDate();
  const dias = Array.from({ length: nd }, (_, i) => i + 1);
  const dKey = (d) => `${m}-${pad(d)}`;
  const porDia = (arr, f) => dias.map((d) => sum(arr.filter((x) => x.dRef === dKey(d)), f));
  const entD = dias.map((d) => sum(fl.filter((f) => f.tipo === 'entrada' && f.data === dKey(d)), (f) => f.valor));
  const saiD = dias.map((d) => sum(fl.filter((f) => f.tipo === 'saida' && f.data === dKey(d)), (f) => f.valor));
  let acc = saldoAnterior; const saldoD = dias.map((_, i) => (acc += entD[i] - saiD[i]));
  const horasD = porDia(prod.map((p) => ({ ...p, dRef: p.dataConclusao || p.data })), (p) => p.horas);
  const COL = { g: '#16a34a', r: '#dc2626', b: '#2563eb', o: '#f59e0b', p: '#8b5cf6', t: '#14b8a6', k: '#64748b' };
  const txt = getComputedStyle(document.body).color;
  Chart.defaults.color = txt; Chart.defaults.borderColor = 'rgba(128,128,128,.2)';
  const base = { responsive: true, maintainAspectRatio: false };

  mkChart('c1', { type: 'bar', data: { labels: dias, datasets: [{ label: 'Entradas', data: entD, backgroundColor: COL.g }, { label: 'Saídas', data: saiD, backgroundColor: COL.r }] }, options: base });
  mkChart('c2', { type: 'line', data: { labels: dias, datasets: [{ label: 'Saldo', data: saldoD, borderColor: COL.b, backgroundColor: COL.b + '33', fill: true, tension: .25, pointRadius: 0 }] }, options: base });
  mkChart('c3', { type: 'bar', data: { labels: dias, datasets: [{ label: 'Horas', data: horasD, backgroundColor: COL.p }] }, options: base });
  const ped = db.pedidos.filter((p) => p.data.startsWith(m));
  mkChart('c4', { type: 'doughnut', data: { labels: STATUS, datasets: [{ data: STATUS.map((s) => ped.filter((p) => p.status === s).length), backgroundColor: [COL.k, COL.b, COL.o, COL.t, COL.g, COL.r] }] }, options: base });
  const meses = Array.from({ length: 6 }, (_, i) => { const d = new Date(y, mo - 1 - (5 - i), 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; });
  mkChart('c5', { type: 'bar', data: { labels: meses.map(mesLabel), datasets: [
    { label: 'Entradas', data: meses.map((x) => sum(db.fluxo.filter((f) => f.tipo === 'entrada' && f.data.startsWith(x)), (f) => f.valor)), backgroundColor: COL.g },
    { label: 'Saídas', data: meses.map((x) => sum(db.fluxo.filter((f) => f.tipo === 'saida' && f.data.startsWith(x)), (f) => f.valor)), backgroundColor: COL.r }] }, options: base });
  const cats = [...new Set(fl.filter((f) => f.tipo === 'saida').map((f) => f.categoria))];
  mkChart('c6', { type: 'doughnut', data: { labels: cats, datasets: [{ data: cats.map((c) => sum(fl.filter((f) => f.tipo === 'saida' && f.categoria === c), (f) => f.valor)), backgroundColor: Object.values(COL) }] }, options: base });
  const porCli = {};
  ped.filter((p) => !['Cancelado', 'Orçamento'].includes(p.status)).forEach((p) => { const n = nomeCliente(p.clienteId) || 'Sem cliente'; porCli[n] = (porCli[n] || 0) + p.valor; });
  const top = Object.entries(porCli).sort((a, b) => b[1] - a[1]).slice(0, 7);
  mkChart('c7', { type: 'bar', data: { labels: top.map((t) => t[0]), datasets: [{ label: 'R$', data: top.map((t) => t[1]), backgroundColor: COL.b }] }, options: { ...base, indexAxis: 'y' } });
}
const kpi = (l, v, cls = '') => `<div class="card kpi"><div class="l">${l}</div><div class="v ${cls}">${v}</div></div>`;

/* ============ Fluxo de caixa ============ */
function viewFluxo() {
  const lista = db.fluxo.filter((f) => state.fluxoTodos || f.data.startsWith(state.fluxoMes)).sort((a, b) => b.data.localeCompare(a.data));
  const ent = sum(lista.filter((f) => f.tipo === 'entrada'), (f) => f.valor);
  const sai = sum(lista.filter((f) => f.tipo === 'saida'), (f) => f.valor);
  $('#view').innerHTML = `
    <div class="row"><h2 class="grow">Fluxo de caixa</h2>
      <div><label>Mês</label><input type="month" id="f-mes" value="${state.fluxoMes}" ${state.fluxoTodos ? 'disabled' : ''}></div>
      <label style="margin-top:16px"><input type="checkbox" id="f-todos" ${state.fluxoTodos ? 'checked' : ''}> ver tudo</label>
      <button class="btn" data-act="novo-fluxo" data-tipo="entrada">+ Entrada</button>
      <button class="btn danger" data-act="novo-fluxo" data-tipo="saida">+ Saída</button></div>
    <div class="grid kpis">${kpi('Entradas', brl(ent), 'pos')}${kpi('Saídas', brl(sai), 'neg')}${kpi('Resultado', brl(ent - sai), ent - sai >= 0 ? 'pos' : 'neg')}</div>
    <div class="card tablewrap">${lista.length ? `<table><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Forma</th><th class="num">Valor</th><th></th></tr></thead><tbody>
      ${lista.map((f) => `<tr><td>${fmtD(f.data)}</td><td><span class="badge ${f.tipo === 'entrada' ? 'ok' : 'bad'}">${f.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span></td><td>${esc(f.categoria)}</td><td>${esc(f.descricao)}</td><td>${esc(f.forma || '')}</td><td class="num ${f.tipo === 'entrada' ? 'pos' : 'neg'}">${f.tipo === 'saida' ? '−' : ''}${brl(f.valor)}</td>
      <td><button class="btn sec sm" data-act="edit-fluxo" data-id="${f.id}">Editar</button> <button class="btn sec sm" data-act="del-fluxo" data-id="${f.id}">Excluir</button></td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">Nenhum lançamento neste período.</div>'}</div>`;
  $('#f-mes').onchange = (e) => { if (e.target.value) { state.fluxoMes = e.target.value; render(); } };
  $('#f-todos').onchange = (e) => { state.fluxoTodos = e.target.checked; render(); };
}
function formFluxo(f, tipo) {
  const t = f?.tipo || tipo;
  openForm(f ? 'Editar lançamento' : (t === 'entrada' ? 'Nova entrada' : 'Nova saída'), [
    { k: 'data', label: 'Data', type: 'date', required: true },
    { k: 'categoria', label: 'Categoria', type: 'select', options: (t === 'entrada' ? CAT_ENTRADA : CAT_SAIDA).map((x) => [x, x]) },
    { k: 'valor', label: 'Valor (R$)', type: 'number', required: true },
    { k: 'forma', label: 'Forma de pagamento', type: 'select', options: [['', '—'], ...FORMAS.map((x) => [x, x])] },
    { k: 'descricao', label: 'Descrição', full: true },
  ], f || { data: hoje(), valor: '' }, (v) => {
    if (f) Object.assign(f, v); else db.fluxo.push({ id: uid(), tipo: t, ...v });
  });
}

/* ============ Clientes ============ */
function viewClientes() {
  $('#view').innerHTML = `
    <div class="row"><h2 class="grow">Clientes</h2><button class="btn" data-act="novo-cliente">+ Cliente</button></div>
    <div class="card tablewrap">${db.clientes.length ? `<table><thead><tr><th>Nome</th><th>Telefone</th><th>Cidade</th><th class="num">Pedidos</th><th class="num">Total comprado</th><th>Obs.</th><th></th></tr></thead><tbody>
    ${db.clientes.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => {
      const ps = db.pedidos.filter((p) => p.clienteId === c.id && p.status !== 'Cancelado' && p.status !== 'Orçamento');
      return `<tr><td>${esc(c.nome)}</td><td>${esc(c.telefone)}</td><td>${esc(c.cidade)}</td><td class="num">${ps.length}</td><td class="num">${brl(sum(ps, (p) => p.valor))}</td><td>${esc(c.obs)}</td>
      <td><button class="btn sec sm" data-act="edit-cliente" data-id="${c.id}">Editar</button> <button class="btn sec sm" data-act="del-cliente" data-id="${c.id}">Excluir</button></td></tr>`;
    }).join('')}</tbody></table>` : '<div class="empty">Nenhum cliente cadastrado.</div>'}</div>`;
}
function formCliente(c) {
  openForm(c ? 'Editar cliente' : 'Novo cliente', [
    { k: 'nome', label: 'Nome', required: true }, { k: 'telefone', label: 'Telefone / WhatsApp' },
    { k: 'cidade', label: 'Cidade' }, { k: 'obs', label: 'Observações', type: 'textarea', full: true },
  ], c || {}, (v) => { if (c) Object.assign(c, v); else db.clientes.push({ id: uid(), ...v }); });
}

/* ============ Pedidos ============ */
function viewPedidos() {
  const q = state.busca.toLowerCase();
  const lista = db.pedidos.filter((p) => (!state.fStatus || p.status === state.fStatus) &&
    (!q || (p.descricao + nomeCliente(p.clienteId) + p.num).toLowerCase().includes(q))).sort((a, b) => b.num - a.num);
  $('#view').innerHTML = `
    <div class="row"><h2 class="grow">Pedidos</h2>
      <input id="p-busca" placeholder="Buscar…" value="${esc(state.busca)}" style="width:180px">
      <select id="p-status" style="width:160px"><option value="">Todos os status</option>${STATUS.map((s) => `<option ${state.fStatus === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <button class="btn" data-act="novo-pedido">+ Pedido</button></div>
    <div class="card tablewrap">${lista.length ? `<table><thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Descrição</th><th class="num">Qtd</th><th class="num">Valor</th><th>Canal</th><th>Status</th><th>Pago</th><th></th></tr></thead><tbody>
    ${lista.map((p) => `<tr><td>${p.num}</td><td>${fmtD(p.data)}</td><td>${esc(nomeCliente(p.clienteId) || '—')}</td><td>${esc(p.descricao)}</td><td class="num">${dec(p.qtd, 0)}</td><td class="num">${brl(p.valor)}</td><td>${esc(p.canal)}</td>
      <td><select data-st="${p.id}" style="width:130px;padding:4px">${STATUS.map((s) => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      <td><button class="btn sm ${p.pago ? '' : 'sec'}" data-act="toggle-pago" data-id="${p.id}">${p.pago ? 'Pago ✓' : 'Pendente'}</button></td>
      <td><button class="btn sec sm" data-act="edit-pedido" data-id="${p.id}">Editar</button> <button class="btn sec sm" data-act="del-pedido" data-id="${p.id}">Excluir</button></td></tr>`).join('')}
    </tbody></table>` : '<div class="empty">Nenhum pedido encontrado.</div>'}</div>
    <p class="note">Ao marcar “Pronto/Entregue” o filamento informado é baixado do estoque; ao marcar “Pago”, a entrada é lançada automaticamente no fluxo de caixa.</p>`;
  $('#p-busca').oninput = (e) => { state.busca = e.target.value; const pos = e.target.selectionStart; viewPedidos(); const i = $('#p-busca'); i.focus(); i.setSelectionRange(pos, pos); };
  $('#p-status').onchange = (e) => { state.fStatus = e.target.value; render(); };
}
function formPedido(p, pre) {
  const fil = db.insumos.filter((i) => i.categoria === 'Filamento');
  const base = p || { data: hoje(), qtd: 1, canal: 'Direta', status: 'Orçamento', forma: 'Pix', ...(pre || {}) };
  openForm(p ? `Editar pedido #${p.num}` : 'Novo pedido', [
    { k: 'data', label: 'Data do pedido', type: 'date', required: true },
    { k: 'clienteId', label: 'Cliente', type: 'select', options: [['', '— sem cliente —'], ...db.clientes.map((c) => [c.id, c.nome])] },
    { k: 'descricao', label: 'Descrição do pedido', required: true, full: true },
    { k: 'qtd', label: 'Quantidade (peças)', type: 'number' },
    { k: 'valor', label: 'Valor total (R$)', type: 'number', required: true },
    { k: 'custo', label: 'Custo total estimado (R$)', type: 'number' },
    { k: 'horas', label: 'Horas de impressão (total)', type: 'number' },
    { k: 'gramas', label: 'Filamento gasto (g, total)', type: 'number' },
    { k: 'filamentoId', label: 'Filamento usado', type: 'select', options: [['', '— nenhum —'], ...fil.map((i) => [i.id, i.nome])] },
    { k: 'canal', label: 'Canal de venda', type: 'select', options: CANAIS.map((x) => [x, x]) },
    { k: 'status', label: 'Status', type: 'select', options: STATUS.map((x) => [x, x]) },
    { k: 'dataConclusao', label: 'Data de conclusão', type: 'date' },
    { k: 'pago', label: 'Pago?', type: 'checkbox' },
    { k: 'dataPagamento', label: 'Data do pagamento', type: 'date' },
    { k: 'forma', label: 'Forma de pagamento', type: 'select', options: FORMAS.map((x) => [x, x]) },
    { k: 'obs', label: 'Observações', type: 'textarea', full: true },
  ], base, (v) => {
    if (p) Object.assign(p, v); else { p = { id: uid(), num: ++db.seqPedido, ...v }; db.pedidos.push(p); }
    efeitosPedido(p);
  });
}
function efeitosPedido(p) {
  if (['Pronto', 'Entregue'].includes(p.status)) {
    if (!p.dataConclusao) p.dataConclusao = hoje();
    if (!p.descontado && p.filamentoId && p.gramas > 0) {
      const ins = db.insumos.find((i) => i.id === p.filamentoId);
      if (ins) { ins.estoque = num(ins.estoque) - p.gramas; p.descontado = true; }
    }
  }
  const f = db.fluxo.find((x) => x.id === p.fluxoId);
  if (p.pago && p.status !== 'Cancelado') {
    if (!p.dataPagamento) p.dataPagamento = hoje();
    const desc = `Pedido #${p.num} — ${nomeCliente(p.clienteId) || p.descricao}`;
    if (f) Object.assign(f, { valor: p.valor, descricao: desc, forma: p.forma, data: p.dataPagamento });
    else { const nf = { id: uid(), data: p.dataPagamento, tipo: 'entrada', categoria: 'Venda', descricao: desc, forma: p.forma, valor: p.valor, pedidoId: p.id }; db.fluxo.push(nf); p.fluxoId = nf.id; }
  } else if (f) { db.fluxo = db.fluxo.filter((x) => x.id !== f.id); p.fluxoId = null; if (!p.pago) p.dataPagamento = ''; }
}
function delPedido(p) {
  if (p.descontado) { const ins = db.insumos.find((i) => i.id === p.filamentoId); if (ins) ins.estoque = num(ins.estoque) + p.gramas; }
  db.fluxo = db.fluxo.filter((f) => f.id !== p.fluxoId);
  db.pedidos = db.pedidos.filter((x) => x.id !== p.id);
}

/* ============ Insumos ============ */
function viewInsumos() {
  $('#view').innerHTML = `
    <div class="row"><h2 class="grow">Insumos</h2><button class="btn" data-act="novo-insumo">+ Insumo</button></div>
    <div class="card tablewrap"><table><thead><tr><th>Nome</th><th>Categoria</th><th class="num">Estoque</th><th class="num">Mínimo</th><th class="num">Pacote</th><th class="num">Preço pacote</th><th class="num">Custo unit.</th><th></th></tr></thead><tbody>
    ${db.insumos.map((i) => { const baixo = num(i.minimo) > 0 && num(i.estoque) <= num(i.minimo); return `<tr><td>${esc(i.nome)}</td><td>${esc(i.categoria)}</td>
      <td class="num">${baixo ? '<span class="badge warn">baixo</span> ' : ''}${dec(i.estoque, 0)} ${esc(i.unidade)}</td><td class="num">${dec(i.minimo, 0)}</td>
      <td class="num">${dec(i.qtdPacote, 0)} ${esc(i.unidade)}</td><td class="num">${brl(i.precoPacote)}</td><td class="num">R$ ${dec(custoUnit(i), 4)}${i.unidade === 'g' ? ' /g' : ''}</td>
      <td><button class="btn sm" data-act="compra-insumo" data-id="${i.id}">Registrar compra</button> <button class="btn sec sm" data-act="edit-insumo" data-id="${i.id}">Editar</button> <button class="btn sec sm" data-act="del-insumo" data-id="${i.id}">Excluir</button></td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="note">“Registrar compra” soma ao estoque e lança a saída (categoria Insumos) no fluxo de caixa. Para filamento use unidade “g” (ex.: pacote de 1000 g).</p>`;
}
function formInsumo(i) {
  openForm(i ? 'Editar insumo' : 'Novo insumo', [
    { k: 'nome', label: 'Nome', required: true, full: true },
    { k: 'categoria', label: 'Categoria', type: 'select', options: CAT_INSUMO.map((x) => [x, x]) },
    { k: 'unidade', label: 'Unidade (g, un, ml…)' },
    { k: 'estoque', label: 'Estoque atual', type: 'number' }, { k: 'minimo', label: 'Estoque mínimo (alerta)', type: 'number' },
    { k: 'qtdPacote', label: 'Qtd no pacote', type: 'number' }, { k: 'precoPacote', label: 'Preço do pacote (R$)', type: 'number' },
  ], i || { categoria: 'Filamento', unidade: 'g', estoque: 0, minimo: 0, qtdPacote: 1000, precoPacote: '' }, (v) => {
    if (i) Object.assign(i, v); else db.insumos.push({ id: uid(), ...v });
  });
}
function formCompra(i) {
  openForm(`Registrar compra — ${i.nome}`, [
    { k: 'data', label: 'Data', type: 'date', required: true },
    { k: 'pacotes', label: 'Qtd de pacotes comprados', type: 'number', required: true },
    { k: 'valor', label: 'Valor total pago (R$)', type: 'number', required: true },
    { k: 'forma', label: 'Forma de pagamento', type: 'select', options: [['', '—'], ...FORMAS.map((x) => [x, x])] },
  ], { data: hoje(), pacotes: 1, valor: i.precoPacote }, (v) => {
    if (v.pacotes <= 0) return;
    i.estoque = num(i.estoque) + v.pacotes * num(i.qtdPacote);
    i.precoPacote = +(v.valor / v.pacotes).toFixed(2);
    db.fluxo.push({ id: uid(), data: v.data, tipo: 'saida', categoria: 'Insumos', descricao: `Compra: ${i.nome} (${v.pacotes}x)`, forma: v.forma, valor: v.valor });
  });
}

/* ============ Precificação ============ */
const pv = { horas: 1, gramas: 10, horasModelagem: 0, margem: null, filId: '', embId: '', canal: 'Direta' };
function viewPreco() {
  const c = db.config; if (pv.margem === null) pv.margem = c.margem * 100;
  const fil = db.insumos.filter((i) => i.categoria === 'Filamento'), emb = db.insumos.filter((i) => i.categoria === 'Embalagem');
  const f = (id, label, val, step = 'any') => `<div class="field"><label>${label}</label><input id="${id}" type="number" step="${step}" value="${val}"></div>`;
  $('#view').innerHTML = `
    <h2>Precificação</h2>
    <div class="grid two">
      <div class="card"><h3>Peça / pedido</h3>
        <div class="fields">
          ${f('pv-horas', 'Horas de impressão', pv.horas)}${f('pv-gramas', 'Filamento gasto (g)', pv.gramas)}
          ${f('pv-hm', 'Horas de modelagem', pv.horasModelagem)}${f('pv-margem', 'Margem sobre o custo (%)', pv.margem)}
        </div>
        <div class="field"><label>Filamento (usa o preço/kg do insumo)</label><select id="pv-fil"><option value="">Padrão (parâmetros abaixo)</option>${fil.map((i) => `<option value="${i.id}" ${pv.filId === i.id ? 'selected' : ''}>${esc(i.nome)}</option>`).join('')}</select></div>
        <div class="field"><label>Embalagem</label><select id="pv-emb"><option value="">Padrão (parâmetros abaixo)</option>${emb.map((i) => `<option value="${i.id}" ${pv.embId === i.id ? 'selected' : ''}>${esc(i.nome)}</option>`).join('')}</select></div>
        <div class="field"><label>Canal para criar o pedido</label><select id="pv-canal">${['Direta', 'Shopee'].map((x) => `<option ${pv.canal === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <button class="btn" id="pv-pedido">Criar pedido com este preço</button>
      </div>
      <div class="card"><h3>Resultado</h3><div id="pv-res"></div></div>
    </div>
    <div class="card" style="margin-top:12px"><h3>Parâmetros (equivalem às células da sua planilha)</h3>
      <div class="fields">
        ${f('cf-potencia', 'Potência da impressora (W)', c.potencia)}${f('cf-tarifa', 'R$ por kWh', c.tarifa)}
        ${f('cf-impressora', 'Valor da impressora (R$)', c.impressora)}
        <div class="field"><label>Data da compra</label><input id="cf-dataCompra" type="date" value="${c.dataCompra}"></div>
        ${f('cf-depAno', 'Depreciação ao ano (0,2 = 20%)', c.depAno)}${f('cf-vidaUtil', 'Vida útil (h)', c.vidaUtil)}
        ${f('cf-filamentoPreco', 'Filamento: preço do rolo (R$)', c.filamentoPreco)}${f('cf-filamentoPeso', 'Filamento: peso do rolo (g)', c.filamentoPeso)}
        ${f('cf-valorHoraProjeto', 'Valor da hora de modelagem (R$)', c.valorHoraProjeto)}
        ${f('cf-colabMensal', 'Colaborador: pagamento mensal (R$)', c.colabMensal)}${f('cf-pecasMes', 'Peças por mês', c.pecasMes)}
        ${f('cf-embalagem', 'Embalagem padrão (R$)', c.embalagem)}${f('cf-frete', 'Uber / frete (R$)', c.frete)}
        ${f('cf-taxaShopee', 'Taxa Shopee (0,2 = 20%)', c.taxaShopee)}${f('cf-taxaFixaShopee', 'Taxa fixa por item Shopee (R$)', c.taxaFixaShopee)}
      </div><p class="note">As alterações são salvas automaticamente.</p></div>`;
  const read = () => {
    pv.horas = num($('#pv-horas').value); pv.gramas = num($('#pv-gramas').value); pv.horasModelagem = num($('#pv-hm').value);
    pv.margem = num($('#pv-margem').value); pv.filId = $('#pv-fil').value; pv.embId = $('#pv-emb').value; pv.canal = $('#pv-canal').value;
    Object.keys(db.config).forEach((k) => { const el = $('#cf-' + k); if (el) db.config[k] = el.type === 'date' ? el.value : num(el.value); });
    db.config.margem = pv.margem / 100;
    save(); resultadoPreco();
  };
  $$('#view input, #view select').forEach((el) => el.addEventListener('input', read));
  $('#pv-pedido').onclick = () => {
    const r = calcAtual();
    state.tab = 'pedidos'; $$('#nav button').forEach((x) => x.classList.toggle('active', x.dataset.tab === 'pedidos')); render();
    formPedido(null, { descricao: '', qtd: 1, valor: +(pv.canal === 'Shopee' ? r.shopee : r.direta).toFixed(2), custo: +r.total.toFixed(2), horas: pv.horas, gramas: pv.gramas, filamentoId: pv.filId, canal: pv.canal });
  };
  resultadoPreco();
}
function calcAtual() {
  const fil = db.insumos.find((i) => i.id === pv.filId), emb = db.insumos.find((i) => i.id === pv.embId);
  return Calc.calcPreco({
    horas: pv.horas, gramas: pv.gramas, horasModelagem: pv.horasModelagem, margem: pv.margem / 100,
    filamentoPreco: fil ? (custoUnit(fil) * num(db.config.filamentoPeso)) : null,
    embalagem: emb ? custoUnit(emb) : null,
  }, db.config);
}
function resultadoPreco() {
  const r = calcAtual();
  const row = (l, v) => `<tr><td>${l}</td><td>${brl(v)}</td></tr>`;
  $('#pv-res').innerHTML = `<table class="breakdown">
    ${row('Energia', r.energia)}${row('Depreciação da impressora', r.depreciacao)}${row('Filamento', r.filamento)}${row('Modelagem', r.modelagem)}
    ${row('Manutenção', r.manutencao)}${row('Colaborador', r.colaborador)}${row('Embalagem + envio', r.embalagemEnvio)}
    <tr class="total"><td>Custo total da peça</td><td>${brl(r.total)}</td></tr></table>
    <div class="grid kpis" style="margin-top:12px;grid-template-columns:1fr 1fr">
      <div class="card kpi"><div class="l">Preço venda direta</div><div class="v big">${brl(r.direta)}</div><div class="note">Lucro: ${brl(r.lucro)}</div></div>
      <div class="card kpi"><div class="l">Preço na Shopee</div><div class="v big">${brl(r.shopee)}</div><div class="note">Taxas já embutidas</div></div></div>
    <p class="note">Depreciação calculada com o valor atual da impressora (${brl(r.valorHoje)}).</p>`;
}

/* ============ Dados / backup ============ */
function viewConfig() {
  $('#view').innerHTML = `
    <h2>Dados e backup</h2>
    <div class="card"><p>Os dados ficam salvos <b>no navegador deste dispositivo</b> (não vão para o GitHub). Faça backup com frequência e use “Importar” para levar para outro aparelho.</p>
      <div class="row">
        <button class="btn" data-act="exp-json">⬇ Exportar backup (JSON)</button>
        <label class="btn sec" style="margin:0;cursor:pointer">⬆ Importar backup<input type="file" id="imp" accept="application/json" hidden></label>
        <button class="btn sec" data-act="exp-pedidos">CSV de pedidos</button>
        <button class="btn sec" data-act="exp-fluxo">CSV do fluxo de caixa</button>
        <button class="btn danger" data-act="reset">Apagar tudo</button>
      </div></div>`;
  $('#imp').onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    file.text().then((t) => { try { const d = JSON.parse(t); if (!d.config || !d.pedidos) throw 0; if (confirm('Substituir todos os dados atuais pelo backup?')) { db = d; save(); alert('Backup importado.'); render(); } } catch { alert('Arquivo inválido.'); } });
  };
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function csv(rows) { return '\ufeff' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n'); }

/* ============ Ações (delegação de eventos) ============ */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.dataset.id, act = b.dataset.act;
  const by = (arr) => arr.find((x) => x.id === id);
  const ok = (m) => confirm(m);
  switch (act) {
    case 'novo-fluxo': formFluxo(null, b.dataset.tipo); break;
    case 'edit-fluxo': formFluxo(by(db.fluxo)); break;
    case 'del-fluxo': if (ok('Excluir lançamento?')) { const f = by(db.fluxo); db.pedidos.forEach((p) => { if (p.fluxoId === f.id) { p.fluxoId = null; p.pago = false; } }); db.fluxo = db.fluxo.filter((x) => x.id !== id); save(); render(); } break;
    case 'novo-cliente': formCliente(); break;
    case 'edit-cliente': formCliente(by(db.clientes)); break;
    case 'del-cliente': if (ok('Excluir cliente? Os pedidos dele ficarão sem cliente.')) { db.clientes = db.clientes.filter((x) => x.id !== id); db.pedidos.forEach((p) => { if (p.clienteId === id) p.clienteId = ''; }); save(); render(); } break;
    case 'novo-pedido': formPedido(); break;
    case 'edit-pedido': formPedido(by(db.pedidos)); break;
    case 'del-pedido': if (ok('Excluir pedido? O lançamento de pagamento e a baixa de estoque dele serão desfeitos.')) { delPedido(by(db.pedidos)); save(); render(); } break;
    case 'toggle-pago': { const p = by(db.pedidos); p.pago = !p.pago; if (p.pago) p.dataPagamento = hoje(); efeitosPedido(p); save(); render(); break; }
    case 'novo-insumo': formInsumo(); break;
    case 'edit-insumo': formInsumo(by(db.insumos)); break;
    case 'compra-insumo': formCompra(by(db.insumos)); break;
    case 'del-insumo': if (ok('Excluir insumo?')) { db.insumos = db.insumos.filter((x) => x.id !== id); save(); render(); } break;
    case 'exp-json': download(`gestao3d-backup-${hoje()}.json`, JSON.stringify(db, null, 2), 'application/json'); break;
    case 'exp-pedidos': download('pedidos.csv', csv([['#', 'Data', 'Cliente', 'Descrição', 'Qtd', 'Valor', 'Custo', 'Horas', 'Gramas', 'Canal', 'Status', 'Pago']].concat(db.pedidos.map((p) => [p.num, p.data, nomeCliente(p.clienteId), p.descricao, p.qtd, p.valor, p.custo, p.horas, p.gramas, p.canal, p.status, p.pago ? 'Sim' : 'Não']))), 'text/csv'); break;
    case 'exp-fluxo': download('fluxo-de-caixa.csv', csv([['Data', 'Tipo', 'Categoria', 'Descrição', 'Forma', 'Valor']].concat(db.fluxo.map((f) => [f.data, f.tipo, f.categoria, f.descricao, f.forma, f.valor]))), 'text/csv'); break;
    case 'reset': if (ok('Apagar TODOS os dados deste navegador? Isso não pode ser desfeito.')) { db = seed(); save(); render(); } break;
  }
});
document.addEventListener('change', (e) => {
  const id = e.target.dataset?.st; if (!id) return;
  const p = db.pedidos.find((x) => x.id === id); p.status = e.target.value; efeitosPedido(p); save(); render();
});

render();
})();
