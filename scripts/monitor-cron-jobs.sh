#!/bin/bash

# Script to monitor health of cron jobs
# Can be run in a separate container or via a monitoring service

# API endpoint for checking cron jobs
API_URL=${API_URL:-"http://localhost:4000"}
API_TOKEN=${API_TOKEN:-"your-admin-token-here"}

# Thresholds (in seconds)
BOOKING_EXPIRY_MAX_AGE=600  # 10 minutes (should run every 5 minutes)
FLIGHT_STATUS_MAX_AGE=300   # 5 minutes (should run every 2 minutes)

# Get timestamps of last runs from logs or monitoring endpoints
echo "Checking Flight Status update job..."
FLIGHT_STATUS_RESULT=$(curl -s -H "Authorization: Bearer $API_TOKEN" "$API_URL/flight-status/last-run" || echo '{"error": "Failed to connect"}')

echo "Checking Booking Expiration job..."
BOOKING_EXPIRY_RESULT=$(curl -s -H "Authorization: Bearer $API_TOKEN" "$API_URL/booking/expiration/last-run" || echo '{"error": "Failed to connect"}')

# Extract timestamps (assuming the endpoints return JSON with a lastRun timestamp)
FLIGHT_STATUS_TIMESTAMP=$(echo $FLIGHT_STATUS_RESULT | grep -o '"lastRun":"[^"]*"' | cut -d'"' -f4)
BOOKING_EXPIRY_TIMESTAMP=$(echo $BOOKING_EXPIRY_RESULT | grep -o '"lastRun":"[^"]*"' | cut -d'"' -f4)

# Check if we got valid timestamps
if [[ -z "$FLIGHT_STATUS_TIMESTAMP" ]]; then
  echo "ERROR: Could not retrieve flight status job timestamp"
  exit 1
fi

if [[ -z "$BOOKING_EXPIRY_TIMESTAMP" ]]; then
  echo "ERROR: Could not retrieve booking expiry job timestamp"
  exit 1
fi

# Convert timestamps to seconds since epoch
FLIGHT_STATUS_SECONDS=$(date -d "$FLIGHT_STATUS_TIMESTAMP" +%s)
BOOKING_EXPIRY_SECONDS=$(date -d "$BOOKING_EXPIRY_TIMESTAMP" +%s)
CURRENT_SECONDS=$(date +%s)

# Calculate age of last runs
FLIGHT_STATUS_AGE=$((CURRENT_SECONDS - FLIGHT_STATUS_SECONDS))
BOOKING_EXPIRY_AGE=$((CURRENT_SECONDS - BOOKING_EXPIRY_SECONDS))

# Check if jobs are running on schedule
if [[ $FLIGHT_STATUS_AGE -gt $FLIGHT_STATUS_MAX_AGE ]]; then
  echo "ALERT: Flight Status job hasn't run in $FLIGHT_STATUS_AGE seconds (threshold: $FLIGHT_STATUS_MAX_AGE)"
  # Send alert via preferred method (email, SMS, Slack, etc.)
else
  echo "Flight Status job is healthy. Last run: $FLIGHT_STATUS_TIMESTAMP"
fi

if [[ $BOOKING_EXPIRY_AGE -gt $BOOKING_EXPIRY_MAX_AGE ]]; then
  echo "ALERT: Booking Expiry job hasn't run in $BOOKING_EXPIRY_AGE seconds (threshold: $BOOKING_EXPIRY_MAX_AGE)"
  # Send alert via preferred method (email, SMS, Slack, etc.)
else
  echo "Booking Expiry job is healthy. Last run: $BOOKING_EXPIRY_TIMESTAMP"
fi

# Check if any errors have been reported in the cron job logs
# This would require log parsing or a dedicated error reporting endpoint

exit 0 