"""Limpeza do disco (aba Limpeza): mostra o que dá para jogar fora e limpa o que o usuário marcar.

Regras de segurança:
- só mexe nestas cinco categorias, em pastas conhecidas;
- arquivos com menos de 24 h (temporários) ficam, e arquivos em uso são pulados;
- nunca segue atalhos/links de pasta para fora da pasta limpa;
- Downloads antigos NÃO são apagados: vão para a Lixeira, de onde dá para recuperar;
- tudo isso só funciona no Windows. Em outros sistemas a aba mostra um aviso.
"""

import ctypes
import os
import platform
import shutil
import stat
import threading
import time
from pathlib import Path

import psutil

DAY = 86400
OLD_DOWNLOAD_DAYS = 90

CATEGORIES = [
    {"key": "tmp", "name": "Arquivos temporários", "desc": "Sobras de instalações. Os das últimas 24 h ficam.", "review": False},
    {"key": "upd", "name": "Restos de atualizações", "desc": "Instaladores de atualizações já aplicadas.", "review": False},
    {"key": "cache", "name": "Cache dos navegadores", "desc": "Chrome, Edge e Brave recriam sozinhos.", "review": False},
    {"key": "bin", "name": "Lixeira", "desc": "Arquivos que você já apagou antes.", "review": False},
    {"key": "dl", "name": "Downloads com mais de 90 dias", "desc": "Vão para a Lixeira: dá para recuperar.", "review": True},
]

_job = {"phase": "idle", "progress": 0, "current": "", "freed": 0, "per_key": {}, "error": None}
_job_lock = threading.Lock()


def isSupported():
    return platform.system() == "Windows"


# ---------------------------------------------------------------------------
# Pastas de cada categoria (separado para poder testar com pastas falsas)
# ---------------------------------------------------------------------------
def _roots():
    local = os.environ.get("LOCALAPPDATA", "")
    temp = os.environ.get("TEMP") or os.environ.get("TMP") or ""
    windir = os.environ.get("SystemRoot", r"C:\Windows")
    cache = []
    for browser in (r"Google\Chrome", r"Microsoft\Edge", r"BraveSoftware\Brave-Browser"):
        base = Path(local) / browser / "User Data"
        if base.is_dir():
            for profile in base.iterdir():
                if profile.name == "Default" or profile.name.startswith("Profile "):
                    for sub in (r"Cache\Cache_Data", "Code Cache", "GPUCache"):
                        folder = profile / sub
                        if folder.is_dir():
                            cache.append(str(folder))
    return {
        "tmp": [temp] if temp else [],
        "upd": [str(Path(windir) / "SoftwareDistribution" / "Download")],
        "cache": cache,
        "dl": [str(Path.home() / "Downloads")],
    }


def _is_link(path, info=None):
    try:
        info = info or os.lstat(path)
    except OSError:
        return True
    if stat.S_ISLNK(info.st_mode):
        return True
    return bool(getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))


def _walk_files(root, min_age=0, now=None):
    """Gera (caminho, tamanho) dos arquivos abaixo de root, sem seguir links e só dos mais velhos que min_age."""
    now = now or time.time()
    if not root or not os.path.isdir(root):
        return
    for folder, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = [d for d in dirs if not _is_link(os.path.join(folder, d))]
        for name in files:
            path = os.path.join(folder, name)
            try:
                info = os.lstat(path)
            except OSError:
                continue
            if _is_link(path, info):
                continue
            if min_age and now - info.st_mtime < min_age:
                continue
            yield path, info.st_size


def _entry_size(path):
    try:
        if os.path.isdir(path) and not _is_link(path):
            return sum(size for _, size in _walk_files(path)), sum(1 for _ in _walk_files(path))
        return os.lstat(path).st_size, 1
    except OSError:
        return 0, 0


def _old_downloads(root, now=None):
    """Itens do primeiro nível de Downloads com mais de 90 dias (a data é a do próprio item)."""
    now = now or time.time()
    result = []
    if not root or not os.path.isdir(root):
        return result
    for entry in os.scandir(root):
        try:
            if now - entry.stat(follow_symlinks=False).st_mtime >= OLD_DOWNLOAD_DAYS * DAY and not _is_link(entry.path):
                result.append(entry.path)
        except OSError:
            continue
    return result


# ---------------------------------------------------------------------------
# Lixeira do Windows
# ---------------------------------------------------------------------------
class _RecycleInfo(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_ulong), ("i64Size", ctypes.c_longlong), ("i64NumItems", ctypes.c_longlong)]


def _recycle_bin_size():
    if not isSupported():
        return 0, 0
    info = _RecycleInfo()
    info.cbSize = ctypes.sizeof(info)
    try:
        if ctypes.windll.shell32.SHQueryRecycleBinW(None, ctypes.byref(info)) == 0:
            return info.i64Size, info.i64NumItems
    except (OSError, AttributeError):
        pass
    return 0, 0


def _empty_recycle_bin():
    # 1 = sem confirmação, 2 = sem barra de progresso, 4 = sem som
    ctypes.windll.shell32.SHEmptyRecycleBinW(None, None, 1 | 2 | 4)


class _FileOp(ctypes.Structure):
    _fields_ = [("hwnd", ctypes.c_void_p), ("wFunc", ctypes.c_uint), ("pFrom", ctypes.c_wchar_p), ("pTo", ctypes.c_wchar_p),
                ("fFlags", ctypes.c_ushort), ("fAnyOperationsAborted", ctypes.c_int), ("hNameMappings", ctypes.c_void_p),
                ("lpszProgressTitle", ctypes.c_wchar_p)]


