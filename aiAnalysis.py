"""Cliente Gemini e validação do diagnóstico do Mallard."""

import json
import re
from urllib.parse import quote_plus

from google import genai
from google.genai import errors as genai_errors
from google.genai import types


MODEL = "gemini-3.5-flash-lite"
GEMINI_MODEL = MODEL
LEVELS = ("Ovo", "Patinho", "Pato", "Pato-real", "Cisne")


class AnalysisError(Exception):
    def __init__(self, code, message, retry_seconds=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retry_seconds = retry_seconds


def _retry_seconds(error):
    details = getattr(error, "details", None)
    text = (json.dumps(details, ensure_ascii=False) if details else "") + " " + str(error)
    match = re.search(r'"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"', text)
    if match:
        return max(1, round(float(match.group(1))))
    match = re.search(r"retry in (?:(\d+)h)?(?:(\d+)m)?(\d+(?:\.\d+)?)s", text, re.IGNORECASE)
    if match:
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = float(match.group(3))
        return max(1, round(hours * 3600 + minutes * 60 + seconds))
    match = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", text, re.IGNORECASE)
    return max(1, int(match.group(1))) if match else None


def format_wait(seconds):
    hours, remainder = divmod(int(seconds), 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours} h e {minutes} min" if minutes else f"{hours} h"
    if minutes:
        return f"{minutes} min e {seconds} s" if seconds else f"{minutes} min"
    return f"{seconds} s"


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


def _as_level(value, default):
    try:
        return max(0, min(4, int(value)))
    except (TypeError, ValueError):
        return default


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
    data.setdefault("confidence", "média")
    if data["budget_status"] not in {"within_budget", "no_worthwhile_upgrade", "unknown"}:
        data["budget_status"] = "unknown"
    data["recommendations"] = data["recommendations"][:3]
    for field in ("analysis", "bottlenecks", "missing_information", "quick_summary"):
        value = data.get(field, [])
        if isinstance(value, str):
            data[field] = [value] if value.strip() else []
        elif isinstance(value, list):
            data[field] = [str(item) for item in value if str(item).strip()]
        else:
            data[field] = []
    for recommendation in data["recommendations"]:
        if not isinstance(recommendation, dict):
            raise ValueError("Uma recomendação retornada pela IA está em formato inválido.")
        for field in ("component", "current", "suggestion", "reason", "compatibility", "search_query", "priority"):
            recommendation.setdefault(field, "")
        checks = recommendation.get("verify_before_buying", [])
        if isinstance(checks, str):
            recommendation["verify_before_buying"] = [checks]
        elif not isinstance(checks, list):
            recommendation["verify_before_buying"] = []
        recommendation["search_url"] = get_search_url(recommendation["search_query"]) if recommendation["search_query"] else ""
    data["level_now"] = _as_level(data.get("level_now"), 1)
    data["level_after"] = max(data["level_now"], _as_level(data.get("level_after"), data["level_now"]))
    bottleneck = data.get("main_bottleneck")
    data["main_bottleneck"] = bottleneck.strip() if isinstance(bottleneck, str) and bottleneck.strip() else None
    return data


def _build_prompt(hardware, profile, preferences):
    return f"""
Você é um consultor técnico de upgrades de computadores. Explique suas conclusões em
português simples para uma pessoa que não entende muito de hardware.

HARDWARE DETECTADO:
{json.dumps(hardware, ensure_ascii=False, indent=2)}

PERFIL E PREFERÊNCIAS:
{json.dumps({"perfil": profile, **preferences}, ensure_ascii=False, indent=2)}

REGRAS:
- Não invente soquete, chipset, BIOS, tipo de RAM, potência da fonte, preço atual ou desempenho medido.
- Campos opcionais null devem ser ignorados.
- Para jogos competitivos leves como LoL, não recomende peças para AAA/4K sem pedido explícito.
- Em notebook, recomende somente RAM/SSD e, se não resolverem, explique que pode ser necessário trocar o notebook.
- Em notebook, nunca recomende trocar processador, placa de vídeo, placa-mãe ou fonte; na RAM, peça para conferir memória soldada e slots livres.
- Se a placa-mãe não estiver identificada ou for OEM, não declare compatibilidade de CPU/RAM sem confirmação.
- Respeite o orçamento; se não couber upgrade útil, diga isso e não ultrapasse o limite.
- Não há busca de preços ao vivo: retorne apenas termos de pesquisa. Link de pesquisa não é cotação.
- Recomende no máximo três upgrades. Se nenhum fizer sentido, retorne lista vazia.
- levels: 0=Ovo (dados insuficientes), 1=Patinho, 2=Pato, 3=Pato-real, 4=Cisne.
- Retorne apenas JSON válido:
{{
 "verdict":"resumo curto", "quick_summary":["frase simples"], "confidence":"alta/média/baixa",
 "level_now":1, "level_after":2, "main_bottleneck":"nome ou null",
 "budget_status":"within_budget/no_worthwhile_upgrade/unknown", "budget_message":"explicação",
 "analysis":["observação"], "bottlenecks":["gargalo ou nenhum"],
 "recommendations":[{{"component":"peça", "current":"atual", "suggestion":"recomendação",
 "priority":"alta/média/baixa", "reason":"motivo", "compatibility":"confirmada/parcial/não confirmada",
 "verify_before_buying":["conferência"], "search_query":"termos de busca"}}],
 "missing_information":["dado faltante"]
}}
"""


def _classify_error(error):
    if isinstance(error, AnalysisError):
        return error
    if isinstance(error, genai_errors.APIError):
        code = getattr(error, "code", None) or 0
        status = str(getattr(error, "status", "") or "").upper()
        message = str(getattr(error, "message", "") or "")
        lowered = message.lower()
        if code in (401, 403) or "api key" in lowered or "api_key" in lowered or status in {"UNAUTHENTICATED", "PERMISSION_DENIED"}:
            return AnalysisError("chave_invalida", "O Gemini recusou a chave informada.")
        if code == 429 or status == "RESOURCE_EXHAUSTED" or "quota" in lowered:
            wait = _retry_seconds(error)
            if wait:
                return AnalysisError("limite", f"O Gemini pediu para esperar pelo menos {format_wait(wait)} antes de tentar de novo.", wait)
            return AnalysisError("limite", "A cota deste projeto ou modelo no Gemini foi atingida. Espere a cota renovar no AI Studio.")
        if code >= 500 or status == "UNAVAILABLE" or "overloaded" in lowered:
            return AnalysisError("servico_indisponivel", "O Gemini está fora do ar ou sobrecarregado.")
        return AnalysisError("desconhecido", f"O Gemini recusou o pedido ({code}). {message}".strip())
    name = type(error).__name__.lower()
    module = type(error).__module__.lower()
    code = getattr(error, "code", 0) or 0
    status = str(getattr(error, "status", "") or "").upper()
    message = str(getattr(error, "message", "") or error)
    lowered = message.lower()
    if code in (401, 403) or "api key" in lowered or "api_key" in lowered or status in {"UNAUTHENTICATED", "PERMISSION_DENIED"}:
        return AnalysisError("chave_invalida", "O Gemini recusou a chave informada.")
    if code == 429 or status == "RESOURCE_EXHAUSTED" or "quota" in lowered or "rate limit" in lowered:
        wait = _retry_seconds(error)
        if wait:
            return AnalysisError("limite", f"O Gemini pediu para esperar pelo menos {format_wait(wait)} antes de tentar de novo.", wait)
        return AnalysisError("limite", "A cota deste projeto ou modelo no Gemini foi atingida. Espere a cota renovar no AI Studio.")
    if code >= 500 or status == "UNAVAILABLE" or "overloaded" in lowered:
        return AnalysisError("servico_indisponivel", "O Gemini está fora do ar ou sobrecarregado.")
    if "httpx" in module or "connect" in name or "timeout" in name or isinstance(error, (ConnectionError, TimeoutError, OSError)):
        return AnalysisError("sem_conexao", "Não foi possível conectar ao Gemini. Confira sua internet e tente novamente.")
    if isinstance(error, (ValueError, json.JSONDecodeError)):
        return AnalysisError("resposta_invalida", str(error))
    return AnalysisError("desconhecido", message)


def _single_attempt_http_options():
    retry_options = getattr(types, "HttpRetryOptions", None)
    return types.HttpOptions(retry_options=retry_options(attempts=1)) if retry_options else None


def consultar_gemini(api_key, hardware, perfil, preferencias):
    if not api_key:
        raise AnalysisError("sem_chave", "Informe a chave do Gemini para pedir a análise.")
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=MODEL,
            contents=_build_prompt(hardware, perfil, preferencias or {}),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                http_options=_single_attempt_http_options(),
            ),
        )
        if not getattr(response, "text", None):
            raise ValueError("O Gemini não retornou conteúdo. Tente novamente.")
        return _validate_analysis(_extract_json(response.text))
    except Exception as error:
        raise _classify_error(error) from error


