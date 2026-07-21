"""Platform administration — one sub-router per concern, composed here.

The composite router mounts under /admin exactly as the old monolithic module
did, so `router.py` wiring and the `enforce_admin_permission` path-prefix map
are unchanged. Endpoint functions are re-exported for the tests.
"""
from fastapi import APIRouter

from app.api.v1.admin import billing, comms, content, site, users
from app.api.v1.admin.billing import *  # noqa: F401,F403
from app.api.v1.admin.comms import *  # noqa: F401,F403
from app.api.v1.admin.content import *  # noqa: F401,F403
from app.api.v1.admin.site import *  # noqa: F401,F403
from app.api.v1.admin.users import *  # noqa: F401,F403

router = APIRouter()
for _mod in (users, billing, content, comms, site):
    router.include_router(_mod.router)
