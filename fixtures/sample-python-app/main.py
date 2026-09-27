from fastapi import FastAPI, APIRouter, Depends
from flask import Blueprint, jsonify
from django.urls import path, re_path

app = FastAPI(title="Sample App")
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

@router.post("/login")
async def login(credentials):
    user = authenticate(credentials.username, credentials.password)
    token = create_jwt(user)
    return {"token": token}

@router.get("/me")
async def get_me():
    user = fetch_current_user()
    return user

@app.get("/healthz")
def health_check():
    ping_db()
    return {"status": "ok"}

# Flask Blueprint
user_bp = Blueprint("users", __name__, url_prefix="/users")

@user_bp.route("/profile", methods=["GET", "PUT"])
def profile_handler():
    data = load_profile()
    return jsonify(data)

# Django URL Patterns
urlpatterns = [
    path('api/items/', item_views.list_items),
    re_path(r'^api/items/(?P<item_id>[0-9]+)/$', item_views.item_detail),
]
