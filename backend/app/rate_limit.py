from __future__ import annotations
import ipaddress
import logging
import os

from slowapi import Limiter
from starlette.requests import Request

log = logging.getLogger("berlinstar")

# Cheia limitei este adresa CLIENTULUI, nu a ultimului proxy.
#
# In productie lantul este  client -> Caddy -> nginx -> backend:
#   - Caddy (deploy/Caddyfile, `reverse_proxy` fara `trusted_proxies`) ARUNCA
#     X-Forwarded-For primit de la client si scrie adresa pe care a vazut-o el;
#   - nginx (deploy/nginx.conf, `$proxy_add_x_forwarded_for`) ADAUGA la coada
#     adresa lui Caddy;
#   - backend-ul primeste  "X-Forwarded-For: <client>, <caddy>"  de la nginx.
# `request.client.host` este deci mereu containerul nginx, iar cu el drept
# cheie toate firmele imparteau o singura galeata pe fiecare ruta limitata.
#
# Regula: pornim de la DREAPTA (partea scrisa de proxy-urile noastre) si sarim
# peste adresele de proxy de incredere; prima adresa care nu e a unui proxy
# este clientul. Nu luam niciodata orbeste valoarea din stanga: fara Caddy in
# fata (docker-compose.qa.yml publica nginx direct) aceea vine de la client si
# poate fi inventata. Acolo lantul e "<ce a trimis clientul>, <client>", iar
# mersul de la dreapta se opreste corect pe adresa reala.
#
# Antetul e luat in seama doar daca vecinul de socket este el insusi un proxy
# de incredere; altfel (backend expus direct) ramane adresa vecinului.
_DEFAULT_TRUSTED_PROXIES = "127.0.0.0/8,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7"

_FALLBACK_KEY = "127.0.0.1"

_IPAddress = ipaddress.IPv4Address | ipaddress.IPv6Address
_IPNetwork = ipaddress.IPv4Network | ipaddress.IPv6Network


def _parse_networks(raw: str) -> tuple[_IPNetwork, ...]:
    networks: list[_IPNetwork] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            networks.append(ipaddress.ip_network(part, strict=False))
        except ValueError:
            log.warning("RATE_LIMIT_TRUSTED_PROXIES: retea invalida ignorata: %r", part)
    return tuple(networks)


# Retelele din care vin proxy-urile noastre (implicit: loopback + adrese
# private, adica retelele docker). Se pot restrange din mediu.
TRUSTED_PROXY_NETWORKS = _parse_networks(
    os.getenv("RATE_LIMIT_TRUSTED_PROXIES") or _DEFAULT_TRUSTED_PROXIES
)


def _parse_ip(value: str | None) -> _IPAddress | None:
    if not value:
        return None
    try:
        ip = ipaddress.ip_address(value.strip())
    except ValueError:
        return None
    # "::ffff:172.20.0.3" este tot adresa IPv4 172.20.0.3.
    mapped = getattr(ip, "ipv4_mapped", None)
    return mapped if mapped is not None else ip


def _is_trusted_proxy(ip: _IPAddress) -> bool:
    return any(ip.version == net.version and ip in net for net in TRUSTED_PROXY_NETWORKS)


def _key_for(ip: _IPAddress) -> str:
    # Un client IPv6 primeste de regula un /64 intreg: cheia pe adresa exacta
    # i-ar da o galeata noua la fiecare adresa schimbata.
    if ip.version == 6:
        return str(ipaddress.ip_network(f"{ip}/64", strict=False).network_address)
    return str(ip)


def client_ip_from_chain(peer: str | None, forwarded_for: str | None) -> str:
    """Adresa clientului, din vecinul de socket si antetul X-Forwarded-For."""
    peer_ip = _parse_ip(peer)
    if peer_ip is None:
        return peer or _FALLBACK_KEY
    if not forwarded_for or not _is_trusted_proxy(peer_ip):
        return _key_for(peer_ip)

    candidate = peer_ip
    for part in reversed(forwarded_for.split(",")):
        ip = _parse_ip(part)
        if ip is None:
            # Intrare ilizibila: tot ce e mai la stanga nu mai e de incredere.
            break
        candidate = ip
        if not _is_trusted_proxy(ip):
            break
    # Daca toate intrarile sunt adrese private (client din reteaua locala),
    # ramane cea mai din stanga pe care am putut-o citi.
    return _key_for(candidate)


def client_key(request: Request) -> str:
    """`key_func` pentru slowapi: o galeata per client real, nu una globala."""
    peer = request.client.host if request.client else None
    forwarded = ",".join(request.headers.getlist("x-forwarded-for"))
    return client_ip_from_chain(peer, forwarded or None)


# In-memory rate limiter (suficient pentru ~200 utilizatori, 1 worker).
# Daca scalam la mai multi workeri, treci storage_uri la "redis://..."
limiter = Limiter(key_func=client_key, default_limits=["60/minute"])
