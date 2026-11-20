.PHONY: setup backend frontend dev seed test

setup:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
	cd frontend && npm install
	@test -f backend/.env || cp backend/.env.example backend/.env

backend:
	cd backend && .venv/bin/flask --app app run --port 5001 --debug

frontend:
	cd frontend && npm run dev

# Runs both; Ctrl-C stops both.
dev:
	@trap 'kill 0' INT TERM; $(MAKE) backend & $(MAKE) frontend & wait

seed:
	cd backend && .venv/bin/flask --app app seed --reset

test:
	cd backend && .venv/bin/python -m pytest -q tests
