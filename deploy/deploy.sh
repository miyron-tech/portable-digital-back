#!/usr/bin/env bash
#
# Деплой одного сервиса portable.digital на проде:
#   /opt/portable/deploy.sh <backend|frontend> [git-sha]
# Ручной откат на предыдущую версию (повторный запуск возвращает обратно):
#   /opt/portable/deploy.sh <backend|frontend> --rollback
#
# Зовётся из GitHub Actions после того, как исходники уже лежат в
# /opt/portable/<back|front>. Собирает образ, поднимает контейнер, ждёт
# здоровья и при провале сам откатывается на предыдущий образ.
#
# Источник правды — deploy/ в репозитории portable-digital-back. Схема взята
# у buydone (/opt/buydone/deploy.sh) на том же сервере.
set -euo pipefail

SERVICE="${1:-}"
SHA="${2:-unknown}"
ROOT=/opt/portable
COMPOSE=(docker compose -f "$ROOT/docker-compose.yml")
# Публичный адрес проверяем через общий Caddy, а не напрямую в контейнер:
# живой контейнер за сломанным прокси — тоже провал.
DOMAIN=portable.digital

case "$SERVICE" in
  backend|frontend) ;;
  *) echo "usage: $0 <backend|frontend> [sha|--rollback]" >&2; exit 2 ;;
esac
NAME="portable-$SERVICE"   # имя сервиса, контейнера и образа в compose

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

cd "$ROOT"

# Бэкенд и фронтенд живут в разных репозиториях и могут приехать одновременно.
# Оба трогают один compose — без замка второй `up` перебил бы первый.
exec 9>"$ROOT/.deploy.lock"
log "waiting for the deploy lock"
flock -w 900 9 || { log "ABORT: lock timeout"; exit 1; }

# Боевые секреты живут только здесь. Без них бэкенд не взлетит, а откатывать
# будет некуда — проверяем до того, как что-то сломать.
test -f "$ROOT/.env" || { log "ABORT: $ROOT/.env is missing"; exit 1; }

backend_healthy() {
  [[ "$(docker inspect -f '{{.State.Health.Status}}' portable-backend 2>/dev/null || echo missing)" == healthy ]]
}

site_code() {
  curl -sk -o /dev/null -w '%{http_code}' --max-time 5 \
    --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN$1" || true
}

wait_healthy() {
  for _ in $(seq 1 40); do
    case "$SERVICE" in
      # API наружу не открыт: здоровье — HEALTHCHECK контейнера (/api/health
      # изнутри). Через фронтенд не проверяем: сломанный фронтенд откатывал бы
      # исправный бэкенд.
      backend) backend_healthy && return 0 ;;
      frontend) [[ "$(site_code /)" == 200 && "$(site_code /services)" == 200 ]] && return 0 ;;
    esac
    sleep 3
  done
  return 1
}

# Откат — обмен тегами latest <-> previous, а не перезапись. Оба образа
# остаются помеченными: `prune` их не тронет, упавшую версию можно разобрать,
# а повторный откат возвращает всё как было.
rollback() {
  if ! docker image inspect "$NAME:previous" >/dev/null 2>&1; then
    log "ROLLBACK IMPOSSIBLE: no $NAME:previous image"
    return 1
  fi
  log "swapping $NAME:latest <-> $NAME:previous"
  docker tag "$NAME:latest" "$NAME:swap"
  docker tag "$NAME:previous" "$NAME:latest"
  docker tag "$NAME:swap" "$NAME:previous"
  docker rmi "$NAME:swap" >/dev/null
  "${COMPOSE[@]}" up -d --no-deps --force-recreate "$NAME"
  if wait_healthy; then
    log "$NAME is healthy on the swapped-in version"
  else
    log "ROLLBACK ALSO UNHEALTHY — manual intervention needed"
    return 1
  fi
}

if [[ "$SHA" == "--rollback" ]]; then
  status=0
  rollback || status=$?
  echo "$(date -u +%FT%TZ) $SERVICE MANUAL-ROLLBACK exit=$status" >> "$ROOT/deploy.log"
  exit "$status"
fi

# Фронтенд без бэкенда не проверить: его здоровье — это страницы с каталогом.
if [[ "$SERVICE" == frontend ]] && ! backend_healthy; then
  log "ABORT: portable-backend is not healthy, deploy the backend first"
  exit 1
fi

# Работающий образ сохраняем под :previous — это и есть точка отката.
if docker image inspect "$NAME:latest" >/dev/null 2>&1; then
  docker tag "$NAME:latest" "$NAME:previous"
fi

log "building $NAME ($SHA)"
"${COMPOSE[@]}" build "$NAME"

# --no-deps: пересборка фронтенда не должна перезапускать бэкенд и наоборот.
log "starting $NAME"
"${COMPOSE[@]}" up -d --no-deps --force-recreate "$NAME"

log "waiting for $NAME to become healthy"
if ! wait_healthy; then
  log "$NAME is unhealthy after deploy; last logs:"
  docker logs --tail 30 "$NAME" 2>&1 | sed 's/^/    /' || true
  # `|| true`: под set -e неудачный откат оборвал бы скрипт до записи в журнал.
  rollback || true
  echo "$(date -u +%FT%TZ) $SERVICE $SHA FAILED-ROLLED-BACK" >> "$ROOT/deploy.log"
  exit 1
fi

echo "$(date -u +%FT%TZ) $SERVICE $SHA OK" >> "$ROOT/deploy.log"
# Только висячие слои; помеченный :previous остаётся для следующего отката.
docker image prune -f >/dev/null
log "deployed $NAME $SHA"
