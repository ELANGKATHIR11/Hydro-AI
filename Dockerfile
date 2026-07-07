# Multi-stage build for frontend and backend
# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

# Stage 2: Build the Python backend and assemble the application
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies for geospatial libraries (GDAL, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    libgdal-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for GDAL/Cplusplus compiler
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

# Install python dependencies
COPY apps/api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files and built frontend files
COPY apps/api/ /app/apps/api/
COPY --from=frontend-builder /app/web/dist /app/apps/web/dist

# Expose port
EXPOSE 8000

# Command to run uvicorn
CMD ["uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
