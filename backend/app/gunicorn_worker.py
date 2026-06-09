"""Custom Gunicorn worker pentru BerlinStar.

UvicornWorker pasează `--max-requests` catre uvicorn ca `limit_max_requests`,
iar uvicorn isi face propriul graceful shutdown guvernat de
`timeout_graceful_shutdown` (default None = asteapta la infinit). Stream-urile
SSE din /api/receipts/events sunt `while True` si nu se inchid singure, deci
worker-ul ar ramane blocat in drenare la nesfarsit ("Waiting for connections
to close"). Cu un singur worker, asta inseamna 0 workeri care servesc
/api/health -> autoheal repornea tot containerul.

Setam un timeout finit: dupa atatea secunde uvicorn anuleaza task-urile SSE
ramase (-> CancelledError -> blocul `finally` face unsubscribe curat) si
worker-ul moare prompt, ca gunicorn sa poata forka imediat unul nou (preload
-> pornire rapida). Gap-ul scade de la ~80s la ~secunde.
"""
from uvicorn.workers import UvicornWorker


class BerlinStarUvicornWorker(UvicornWorker):
    CONFIG_KWARGS = {
        "loop": "auto",
        "http": "auto",
        "timeout_graceful_shutdown": 15,
    }
