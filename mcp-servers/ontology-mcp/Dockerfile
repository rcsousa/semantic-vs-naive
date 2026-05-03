FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*
COPY common/requirements.txt /tmp/common.txt
RUN pip install --no-cache-dir -r /tmp/common.txt
COPY common /app/common
COPY ontology-mcp /app/svc
ENV PYTHONPATH=/app
EXPOSE 8080
CMD ["python", "/app/svc/server.py"]