def _send_to_trash(path):
    """Move um item para a Lixeira (recuperável). Devolve True se o Windows aceitou."""
    op = _FileOp()
    op.wFunc = 3  # FO_DELETE
    op.pFrom = path + "\0\0"
    op.fFlags = 0x0040 | 0x0010 | 0x0004 | 0x0400  # ALLOWUNDO | NOCONFIRMATION | SILENT | NOERRORUI
    return ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op)) == 0 and not op.fAnyOperationsAborted


# ---------------------------------------------------------------------------
# Procurar e limpar
# ---------------------------------------------------------------------------
def _measure(key, roots, now=None):
    """Tamanho em bytes e número de arquivos de uma categoria."""
    if key == "bin":
        return _recycle_bin_size()
    if key == "dl":
        total = files = 0
        for root in roots.get("dl", []):
            for item in _old_downloads(root, now):
                size, count = _entry_size(item)
                total += size
                files += count
        return total, files
    age = DAY if key == "tmp" else 0
    total = files = 0
    for root in roots.get(key, []):
        for _, size in _walk_files(root, age, now):
            total += size
            files += 1
    return total, files


def scan():
    """Procura o que dá para limpar. Só lê, não apaga nada."""
    if not isSupported():
        return {"supported": False, "categories": [], "disk": None}
    roots = _roots()
    categories = []
    for category in CATEGORIES:
        size, files = _measure(category["key"], roots)
        categories.append({**category, "bytes": int(size), "files": int(files)})
    return {"supported": True, "categories": categories, "disk": _disk()}


def _disk():
    drive = os.environ.get("SystemDrive", "C:") + "\\" if isSupported() else "/"
    try:
        usage = psutil.disk_usage(drive)
    except OSError:
        return None
    return {"device": drive.rstrip("\\/") or "/", "total_bytes": usage.total, "used_bytes": usage.used, "free_bytes": usage.free,
            "percent": usage.percent}


def _remove_tree_files(root, min_age, on_bytes):
    """Apaga os arquivos (não as pastas do sistema) e conta o que conseguiu. Arquivo em uso é pulado."""
    freed = removed = skipped = 0
    for path, size in list(_walk_files(root, min_age)):
        try:
            os.chmod(path, stat.S_IWRITE)
            os.remove(path)
            freed += size
            removed += 1
            on_bytes(size)
        except OSError:
            skipped += 1
    # pastas que ficaram vazias dentro da pasta limpa (a pasta raiz fica)
    for folder, dirs, files in os.walk(root, topdown=False):
        if folder != root and not _is_link(folder):
            try:
                os.rmdir(folder)
            except OSError:
                pass
    return freed, removed, skipped


def _run(keys, roots, scale):
    """Corpo da limpeza (roda em segundo plano). scale = bytes totais previstos, para a barra de progresso."""
    done_bytes = [0]

    def advance(size):
        done_bytes[0] += size
        with _job_lock:
            _job["progress"] = min(99, int(100 * done_bytes[0] / max(1, scale)))

    try:
        for key in keys:
            name = next(c["name"] for c in CATEGORIES if c["key"] == key)
            with _job_lock:
                _job["current"] = name
            freed = removed = skipped = 0
            if key == "bin":
                before, _ = _recycle_bin_size()
                try:
                    _empty_recycle_bin()
                    freed = before
                except OSError:
                    skipped = 1
                advance(before)
            elif key == "dl":
                for item in _old_downloads(next(iter(roots.get("dl", [])), "")):
                    size, count = _entry_size(item)
                    if _send_to_trash(item):
                        freed += size
                        removed += count
                        advance(size)
                    else:
                        skipped += count
            else:
                for root in roots.get(key, []):
                    f, r, s = _remove_tree_files(root, DAY if key == "tmp" else 0, advance)
                    freed, removed, skipped = freed + f, removed + r, skipped + s
            with _job_lock:
                _job["per_key"][key] = {"freed": freed, "files": removed, "skipped": skipped}
                _job["freed"] += freed
        with _job_lock:
            _job["phase"], _job["progress"] = "done", 100
    except Exception as error:  # noqa: BLE001 - a interface mostra o erro em vez de travar
        with _job_lock:
            _job["phase"], _job["error"] = "done", str(error)


def startCleanup(keys, roots=None, sizes=None):
    """Começa a limpar as categorias marcadas, em segundo plano. Devolve o estado inicial."""
    valid = [c["key"] for c in CATEGORIES]
    keys = [k for k in valid if k in (keys or [])]
    with _job_lock:
        if _job["phase"] == "cleaning":
            return dict(_job)
        _job.update({"phase": "cleaning", "progress": 0, "current": "", "freed": 0, "per_key": {}, "error": None})
    if not keys or (not isSupported() and roots is None):
        with _job_lock:
            _job.update({"phase": "done", "progress": 100})
        return dict(_job)
    roots = roots or _roots()
    scale = sizes if sizes is not None else sum(_measure(k, roots)[0] for k in keys)
    threading.Thread(target=_run, args=(keys, roots, scale), daemon=True, name="mallard-limpeza").start()
    return dict(_job)


def status():
    with _job_lock:
        return {**_job, "per_key": dict(_job["per_key"])}


def resetJob():
    with _job_lock:
        _job.update({"phase": "idle", "progress": 0, "current": "", "freed": 0, "per_key": {}, "error": None})
