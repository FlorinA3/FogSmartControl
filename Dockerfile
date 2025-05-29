FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
RUN useradd -m appuser && chown -R appuser /app
USER appuser
COPY . .
CMD ["python", "app/main.py"]

