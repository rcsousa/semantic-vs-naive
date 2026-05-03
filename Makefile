.PHONY: up down logs seed reset eval ps

up:
	docker compose --profile "" up -d --build

down:
	docker compose down

reset:
	docker compose down -v

logs:
	docker compose logs -f --tail=200

seed:
	docker compose run --rm seeder

ps:
	docker compose ps

eval:
	docker compose exec gateway python -m app.eval.run_all
