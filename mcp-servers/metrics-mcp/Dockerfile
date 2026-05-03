FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*
COPY common/requirements.txt /tmp/common.txt
COPY metrics-mcp/requirements.txt /tmp/svc.txt
RUN pip install --no-cache-dir -r /tmp/common.txt -r /tmp/svc.txt
COPY common /app/common
COPY metrics-mcp /app/svc
ENV PYTHONPATH=/app
EXPOSE 8080
CMD ["python", "/app/svc/server.py"]
