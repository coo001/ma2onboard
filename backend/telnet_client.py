"""
grandMA2 onPC Telnet 클라이언트 (asyncio 기반, telnetlib 미사용)
"""

import asyncio
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

MA2_DEFAULT_PORT = 30000
TIMEOUT = 5.0
CMD_TIMEOUT = 3.0
PROMPT = b"]>"


def _strip_ansi(text: str) -> str:
    return re.sub(r'\x1b\[[0-9;]*[A-Za-z]|\x1b\[K', '', text)


class MA2TelnetClient:
    def __init__(self):
        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None
        self.host: str = ""
        self.port: int = MA2_DEFAULT_PORT
        self.connected: bool = False
        self.last_banner: str = ""

    async def connect(self, host: str, port: int = MA2_DEFAULT_PORT,
                      user: str = "administrator", password: str = "") -> dict:
        self.host = host
        self.port = port
        self.connected = False
        try:
            self._reader, self._writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=TIMEOUT
            )
        except Exception as e:
            return {"ok": False, "error": f"TCP 연결 실패: {e}"}

        try:
            raw = await self._read_until(PROMPT, timeout=5.0)
        except Exception as e:
            return {"ok": False, "error": f"연결 직후 서버가 닫힘: {e}"}

        banner = _strip_ansi(raw.decode("utf-8", errors="replace")).strip()
        self.last_banner = banner
        logger.info(f"[MA2 banner] {repr(banner)}")

        if "disabled" in banner.lower():
            await self.disconnect()
            return {"ok": False, "error": "Remote commandline disabled — grandMA2 Setup에서 활성화 필요"}

        login_cmd = f"Login {user}"
        if password:
            login_cmd += f" {password}"
        self._writer.write(login_cmd.encode() + b"\r\n")
        await self._writer.drain()

        try:
            raw2 = await self._read_until(PROMPT, timeout=4.0)
        except Exception as e:
            return {"ok": False, "error": f"Login 명령 후 연결 끊김: {e}"}

        resp = _strip_ansi(raw2.decode("utf-8", errors="replace")).strip()
        logger.info(f"[MA2 login response] {repr(resp)}")

        if any(kw in resp.lower() for kw in ["denied", "wrong", "fail", "invalid", "login needed"]):
            await self.disconnect()
            return {"ok": False, "error": f"로그인 실패: {resp}"}

        self.connected = True
        logger.info(f"[MA2] 로그인 성공 ✓")
        return {"ok": True, "banner": banner, "login_response": resp}

    async def disconnect(self):
        self.connected = False
        if self._writer:
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except Exception:
                pass
        self._reader = None
        self._writer = None

    async def send_command(self, cmd: str) -> dict:
        if not self.connected or not self._writer:
            return {"ok": False, "error": "연결되지 않음"}
        try:
            self._writer.write(cmd.encode("utf-8") + b"\r\n")
            await self._writer.drain()
            raw = await self._read_until(PROMPT, timeout=CMD_TIMEOUT)
            text = _strip_ansi(raw.decode("utf-8", errors="replace"))
            lines = [l.strip() for l in text.splitlines()
                     if l.strip() and l.strip() != cmd and not l.strip().endswith("]>")]
            response = " | ".join(lines) if lines else ""
            ok = not any(kw in response.lower()
                         for kw in ["error", "syntax", "unknown", "invalid", "login needed"])
            logger.info(f"[MA2 cmd] {repr(cmd)} → {repr(response)}")
            return {"ok": ok, "command": cmd, "response": response}
        except Exception as e:
            self.connected = False
            return {"ok": False, "error": str(e), "command": cmd}

    async def _read_until(self, marker: bytes, timeout: float = 5.0) -> bytes:
        buf = b""
        async def _read():
            nonlocal buf
            while marker not in buf:
                chunk = await self._reader.read(4096)
                if not chunk:
                    raise ConnectionError("연결이 끊어졌습니다")
                buf += chunk
            return buf
        return await asyncio.wait_for(_read(), timeout=timeout)


ma2_client = MA2TelnetClient()
