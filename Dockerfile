FROM python:3.10-slim

# Set environment variables
ENV PYTHONPATH=/app:/app/models
ENV PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .

# Install dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create non-root user
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Copy application code
COPY . .

CMD ["python", "app/main.py"]
