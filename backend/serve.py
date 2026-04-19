import os
import socket

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import uvicorn


def local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "localhost"


if __name__ == "__main__":
    host = os.getenv("APP_HOST", "0.0.0.0")
    port = int(os.getenv("PORT", os.getenv("APP_PORT", "8000")))  # Render uses PORT

    ip = local_ip()
    print("=" * 50)
    print("  grandMA2 Onboarding Web Server")
    print("=" * 50)
    print(f"  이 PC:          http://localhost:{port}")
    print(f"  같은 WiFi 기기: http://{ip}:{port}")
    print("=" * 50)
    print("  종료: Ctrl+C")
    print()

    uvicorn.run("main:app", host=host, port=port, reload=False)
