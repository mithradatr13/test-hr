# Server-Side API and Logic Evaluation

## Task Overview

1. **Simple Login API**
    - **API Endpoint:** `POST /api/login`
    - **Request Data (DTO):**
        ```json
        {
          "phone": "09120000000",
          "password": "123456"
        }
        ```
    - **Output:** Authentication token for use in subsequent requests.

---

2. **Record Provider Location and Online Status**
    - **API Endpoint:** `POST /api/provider/location/update`
    - **Request Data (DTO):**
        ```json
        {
          "lat": 35.7001,
          "lng": 51.4099,
          "is_online": true
        }
        ```

---

3. **Request List of Active Service Providers Near the User**
    - **API Endpoint:** `GET /api/providers/nearby?lat=35.7021&lng=51.4031`
    - **Sample Output:**
        ```json
        {
          "status": "success",
          "providers": [
            { 
              "id": 12,
              "name": "Ali",
              "lat": 35.7010,
              "lng": 51.4040
            },
            { 
              "id": 17,
              "name": "Sara",
              "lat": 35.7002,
              "lng": 51.4050
            }
          ]
        }
        ```

---

## Bonus Question

If you are familiar with WebSocket, provide a simple implementation that notifies online and nearby service providers in real-time when a new request is made.

---

Feel free to expand upon these tasks and bonus question as needed for your evaluation. Good luck with the task! 🚀