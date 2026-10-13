import json
import re
from urllib.parse import quote_plus

import google.generativeai as genai


GEMINI_MODEL = "gemini-3.5-flash-lite"


def _extract_json(text):
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise ValueError("A IA retornou uma resposta fora do formato JSON esperado.")
        return json.loads(match.group(0))


def _validate_analysis(data):
    if not isinstance(data, dict):
        raise ValueError("A resposta da IA não contém um objeto JSON.")
    required = ("verdict", "analysis", "bottlenecks", "recommendations", "missing_information")
    missing = [field for field in required if field not in data]
    if missing:
        raise ValueError(f"A resposta da IA não contém os campos: {', '.join(missing)}.")
    if not isinstance(data["recommendations"], list):
        raise ValueError("A lista de recomendações retornada pela IA é inválida.")
    data.setdefault("budget_status", "unknown")
    data.setdefault("budget_message", "")
    if data["budget_status"] not in {"within_budget", "no_worthwhile_upgrade", "unknown"}:
        data["budget_status"] = "unknown"
    if len(data["recommendations"]) > 3:
        data["recommendations"] = data["recommendations"][:3]
    for field in ("analysis", "bottlenecks", "missing_information"):
        value = data[field]
        if isinstance(value, str):
            data[field] = [value]
        elif not isinstance(value, list):
            raise ValueError(f"O campo '{field}' retornado pela IA é inválido.")
    for recommendation in data["recommendations"]:
        if not isinstance(recommendation, dict):
            raise ValueError("Uma recomendação retornada pela IA está em formato inválido.")
        for field in ("component", "suggestion", "reason", "compatibility", "search_query"):
            recommendation.setdefault(field, "")
        checks = recommendation.get("verify_before_buying", [])
        if isinstance(checks, str):
            recommendation["verify_before_buying"] = [checks]
        elif not isinstance(checks, list):
            recommendation["verify_before_buying"] = []
    return data


def consultar_gemini(api_key, hardware, perfil, preferencias):
    """Gera um diagnóstico estruturado. Não consulta preços em tempo real."""
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(GEMINI_MODEL)

    prompt = f"""
Você é um consultor técnico de upgrades de computadores. Analise o hardware e o perfil
informados. Priorize compatibilidade, custo-benefício e explicações honestas.

DADOS DETECTADOS (podem conter campos não identificados):
{json.dumps(hardware, ensure_ascii=False, indent=2)}

PERFIL E PREFERÊNCIAS:
{json.dumps({"perfil": perfil, **preferencias}, ensure_ascii=False, indent=2)}

REGRAS:
- Não invente soquete, chipset, versão de BIOS, tipo de RAM, potência da fonte,
  dimensões do gabinete, preço atual ou desempenho medido.
- Considere gargalo apenas quando os dados e o perfil sustentarem essa conclusão.
- Se faltar dado para confirmar compatibilidade, diga exatamente o que precisa ser
  verificado antes da compra e reduza a confiança da recomendação.
- Se uma placa-mãe for OEM/proprietária ou não estiver identificada, não indique
  troca de CPU/RAM como compatível sem confirmação do modelo e da plataforma.
- As respostas opcionais podem ser null: ignore esses campos e não trate ausência como erro.
- Leve o filtro de perfil a sério. Para jogos competitivos leves (por exemplo, LoL),
  não recomende peças para AAA/4K, a menos que o usuário peça isso explicitamente.
- Respeite rigorosamente o orçamento. Se ele for insuficiente para um upgrade
  compatível que traga melhora relevante, NÃO recomende gastar acima dele: explique
  claramente que não há upgrade que valha a pena nesse limite. Quando possível, indique
  uma alternativa usada/de entrada ou uma melhoria gratuita/adiamento, mas sem inventar
  preços. Se nem uma alternativa fizer sentido, diga isso sem forçar uma compra.
- Classifique budget_status como "within_budget" quando houver sugestão plausível no
  limite informado, "no_worthwhile_upgrade" quando o orçamento não comportar uma
  melhoria confiável, ou "unknown" quando não houver orçamento informado.
- Se não houver orçamento informado, não presuma um limite nem alegue que algo cabe nele.
- Preços não são consultados em tempo real. Para cada recomendação, retorne termos
  de pesquisa, que serão transformados em links de busca e não em cotações.
- Recomende no máximo três upgrades e ordene por prioridade.
- Responda somente com JSON válido, sem Markdown, neste formato:
{{
  "verdict": "resumo curto",
  "confidence": "alta, média ou baixa",
  "budget_status": "within_budget/no_worthwhile_upgrade/unknown",
  "budget_message": "explicação amigável do que o orçamento permite",
  "analysis": ["observação técnica"],
  "bottlenecks": ["gargalo comprovado ou Nenhum identificado com os dados atuais"],
  "recommendations": [
    {{"component": "componente", "current": "peça atual", "suggestion": "peça sugerida",
      "priority": "alta/média/baixa", "reason": "justificativa ligada ao perfil",
      "compatibility": "confirmada/parcial/não confirmada", "verify_before_buying": ["verificação"],
      "search_query": "termos para pesquisar"}}
  ],
  "missing_information": ["informação que faria a análise mais precisa"]
}}
"""

    response = model.generate_content(
        prompt,
        generation_config={"response_mime_type": "application/json", "temperature": 0.2},
        # Não repetir automaticamente chamadas com falha: uma tentativa manual do
        # usuário deve corresponder a, no máximo, uma solicitação à API.
        request_options={"retry": None},
    )
    if not getattr(response, "text", None):
        raise ValueError("A IA não retornou conteúdo. Tente novamente ou revise a chave/API.")
    return _validate_analysis(_extract_json(response.text))


def get_search_url(query):
    return f"https://www.google.com/search?tbm=shop&q={quote_plus(query)}"
