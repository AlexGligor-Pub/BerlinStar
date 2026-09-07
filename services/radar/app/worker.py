"""Punctul de intrare al worker-ului: `python -m app.worker`."""
from app.jobs.worker import main

if __name__ == "__main__":
    main()
