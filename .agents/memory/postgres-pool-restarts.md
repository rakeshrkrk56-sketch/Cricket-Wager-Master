---
name: PostgreSQL pool restarts
description: Keep the API alive when Replit PostgreSQL terminates an idle pooled connection during a transient database restart.
---

The shared PostgreSQL pool must handle its `error` event. A failed idle client should be removed by the pool without terminating the Node.js process.

**Why:** Replit PostgreSQL can briefly restart and terminate idle clients with PostgreSQL code `57P01`. An unhandled pool error exits the API process, which disconnects every Dragon Tiger WebSocket.

**How to apply:** Any replacement database pool must retain an idle-client error listener. Treat individual failed clients as recoverable and let subsequent queries acquire a fresh connection.