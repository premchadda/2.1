#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
# docker-compose.scale.yml is DEPRECATED (see its header). Scale operations run
# against the supported path: base file + prod override. The base file defines
# two fixed backends (backend-1/backend-2), so N>2 requires a scalable service
# definition first — fail loudly instead of half-scaling.
COMPOSE_BASE="$PROJECT_DIR/docker-compose.yml"
COMPOSE_PROD="$PROJECT_DIR/docker-compose.prod.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start [N]    Start N backend instances (default: 2, max: 2)"
    echo "  stop         Stop all services"
    echo "  status       Show status of all instances"
    echo "  restart [N]  Restart with N instances (default: 2)"
    echo "  logs         Tail logs from all backend instances"
    echo ""
    echo "Examples:"
    echo "  $0 start       # Start with 2 backends (base + prod override)"
    echo "  $0 stop        # Stop everything"
    exit 1
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: docker is not installed${NC}"
        exit 1
    fi
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}Error: docker-compose is not installed${NC}"
        exit 1
    fi
}

get_compose_cmd() {
    if docker compose version &> /dev/null 2>&1; then
        echo "docker compose -f $COMPOSE_BASE -f $COMPOSE_PROD"
    else
        echo "docker-compose -f $COMPOSE_BASE -f $COMPOSE_PROD"
    fi
}

cmd_start() {
    local instances=${1:-2}

    if [ ! -f "$COMPOSE_BASE" ]; then
        echo -e "${RED}Error: $COMPOSE_BASE not found${NC}"
        exit 1
    fi
    if [ "$instances" -gt 2 ]; then
        echo -e "${RED}Error: only backend-1/backend-2 exist in the supported compose path (asked: $instances).${NC}"
        echo -e "${YELLOW}Add a scalable 'backend' service to docker-compose.yml first, then re-run.${NC}"
        exit 1
    fi

    echo -e "${CYAN}Starting $instances backend instances...${NC}"

    local compose_cmd
    compose_cmd=$(get_compose_cmd)

    # Start database and Redis first
    echo -e "${YELLOW}Starting infrastructure (PostgreSQL, Redis)...${NC}"
    $compose_cmd up -d backend-db redis
    sleep 5

    # Start backend instances (fixed names in the supported compose path)
    local services=""
    for i in $(seq 1 "$instances"); do
        services="$services backend-$i"
    done

    echo -e "${YELLOW}Starting backend instances:${NC}$services"
    $compose_cmd up -d $services

    # Wait for health checks
    echo -e "${YELLOW}Waiting for backends to become healthy...${NC}"
    sleep 10

    # Start remaining services
    echo -e "${YELLOW}Starting frontend, admin-panel, nginx, monitoring...${NC}"
    $compose_cmd up -d frontend admin-panel nginx prometheus grafana

    cmd_status
}

cmd_stop() {
    echo -e "${CYAN}Stopping all services...${NC}"
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    $compose_cmd down --remove-orphans
    echo -e "${GREEN}All services stopped.${NC}"
}

cmd_status() {
    echo -e "${CYAN}=== Service Status ===${NC}"
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    $compose_cmd ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

    echo ""
    echo -e "${CYAN}=== Backend Health Checks ===${NC}"
    for port in 5001 5002; do
        local status
        status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/api/health" 2>/dev/null || echo "000")
        if [ "$status" = "200" ]; then
            echo -e "  Backend :$port - ${GREEN}HEALTHY${NC}"
        else
            echo -e "  Backend :$port - ${RED}UNHEALTHY (HTTP $status)${NC}"
        fi
    done
}

cmd_restart() {
    cmd_stop
    cmd_start "$1"
}

cmd_logs() {
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    $compose_cmd logs -f backend-1 backend-2
}

check_docker

case "${1:-}" in
    start)   cmd_start "${2:-2}" ;;
    stop)    cmd_stop ;;
    status)  cmd_status ;;
    restart) cmd_restart "${2:-2}" ;;
    logs)    cmd_logs ;;
    *)       usage ;;
esac
