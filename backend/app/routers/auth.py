from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.user import RefreshRequest, Token, UserCreate, UserOut
from app.security.dependencies import get_current_user
from app.security.passwords import hash_password, needs_rehash, verify_password
from app.security.rate_limit import client_ip, enforce, limit_by_ip, login_limiter, refresh_limiter, register_limiter
from app.security.refresh_tokens import (
    InvalidRefreshToken,
    issue_refresh_token,
    revoke_refresh_token,
    rotate_refresh_token,
)
from app.security.tokens import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_by_ip(register_limiter))],
)
def register(body: UserCreate, db: Session = Depends(get_db)) -> User:
    email = body.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Un compte existe déjà avec cet email")

    user = User(email=email, password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # deux inscriptions en même temps avec le même email
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Un compte existe déjà avec cet email")
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    email = form.username.strip().lower()
    # Par adresse IP et par compte : freine le test de mots de passe sans bloquer tout un réseau
    enforce(login_limiter, f"{client_ip(request)}:{email}")
    user = db.scalar(select(User).where(User.email == email))

    # Vérification systématique (hash bidon si l'email est inconnu) : même temps de réponse
    valid = verify_password(form.password, user.password_hash if user else None)
    if not valid or user is None or not user.is_active:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(form.password)

    refresh_token = issue_refresh_token(db, user.id)
    db.commit()
    return Token(access_token=create_access_token(user.id), refresh_token=refresh_token)


@router.post("/refresh", response_model=Token, dependencies=[Depends(limit_by_ip(refresh_limiter))])
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> Token:
    expired = HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expirée", headers={"WWW-Authenticate": "Bearer"})
    try:
        user_id, refresh_token = rotate_refresh_token(db, body.refresh_token)
    except InvalidRefreshToken:
        raise expired

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        db.rollback()
        raise expired

    db.commit()
    return Token(access_token=create_access_token(user_id), refresh_token=refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, db: Session = Depends(get_db)) -> None:
    # Toujours 204 : la réponse ne doit pas indiquer si un jeton existe
    revoke_refresh_token(db, body.refresh_token)


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)) -> User:
    return current
