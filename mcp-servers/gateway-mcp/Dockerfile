FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY gateway-mcp/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY gateway-mcp/ gateway-mcp/
CMD ["python", "gateway-mcp/server.py"]