def consultar_requisitos(api_key, name):
    if not api_key:
        raise AnalysisError("sem_chave", "Informe a chave do Gemini para pesquisar esse título.")
    prompt = f"""
Você ajuda a decidir se um jogo ou programa roda em um computador. Informe requisitos de
referência de "{str(name or '')[:80]}" para Windows. Se não conhecer o título, responda found=false.
Não invente números. Níveis CPU: 0=2 núcleos, 1=4, 2=6, 3=8 ou mais.
Níveis GPU: 0=integrada, 1=entrada, 2=intermediária, 3=alta.
Responda só com JSON:
{{"found":true,"name":"nome oficial","kind":"tipo curto","noun":"jogo ou programa",
"ram_min_gb":8,"ram_rec_gb":16,"cpu_min_tier":1,"cpu_rec_tier":2,
"cpu_text":"processador","gpu_min_tier":1,"gpu_rec_tier":2,"gpu_text":"placa de vídeo","disk_gb":50}}
"""
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                http_options=_single_attempt_http_options(),
            ),
        )
        if not getattr(response, "text", None):
            raise ValueError("A IA não retornou conteúdo. Tente novamente.")
        data = _extract_json(response.text)
        if not isinstance(data, dict) or not data.get("found"):
            return None
        result = {
            "name": str(data["name"]).strip()[:60],
            "kind": str(data.get("kind") or "Jogo ou programa")[:40],
            "noun": "jogo" if str(data.get("noun", "")).lower().startswith("jog") else "programa",
            "ram_min_gb": float(data["ram_min_gb"]), "ram_rec_gb": float(data["ram_rec_gb"]),
            "cpu_min_tier": int(data["cpu_min_tier"]), "cpu_rec_tier": int(data["cpu_rec_tier"]),
            "gpu_min_tier": int(data["gpu_min_tier"]), "gpu_rec_tier": int(data["gpu_rec_tier"]),
            "cpu_text": str(data.get("cpu_text") or "")[:80], "gpu_text": str(data.get("gpu_text") or "")[:80],
            "disk_gb": float(data["disk_gb"]),
        }
        if not result["name"] or result["ram_min_gb"] <= 0 or result["ram_min_gb"] > 128 or result["disk_gb"] < 0 or result["disk_gb"] > 2000:
            raise ValueError("Os requisitos devolvidos pela IA não parecem válidos.")
        result["ram_rec_gb"] = max(result["ram_rec_gb"], result["ram_min_gb"])
        for field in ("cpu_min_tier", "cpu_rec_tier", "gpu_min_tier", "gpu_rec_tier"):
            result[field] = max(0, min(3, result[field]))
        result["cpu_rec_tier"] = max(result["cpu_rec_tier"], result["cpu_min_tier"])
        result["gpu_rec_tier"] = max(result["gpu_rec_tier"], result["gpu_min_tier"])
        return result
    except Exception as error:
        raise _classify_error(error) from error


def get_search_url(query):
    return f"https://www.google.com/search?tbm=shop&q={quote_plus(query)}"
