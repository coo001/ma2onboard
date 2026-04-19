"""
grandMA2 onPC Telnet 클라이언트

프롬프트 패턴: ']>' (예: [Cue]>, [Default]>)
로그인 흐름:
  1. 배너에서 username 프롬프트 대기
  2. username 전송
  3. 'Password' 프롬프트 대기 → password 전송 (빈 문자열 가능)
  4. ']>' 프롬프트 도착 = 로그인 완료, 명령 수락 상태
"""

import asyncio
import logging
import telnetlib
from typing import Optional

logger = logging.getLogger(__name__)

MA2_DEFAULT_PORT = 30000
TIMEOUT = 5.0
CMD_TIMEOUT = 3.0

# grandMA2 명령 프롬프트 패턴: [ExecutorName]>
PROMPT = b"]>"


class MA2TelnetClient:
    def __init__(self):
        self._tn: Optional[telnetlib.Telnet] = None
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
            result = await asyncio.to_thread(
                self._connect_sync, host, port, user, password
            )
        except Exception as e:
            return {"ok": False, "error": str(e)}
        if result["ok"]:
            self.connected = True
        return result

    def _connect_sync(self, host, port, user, password) -> dict:
        try:
            tn = telnetlib.Telnet(host, port, timeout=TIMEOUT)
        except Exception as e:
            return {"ok": False, "error": f"TCP 연결 실패: {e}"}

        # ── Step 1: 초기 프롬프트 대기 (grandMA2는 guest로 자동 로그인) ──
        try:
            raw = tn.read_until(PROMPT, timeout=5.0)
        except EOFError:
            return {"ok": False, "error": "연결 직후 서버가 닫힘 (Remote Commandline 비활성화 상태일 수 있음)"}

        banner = _strip_ansi(raw.decode("utf-8", errors="replace")).strip()
        self.last_banner = banner
        logger.info(f"[MA2 banner] {repr(banner)}")

        if "disabled" in banner.lower():
            tn.close()
            return {"ok": False, "error": "Remote commandline disabled — grandMA2 Setup에서 활성화 필요"}

        # ── Step 2: Login 명령어로 인증 ──────────────────────
        # grandMA2는 연결 즉시 guest로 로그인되며,
        # 'Login username password' 명령으로 계정 전환.
        login_cmd = f"Login {user}"
        if password:
            login_cmd += f" {password}"
        tn.write(login_cmd.encode() + b"\r\n")
        logger.info(f"[MA2] Login 명령 전송: {login_cmd}")

        try:
            raw2 = tn.read_until(PROMPT, timeout=4.0)
        except EOFError:
            return {"ok": False, "error": "Login 명령 후 연결 끊김"}

        resp = _strip_ansi(raw2.decode("utf-8", errors="replace")).strip()
        logger.info(f"[MA2 login response] {repr(resp)}")

        if any(kw in resp.lower() for kw in ["denied", "wrong", "fail", "invalid", "login needed"]):
            tn.close()
            return {"ok": False, "error": f"로그인 실패: {resp}"}

        self._tn = tn
        logger.info(f"[MA2] 로그인 성공 ✓ (응답: {repr(resp[:80])})")
        return {"ok": True, "banner": banner, "login_response": resp}

    async def disconnect(self):
        self.connected = False
        tn = self._tn
        self._tn = None
        if tn:
            try:
                await asyncio.to_thread(tn.close)
            except Exception:
                pass

    async def send_command(self, cmd: str) -> dict:
        if not self.connected or not self._tn:
            return {"ok": False, "error": "연결되지 않음"}
        try:
            response = await asyncio.to_thread(self._send_sync, cmd)
            ok = not any(kw in response.lower()
                         for kw in ["error", "syntax", "unknown", "invalid", "login needed"])
            return {"ok": ok, "command": cmd, "response": response}
        except Exception as e:
            self.connected = False
            return {"ok": False, "error": str(e), "command": cmd}

    def _send_sync(self, cmd: str) -> str:
        """
        명령 전송 후 ']>' 프롬프트까지 읽어 응답 반환.
        프롬프트까지 읽으므로 다음 명령과 응답이 섞이지 않음.
        """
        self._tn.write(cmd.encode("utf-8") + b"\r\n")
        try:
            raw = self._tn.read_until(PROMPT, timeout=CMD_TIMEOUT)
        except EOFError:
            self.connected = False
            raise ConnectionError("grandMA2가 연결을 끊었습니다")

        # ANSI 이스케이프 제거 후 텍스트 정리
        text = raw.decode("utf-8", errors="replace")
        text = _strip_ansi(text)
        # 에코된 명령어 자체와 프롬프트 제거
        lines = [l.strip() for l in text.splitlines()
                 if l.strip() and l.strip() != cmd and not l.strip().endswith("]>")]
        result = " | ".join(lines) if lines else ""
        logger.info(f"[MA2 cmd] {repr(cmd)} → {repr(result)}")
        return result


def _strip_ansi(text: str) -> str:
    """ANSI 이스케이프 시퀀스 제거."""
    import re
    return re.sub(r'\x1b\[[0-9;]*[A-Za-z]|\x1b\[K', '', text)


ma2_client = MA2TelnetClient()
