FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PYTHONPATH=/app
COPY common/ common/
COPY rag-mcp/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r common/requirements.txt -r requirements.txt
COPY rag-mcp/ rag-mcp/
CMD ["python", "rag-mcp/server.py"]
