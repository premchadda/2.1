#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.scale.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start [N]    Start N backend instances (default: 3)"
    echo "  stop         Stop all services"
    echo "  status       Show status of all instances"
    echo "  restart [N]  Restart with N instances (default: 3)"
    echo "  logs         Tail logs from all backend instances"
    echo ""
    echo "Examples:"
    echo "  $0 start       # Start with 3 backends"
    echo "  $0 start 5     # Start with 5 backends"
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
        echo "docker compose -f $COMPOSE_FILE"
    else
        echo "docker-compose -f $COMPOSE_FILE"
    fi
}

cmd_start() {
    local instances=${1:-3}

    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}Error: $COMPOSE_FILE not found${NC}"
        exit 1
    fi

    echo -e "${CYAN}Starting $instances backend instances...${NC}"

    local compose_cmd
    compose_cmd=$(get_compose_cmd)

    # Start database and Redis first
    echo -e "${YELLOW}Starting infrastructure (PostgreSQL, Redis)...${NC}"
    $compose_cmd up -d backend-db redis
    sleep 5

    # Start backend instances
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
    for port in 5001 5002 5003; do
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
    $compose_cmd logs -f backend-1 backend-2 backend-3
}

check_docker

case "${1:-}" in
    start)   cmd_start "${2:-3}" ;;
    stop)    cmd_stop ;;
    status)  cmd_status ;;
    restart) cmd_restart "${2:-3}" ;;
    logs)    cmd_logs ;;
    *)       usage ;;
esac
