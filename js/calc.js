/* Cálculo de precificação — replica a lógica da PLANILHA_DE_PRECIFICAÇÃO */
(function (root) {
  function diasDesde(dataISO, hoje) {
    const d = new Date(dataISO + 'T00:00:00');
    const h = hoje || new Date();
    return Math.max(0, (h - d) / 86400000);
  }

  /**
   * cfg: potencia(W), tarifa(R$/kWh), impressora(R$), dataCompra(YYYY-MM-DD), depAno(0.2),
   *      vidaUtil(h), filamentoPreco(R$/kg), filamentoPeso(g), colabMensal, pecasMes,
   *      valorHoraProjeto, embalagem, frete, taxaShopee(0.2), taxaFixaShopee
   * p:   horas, gramas, horasModelagem, margem (1 = 100%), embalagem?, frete?, filamentoPreco?
   */
  function calcPreco(p, cfg, hoje) {
    const n = (v) => (isFinite(+v) ? +v : 0);
    const horas = n(p.horas), gramas = n(p.gramas);
    const kw = n(cfg.potencia) / 1000;
    const energia = horas * kw * n(cfg.tarifa);

    const valorHoje = Math.max(
      0,
      n(cfg.impressora) - (n(cfg.depAno) / 365) * diasDesde(cfg.dataCompra, hoje) * n(cfg.impressora)
    );
    const depreciacao = n(cfg.vidaUtil) ? (valorHoje / n(cfg.vidaUtil)) * horas : 0;

    const precoKg = p.filamentoPreco != null && p.filamentoPreco !== '' ? n(p.filamentoPreco) : n(cfg.filamentoPreco);
    const filamento = n(cfg.filamentoPeso) ? (precoKg / n(cfg.filamentoPeso)) * gramas : 0;

    const modelagem = n(cfg.valorHoraProjeto) * n(p.horasModelagem);
    const manutencao = n(cfg.vidaUtil) ? (n(cfg.impressora) / n(cfg.vidaUtil)) * horas : 0;
    const colaborador = n(cfg.pecasMes) ? n(cfg.colabMensal) / n(cfg.pecasMes) : 0;
    const embalagemEnvio = (p.embalagem != null && p.embalagem !== '' ? n(p.embalagem) : n(cfg.embalagem)) +
      (p.frete != null && p.frete !== '' ? n(p.frete) : n(cfg.frete));

    const total = energia + depreciacao + filamento + modelagem + manutencao + colaborador + embalagemEnvio;
    const margem = n(p.margem);
    const direta = total * margem + total;
    const lucro = direta - total;
    const shopee = direta * n(cfg.taxaShopee) + direta + n(cfg.taxaFixaShopee);

    return {
      energia, depreciacao, filamento, modelagem, manutencao, colaborador, embalagemEnvio,
      total, direta, lucro, shopee, valorHoje,
      lucroShopee: direta - total,
    };
  }

  const api = { calcPreco, diasDesde };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
