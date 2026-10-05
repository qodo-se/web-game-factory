"""Scheduled Cloud Run Job entrypoint: python -m games.borderstrife.api.cleanup."""
import os
from games.borderstrife.api import store


def main():
    # A misconfigured production job must not silently purge a local SQLite file.
    if os.environ.get('CLOUD_RUN_JOB') and not os.environ.get('DATABASE_URL'):
        raise RuntimeError('DATABASE_URL is required for campaign cleanup.')
    try:
        print(f'Deleted {store.purge_expired()} expired campaigns and their turn histories.')
    finally:
        store.close_pools()


if __name__ == '__main__':
    main()
