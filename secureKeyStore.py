"""Armazenamento local protegido da chave Gemini no Windows.

Os bytes são protegidos pelo DPAPI no escopo do usuário conectado e ficam na
pasta de dados do Mallard, fora do checkout/repositório. Em outros sistemas,
o app mantém a chave apenas durante a sessão, sem gravá-la em texto puro.
"""

import ctypes
import os
import tempfile
from ctypes import POINTER, Structure, byref, c_ubyte, c_ulong, c_void_p, create_string_buffer
from pathlib import Path


_MAGIC = b"MLDK1"
_CRYPTPROTECT_UI_FORBIDDEN = 0x1


class _DataBlob(Structure):
    _fields_ = [("cbData", c_ulong), ("pbData", POINTER(c_ubyte))]


def _path():
    root = Path(os.environ.get("APPDATA") or (Path.home() / ".config"))
    folder = root / "Mallard"
    folder.mkdir(parents=True, exist_ok=True)
    return folder / "gemini-key.dpapi"


def is_available():
    return os.name == "nt"


def _blob(data):
    buffer = create_string_buffer(data)
    blob = _DataBlob(len(data), ctypes.cast(buffer, POINTER(c_ubyte)))
    return blob, buffer


def protect_bytes(data):
    """Protege bytes com DPAPI para o usuário atual; levanta em plataformas não Windows."""
    if not is_available():
        raise OSError("O armazenamento criptografado por usuário está disponível somente no Windows.")
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    protect = crypt32.CryptProtectData
    protect.argtypes = [POINTER(_DataBlob), ctypes.c_wchar_p, POINTER(_DataBlob), c_void_p, c_void_p, c_ulong, POINTER(_DataBlob)]
    protect.restype = ctypes.c_int
    local_free = kernel32.LocalFree
    local_free.argtypes = [c_void_p]
    local_free.restype = c_void_p

    source, keepalive = _blob(data)
    encrypted = _DataBlob()
    if not protect(byref(source), "Mallard Gemini API key", None, None, None, _CRYPTPROTECT_UI_FORBIDDEN, byref(encrypted)):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        return ctypes.string_at(encrypted.pbData, encrypted.cbData)
    finally:
        local_free(ctypes.cast(encrypted.pbData, c_void_p))


def unprotect_bytes(data):
    """Desprotege bytes DPAPI no contexto do mesmo usuário Windows."""
    if not is_available():
        raise OSError("O armazenamento criptografado por usuário está disponível somente no Windows.")
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    unprotect = crypt32.CryptUnprotectData
    unprotect.argtypes = [POINTER(_DataBlob), POINTER(ctypes.c_wchar_p), POINTER(_DataBlob), c_void_p, c_void_p, c_ulong, POINTER(_DataBlob)]
    unprotect.restype = ctypes.c_int
    local_free = kernel32.LocalFree
    local_free.argtypes = [c_void_p]
    local_free.restype = c_void_p

    source, keepalive = _blob(data)
    decrypted = _DataBlob()
    description = ctypes.c_wchar_p()
    if not unprotect(byref(source), byref(description), None, None, None, _CRYPTPROTECT_UI_FORBIDDEN, byref(decrypted)):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        return ctypes.string_at(decrypted.pbData, decrypted.cbData)
    finally:
        local_free(ctypes.cast(decrypted.pbData, c_void_p))
        if description:
            local_free(ctypes.cast(description, c_void_p))


def load_key():
    """Retorna a chave protegida salva para este usuário, ou string vazia."""
    if not is_available():
        return ""
    try:
        protected = _path().read_bytes()
        if not protected.startswith(_MAGIC):
            return ""
        return unprotect_bytes(protected[len(_MAGIC):]).decode("utf-8").strip()
    except (OSError, UnicodeError, ValueError, ctypes.ArgumentError):
        return ""


def save_key(key):
    """Persiste chave protegida pelo DPAPI; não cria fallback em texto puro."""
    if not is_available():
        raise OSError("Não foi possível salvar a chave com segurança neste sistema; ela ficará apenas nesta sessão.")
    path = _path()
    protected = _MAGIC + protect_bytes(str(key).strip().encode("utf-8"))
    temporary = None
    try:
        fd, temporary_name = tempfile.mkstemp(prefix=".gemini-key-", suffix=".tmp", dir=path.parent)
        temporary = Path(temporary_name)
        with os.fdopen(fd, "wb") as stream:
            stream.write(protected)
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass


def delete_key():
    """Remove a cópia protegida salva para este usuário."""
    if not is_available():
        return
    try:
        _path().unlink(missing_ok=True)
    except OSError:
        pass
