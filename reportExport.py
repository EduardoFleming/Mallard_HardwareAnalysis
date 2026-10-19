"""Relatório de uma análise em HTML, para salvar, imprimir ou mandar para alguém."""

import html
from datetime import datetime

LEVELS = ("Ovo", "Patinho", "Pato", "Pato-real", "Cisne")
PRIORITY = {"alta": "Alta", "média": "Média", "media": "Média", "baixa": "Baixa"}


def _e(value):
    return html.escape(str(value or ""))


def _list(items):
    items = [item for item in items or [] if str(item).strip()]
    if not items:
        return ""
    return "<ul>" + "".join(f"<li>{_e(item)}</li>" for item in items) + "</ul>"


def buildReportHtml(entry):
    result = entry.get("resultado", {})
    prefs = entry.get("preferencias", {})
    date = datetime.fromisoformat(entry["data"]).strftime("%d/%m/%Y às %H:%M") if entry.get("data") else ""
    focus = prefs.get("foco_de_jogos") or prefs.get("foco_de_trabalho_ou_uso_domestico") or ""
    budget = prefs.get("orcamento") or "sem limite informado"
    parts = entry.get("pecas", {})
    recs = ""
    for index, rec in enumerate(result.get("recommendations", []), start=1):
        link = f'<p><a href="{_e(rec.get("search_url"))}">Pesquisar preço</a></p>' if rec.get("search_url") else ""
        recs += f"""
        <section class="rec">
          <p class="tag">{index:02d} · Prioridade {_e(PRIORITY.get(str(rec.get("priority", "")).lower(), rec.get("priority", "")))} · Compatibilidade {_e(rec.get("compatibility"))}</p>
          <h3>{_e(rec.get("component"))}: {_e(rec.get("current"))} → {_e(rec.get("suggestion"))}</h3>
          <p>{_e(rec.get("reason"))}</p>
          {"<p><strong>Antes de comprar:</strong></p>" + _list(rec.get("verify_before_buying")) if rec.get("verify_before_buying") else ""}
          {link}
        </section>"""
    return f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Mallard · Relatório de {_e(date)}</title>
<style>
  body {{ font-family: "Segoe UI", system-ui, sans-serif; color: #1C1B18; max-width: 760px; margin: 32px auto; padding: 0 24px; line-height: 1.5; }}
  h1 {{ margin: 0 0 4px; font-size: 28px; }} h2 {{ margin: 28px 0 8px; font-size: 18px; }} h3 {{ margin: 6px 0; font-size: 16px; }}
  .sub {{ color: #57534A; margin: 0; }} .tag {{ font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #57534A; margin: 0; }}
  .box {{ border: 1px solid #DDD6C8; border-radius: 8px; padding: 14px 18px; margin-top: 12px; }}
  .rec {{ border-top: 1px solid #E6E0D4; padding-top: 12px; margin-top: 12px; }}
  a {{ color: #A84A0A; }} footer {{ margin-top: 32px; font-size: 12px; color: #68645A; }}
</style></head><body>
<p class="tag">Mallard · especialista em PATOlogia de PC</p>
<h1>Resultado da análise</h1>
<p class="sub">{_e(date)} · {_e(entry.get("perfil"))}{" · " + _e(focus) if focus else ""} · Orçamento: {_e(budget)}</p>
<div class="box"><h2 style="margin-top:0">Veredito</h2><p>{_e(result.get("verdict"))}</p>{_list(result.get("quick_summary"))}
<p><strong>Gargalo principal:</strong> {_e(result.get("main_bottleneck") or "nenhum claro com os dados atuais")} ·
<strong>Nível do PC:</strong> {_e(LEVELS[result.get("level_now", 1)])} → {_e(LEVELS[result.get("level_after", 1)])} depois dos upgrades</p>
{f'<p><strong>Orçamento:</strong> {_e(result.get("budget_message"))}</p>' if result.get("budget_message") else ""}</div>
<h2>Upgrades recomendados</h2>{recs or "<p>Nenhum upgrade recomendado agora.</p>"}
<h2>Análise completa</h2>{_list(result.get("analysis"))}
{"<h2>Para uma análise mais precisa</h2>" + _list(result.get("missing_information")) if result.get("missing_information") else ""}
<h2>Peças no momento da análise</h2>
<ul><li>Processador: {_e(parts.get("processador"))}</li><li>Placa de vídeo: {_e(parts.get("placas_de_video"))}</li>
<li>Placa-mãe: {_e(parts.get("placa_mae"))}</li><li>Memória: {_e(parts.get("memoria_total_gb"))} GB</li></ul>
<footer>Preços não são cotações: os links abrem uma pesquisa. Gerado pelo Mallard.</footer>
</body></html>"""
