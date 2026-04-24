.PHONY: dev build deploy logs shell clean

# Local development
dev:
	docker compose up --build

# Build backend image only
build:
	docker build -t travelhub-backend:latest ./backend

# View running container logs
logs:
	docker logs travelhub -f

# Shell into running backend container
shell:
	docker exec -it travelhub /bin/bash

# Stop and remove local containers
clean:
	docker compose down --remove-orphans

# Generate VAPID keys (run once)
vapid:
	cd backend && python generate_vapid_keys.py

# Run backend tests
test-backend:
	cd backend && pytest tests/ -v

# Run frontend tests
test-frontend:
	cd frontend && npm test
