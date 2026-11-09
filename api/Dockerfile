FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.9.0+cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

EXPOSE 8001

# Run with Gunicorn
CMD ["sh", "-c", "gunicorn --workers 1 --worker-class gthread --threads 2 --bind 0.0.0.0:${PORT:-8001} --timeout 180 app:app"]
