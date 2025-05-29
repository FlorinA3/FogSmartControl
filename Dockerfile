FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .

# Upgrade pip and install dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create non-root user
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Copy application code
COPY . .

# Set Python path
ENV PYTHONPATH=/app

CMD ["python", "app/main.py"]
