from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.user import (
    PasswordConfirm,
    PasswordReset,
    RecoveryCodeOut,
    RefreshRequest,
    Token,
    UserCreate,
    UserOut,
    UserRegistered,
)
from app.security.dependencies import get_current_user
from app.security.passwords import hash_password, needs_rehash, verify_password
from app.security.rate_limit import client_ip, enforce, limit_by_ip, login_limiter, refresh_limiter, register_limiter
from app.security.recovery_codes import generate_recovery_code, normalize_recovery_code
from app.security.refresh_tokens import (
    InvalidRefreshToken,
    issue_refresh_token,
    revoke_all_refresh_tokens,
    revoke_refresh_token,
    rotate_refresh_token,
)
from app.security.tokens import create_access_token
from app.services.accounts import delete_account

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_new_recovery_code(user: User) -> str:
    code = generate_recovery_code()
    user.recovery_code_hash = hash_password(normalize_recovery_code(code))
    return code


def _require_password(request: Request, user: User, password: str) -> None:
    """Une session volée ne doit pas suffire pour une action définitive."""
    enforce(login_limiter, f"{client_ip(request)}:{user.email}")
    if not verify_password(password, user.password_hash):
        # Pas de 401 : l'appli y verrait une session expirée et tenterait de la renouveler
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Mot de passe incorrect")


@router.post(
    "/register",
    response_model=UserRegistered,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_by_ip(register_limiter))],
)
def register(body: UserCreate, db: Session = Depends(get_db)) -> UserRegistered:
    email = body.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Un compte existe déjà avec cet email")

    user = User(email=email, password_hash=hash_password(body.password))
    recovery_code = _set_new_recovery_code(user)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # deux inscriptions en même temps avec le même email
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Un compte existe déjà avec cet email")
    db.refresh(user)
    return UserRegistered(**UserOut.model_validate(user).model_dump(), recovery_code=recovery_code)


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


@router.post("/reset-password", response_model=RecoveryCodeOut)
def reset_password(body: PasswordReset, request: Request, db: Session = Depends(get_db)) -> RecoveryCodeOut:
    email = body.email.strip().lower()
    enforce(login_limiter, f"{client_ip(request)}:{email}")
    user = db.scalar(select(User).where(User.email == email))

    # Même réponse et même temps de calcul si le compte n'existe pas ou n'a pas de code
    code = normalize_recovery_code(body.recovery_code)
    valid = verify_password(code, user.recovery_code_hash if user else None)
    if not valid or user is None or not user.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "E-mail ou code de secours incorrect")

    user.password_hash = hash_password(body.new_password)
    # Usage unique, et les sessions ouvertes par un éventuel intrus sont coupées
    new_code = _set_new_recovery_code(user)
    revoke_all_refresh_tokens(db, user.id)
    db.commit()
    return RecoveryCodeOut(recovery_code=new_code)


@router.post("/recovery-code", response_model=RecoveryCodeOut)
def new_recovery_code(
    body: PasswordConfirm,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> RecoveryCodeOut:
    _require_password(request, current, body.password)
    code = _set_new_recovery_code(current)
    db.commit()
    return RecoveryCodeOut(recovery_code=code)


@router.post("/delete-account", status_code=status.HTTP_204_NO_CONTENT)
def remove_account(
    body: PasswordConfirm,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> None:
    _require_password(request, current, body.password)
    delete_account(db, current)
