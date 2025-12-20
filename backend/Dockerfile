# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Add the app directory to the PYTHONPATH
ENV PYTHONPATH "${PYTHONPATH}:/app"

# Copy the requirements file into the container at /app
COPY ./requirements.txt /app/

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend directory into the container at /app
COPY . /app/

# Expose the port the app runs on
EXPOSE 8090

# Define the command to run the application
# The README indicates running `python main.py` directly
CMD ["python", "main.py"]
