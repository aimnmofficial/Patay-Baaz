# Pattay Baaz

Desi card games with friends on their own phones: Rung (4 and 3 player), Band Rung, President (Gandu), Thulla, Bluff and Daketi.

- `server.js`: Node server. Holds the real game state, shuffles with a secure RNG, validates every move and sends each phone only its own hand. Rooms use a 4 letter code, empty seats are filled by bots, and a dropped phone can rejoin its seat.
- `engine.js`: the rules for every game. Runs on the server for online play and in the browser for solo practice against bots.
- `app.js` + `index.src.html`: the screen. `python3 build.py` bundles them into `public/index.html`.
- `test.js`: plays thousands of bot-only games per mode to check the rules never crash or get stuck (`npm test`).

## Run locally

    npm install
    npm start

Open http://localhost:3000. Phones on the same Wi-Fi can open http://<laptop-ip>:3000.

## Deploy on Render (free)

New > Web Service > pick this repo. Build command `npm install`, start command `npm start`, plan Free. Render sets `PORT` itself. The free plan sleeps when idle, so the first visit can take up to a minute.
